-- ============================================================
-- Trigger: validate_demanda_transition
-- Semana 6 do plano de ação de performance.
--
-- Move as regras de workflow do hook useDemandas.ts para o banco,
-- garantindo consistência independente de qual cliente (frontend,
-- API, scripts de migração) altere o status de uma demanda.
--
-- Regras implementadas (em ordem de prioridade):
--
--   1. IDEMPOTÊNCIA
--      from_status = to_status → RAISE (nada a fazer, evita loop)
--
--   2. STATUS TERMINAL
--      Se a demanda já está em ag_aceite_final ou cancelada,
--      nenhuma nova transition é aceita (exceto a própria — coberta
--      pela regra 1).
--
--   3. JUSTIFICATIVA OBRIGATÓRIA
--      to_status IN ('rejeitada','cancelada','planejamento_ag_aprovacao')
--      exige NEW.justificativa IS NOT NULL AND trim(NEW.justificativa) <> ''
--
--   4. ADJACÊNCIA NO FLUXO PRINCIPAL
--      Quando from_status e to_status ambos pertencem ao FLOW_PRINCIPAL,
--      só permite:
--        a) avançar 1 passo (idx_to = idx_from + 1)
--        b) recuar qualquer número de passos (retorno permitido)
--        c) qualquer origem → status especial (bloqueada, rejeitada, cancelada)
--
--   5. NOVA DEMANDA
--      from_status IS NULL só é aceito com to_status = 'fila_atendimento'
--      (primeira transition de criação).
--
-- Mensagens de erro em português com código SQLSTATE 'P0001'
-- para facilitar catch no frontend.
-- ============================================================

-- ── Função do trigger ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_validate_demanda_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Fluxo principal na mesma ordem que FLOW_PRINCIPAL do frontend
  v_flow CONSTANT TEXT[] := ARRAY[
    'fila_atendimento',
    'planejamento_elaboracao',
    'planejamento_ag_aprovacao',
    'planejamento_aprovada',
    'em_execucao',
    'hom_ag_homologacao',
    'hom_homologada',
    'fila_producao',
    'ag_aceite_final'
  ];

  -- Status terminais — nenhuma transition aceita após atingi-los
  v_terminais CONSTANT TEXT[] := ARRAY['ag_aceite_final', 'cancelada'];

  -- Status que exigem justificativa
  v_req_just  CONSTANT TEXT[] := ARRAY['rejeitada', 'cancelada', 'planejamento_ag_aprovacao'];

  -- Status especiais que podem receber qualquer origem
  v_especiais CONSTANT TEXT[] := ARRAY['bloqueada', 'rejeitada', 'cancelada'];

  v_from      TEXT    := NEW.from_status;
  v_to        TEXT    := NEW.to_status;
  v_demanda   demandas%ROWTYPE;
  v_idx_from  INT;
  v_idx_to    INT;
BEGIN

  -- ── Busca demanda atual ────────────────────────────────────────────────────
  SELECT * INTO v_demanda FROM demandas WHERE id = NEW.demanda_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demanda % não encontrada.', NEW.demanda_id
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Regra 1: Idempotência ─────────────────────────────────────────────────
  IF v_from IS NOT DISTINCT FROM v_to THEN
    RAISE EXCEPTION 'Transição inválida: status de origem e destino são iguais (%).' , v_to
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Regra 2: Status terminal ───────────────────────────────────────────────
  IF v_demanda.situacao = ANY(v_terminais) THEN
    RAISE EXCEPTION 'Demanda já está em status terminal (%). Nenhuma transição adicional é permitida.',
      v_demanda.situacao
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Regra 3: Justificativa obrigatória ────────────────────────────────────
  IF v_to = ANY(v_req_just) THEN
    IF NEW.justificativa IS NULL OR TRIM(NEW.justificativa) = '' THEN
      RAISE EXCEPTION 'Justificativa obrigatória para o status "%".',
        v_to
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ── Regra 4: Adjacência no fluxo principal ────────────────────────────────
  -- Só aplica quando from_status não é NULL e ambos estão no fluxo principal
  IF v_from IS NOT NULL THEN

    -- Destino especial → sempre permitido
    IF v_to = ANY(v_especiais) THEN
      -- OK, passa adiante
      NULL;

    -- Retorno de bloqueada/especial para o fluxo principal → permitido
    ELSIF v_from = ANY(v_especiais) THEN
      -- OK, passa adiante (retorna de bloqueio)
      NULL;

    -- Ambos no fluxo principal: valida adjacência
    ELSE
      v_idx_from := array_position(v_flow, v_from);
      v_idx_to   := array_position(v_flow, v_to);

      IF v_idx_from IS NOT NULL AND v_idx_to IS NOT NULL THEN
        -- Permite: avançar 1 passo OU recuar qualquer número de passos
        IF v_idx_to <> v_idx_from + 1 AND v_idx_to >= v_idx_from THEN
          RAISE EXCEPTION
            'Transição inválida: não é possível avançar de "%" diretamente para "%". Siga o fluxo principal.',
            v_from, v_to
            USING ERRCODE = 'P0001';
        END IF;
      END IF;
      -- Se um dos dois não está no fluxo principal (ex: status customizado),
      -- permite a transição sem restrição de adjacência
    END IF;

  ELSE
    -- ── Regra 5: Nova demanda (from_status IS NULL) ─────────────────────────
    IF v_to <> 'fila_atendimento' THEN
      RAISE EXCEPTION
        'Primeira transição de uma demanda deve ser para "fila_atendimento", recebido: "%".',
        v_to
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ── Trigger BEFORE INSERT ──────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_validate_demanda_transition ON demanda_transitions;

CREATE TRIGGER trg_validate_demanda_transition
  BEFORE INSERT ON demanda_transitions
  FOR EACH ROW
  EXECUTE FUNCTION fn_validate_demanda_transition();

COMMENT ON FUNCTION fn_validate_demanda_transition IS
  'Valida regras de workflow de demandas antes de inserir em demanda_transitions. '
  'Substitui a lógica de validação do hook useDemandas.ts no frontend.';

-- ── Teste de sanidade (executa em transaction, reverte automaticamente) ────
-- Para rodar manualmente: BEGIN; <inserts de teste>; ROLLBACK;
-- Os casos abaixo são comentados para não executar na migration automática.

-- SHOULD FAIL: from = to
-- INSERT INTO demanda_transitions(demanda_id, from_status, to_status, user_id, justificativa)
-- VALUES ('...', 'em_execucao', 'em_execucao', '...', null);

-- SHOULD FAIL: justificativa faltando
-- INSERT INTO demanda_transitions(demanda_id, from_status, to_status, user_id, justificativa)
-- VALUES ('...', 'em_execucao', 'cancelada', '...', null);

-- SHOULD FAIL: pular dois passos no fluxo principal
-- INSERT INTO demanda_transitions(demanda_id, from_status, to_status, user_id, justificativa)
-- VALUES ('...', 'fila_atendimento', 'planejamento_aprovada', '...', null);

-- SHOULD PASS: avançar 1 passo
-- INSERT INTO demanda_transitions(demanda_id, from_status, to_status, user_id, justificativa)
-- VALUES ('...', 'fila_atendimento', 'planejamento_elaboracao', '...', null);

-- SHOULD PASS: qualquer status → bloqueada
-- INSERT INTO demanda_transitions(demanda_id, from_status, to_status, user_id, justificativa)
-- VALUES ('...', 'hom_homologada', 'bloqueada', '...', null);
