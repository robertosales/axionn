CREATE OR REPLACE FUNCTION public.fn_validate_demanda_transition()
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
  v_especiais CONSTANT TEXT[] := ARRAY['bloqueada', 'rejeitada', 'cancelada'];
  v_from     TEXT := NEW.from_status;
  v_to       TEXT := NEW.to_status;
  v_demanda  demandas%ROWTYPE;
  v_idx_from INT;
  v_idx_to   INT;
BEGIN
  SELECT * INTO v_demanda FROM demandas WHERE id = NEW.demanda_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Demanda % não encontrada.', NEW.demanda_id USING ERRCODE = 'P0001';
  END IF;

  -- Idempotência
  IF v_from IS NOT DISTINCT FROM v_to THEN
    RETURN NULL;
  END IF;

  -- Status terminal
  IF v_demanda.situacao = ANY(v_terminais) THEN
    RAISE EXCEPTION 'Demanda já está em status terminal (%). Nenhuma transição adicional é permitida.', v_demanda.situacao USING ERRCODE = 'P0001';
  END IF;

  -- Justificativa: NÃO é mais obrigatória em nenhum status.

  -- Adjacência no fluxo
  IF v_from IS NOT NULL THEN
    IF v_to = ANY(v_especiais) THEN
      NULL;
    ELSIF v_from = ANY(v_especiais) THEN
      NULL;
    ELSE
      v_idx_from := array_position(v_flow, v_from);
      v_idx_to   := array_position(v_flow, v_to);
      IF v_idx_from IS NOT NULL AND v_idx_to IS NOT NULL THEN
        IF v_idx_to > v_idx_from + 1 THEN
          RAISE EXCEPTION 'Transição inválida: não é possível avançar de "%" diretamente para "%". Siga o fluxo principal.', v_from, v_to USING ERRCODE = 'P0001';
        END IF;
      END IF;
    END IF;
  ELSE
    IF v_to <> 'fila_atendimento' THEN
      RAISE EXCEPTION 'Primeira transição de uma demanda deve ser para "fila_atendimento", recebido: "%".', v_to USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_validate_demanda_transition IS
  'v3: Justificativa NÃO é mais obrigatória em nenhuma transição. Demais regras (terminal, adjacência, primeira transição) preservadas.';