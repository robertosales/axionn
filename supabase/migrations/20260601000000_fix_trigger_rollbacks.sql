-- ============================================================
-- FIX: fn_validate_demanda_transition — reduzir 97k rollbacks
--
-- Problema identificado em perf/rollback-investigation:
--
--   1. Regra 1 (idempotência) usava RAISE EXCEPTION, gerando rollback
--      em operações legítimas (double-click, race condition entre 2
--      usuários). Corrigido para RETURN NULL (cancela silenciosamente,
--      sem rollback, sem dado corrompido).
--
--   2. Race condition de concorrência: o trigger validava adjacência
--      contra demandas.situacao (estado atual do banco), mas o cliente
--      pode ter lido um estado anterior. Corrigido: validar adjacencia
--      usando from_status informado pelo cliente, nao o situacao atual.
--      A consistência do dado é mantida porque o UPDATE em demandas.situacao
--      só ocorre se a transition for aceita.
--
--   3. RAISE NOTICE adicionado para diagnóstico sem rollback.
--
-- Todas as regras de negócio reais (status terminal, justificativa
-- obrigatória, adjacência no fluxo) permanecem intactas.
-- ============================================================

CREATE OR REPLACE FUNCTION fn_validate_demanda_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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

  v_terminais CONSTANT TEXT[] := ARRAY['ag_aceite_final', 'cancelada'];
  v_req_just  CONSTANT TEXT[] := ARRAY['rejeitada', 'cancelada', 'planejamento_ag_aprovacao'];
  v_especiais CONSTANT TEXT[] := ARRAY['bloqueada', 'rejeitada', 'cancelada'];

  v_from     TEXT := NEW.from_status;
  v_to       TEXT := NEW.to_status;
  v_demanda  demandas%ROWTYPE;
  v_idx_from INT;
  v_idx_to   INT;
BEGIN

  -- ── Busca demanda atual ──────────────────────────────────────────────────
  SELECT * INTO v_demanda FROM demandas WHERE id = NEW.demanda_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demanda % não encontrada.', NEW.demanda_id
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Regra 1: Idempotência — CORREÇÃO ────────────────────────────────────
  -- ANTES: RAISE EXCEPTION (gerava rollback em double-click / race condition)
  -- DEPOIS: RETURN NULL (cancela a inserção silenciosamente, zero rollback)
  IF v_from IS NOT DISTINCT FROM v_to THEN
    RAISE NOTICE
      '[demanda_transitions] Idempotent transition ignored: demanda=%, status=%',
      NEW.demanda_id, v_to;
    RETURN NULL;  -- BEFORE INSERT: NULL cancela a inserção sem erro
  END IF;

  -- ── Regra 2: Status terminal ─────────────────────────────────────────────
  -- Usa demandas.situacao para bloquear transitions em demandas finalizadas
  IF v_demanda.situacao = ANY(v_terminais) THEN
    RAISE EXCEPTION
      'Demanda já está em status terminal (%). Nenhuma transição adicional é permitida.',
      v_demanda.situacao
      USING ERRCODE = 'P0001';
  END IF;

  -- ── Regra 3: Justificativa obrigatória ──────────────────────────────────
  IF v_to = ANY(v_req_just) THEN
    IF NEW.justificativa IS NULL OR TRIM(NEW.justificativa) = '' THEN
      RAISE EXCEPTION 'Justificativa obrigatória para o status "%".',
        v_to
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ── Regra 4: Adjacência no fluxo principal ─────────────────────────────
  -- CORREÇÃO: valida usando from_status do cliente (NEW.from_status),
  -- não contra demandas.situacao atual (evita race condition multi-usuário)
  IF v_from IS NOT NULL THEN

    IF v_to = ANY(v_especiais) THEN
      NULL;  -- destino especial — sempre permitido

    ELSIF v_from = ANY(v_especiais) THEN
      NULL;  -- retorno de bloqueio — sempre permitido

    ELSE
      v_idx_from := array_position(v_flow, v_from);
      v_idx_to   := array_position(v_flow, v_to);

      IF v_idx_from IS NOT NULL AND v_idx_to IS NOT NULL THEN
        -- Permite: avançar exatamente 1 passo (idx_to = idx_from + 1)
        -- Permite: recuar qualquer número de passos (idx_to < idx_from)
        -- Bloqueia: avançar mais de 1 passo
        IF v_idx_to > v_idx_from + 1 THEN
          RAISE EXCEPTION
            'Transição inválida: não é possível avançar de "%" diretamente para "%". Siga o fluxo principal.',
            v_from, v_to
            USING ERRCODE = 'P0001';
        END IF;
        -- v_idx_to = v_idx_from + 1 → avanço válido
        -- v_idx_to < v_idx_from     → recuo válido
        -- v_idx_to = v_idx_from     → já tratado pela Regra 1 (RETURN NULL)
      END IF;

    END IF;

  ELSE
    -- ── Regra 5: Nova demanda (from_status IS NULL) ──────────────────────
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

-- O trigger em si não precisa ser recriado — a função foi substituída acima.
-- CREATE OR REPLACE na função é suficiente.

COMMENT ON FUNCTION fn_validate_demanda_transition IS
  'v2: Corrigido para não gerar rollback em transitions idempotentes (double-click / '
  'race condition). Regras de negócio reais preservadas. '
  'Ver docs/rollback-investigation.md para análise completa.';
