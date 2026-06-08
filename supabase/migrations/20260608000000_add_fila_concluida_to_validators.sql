-- Migration: 20260608000000_add_fila_concluida_to_validators
-- Introduz o status 'fila_concluida' ("Concluída") como estado válido
-- nas funções de validação de transição e histórico de demandas.
-- NÃO altera as migrations 20260520060000 e 20260601000000.

CREATE OR REPLACE FUNCTION validate_demanda_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  valid_statuses TEXT[] := ARRAY[
    'fila_atendimento',
    'planejamento_elaboracao',
    'planejamento_ag_aprovacao',
    'planejamento_aprovada',
    'em_execucao',
    'bloqueada',
    'hom_ag_homologacao',
    'hom_homologada',
    'rejeitada',
    'fila_producao',
    'ag_aceite_final',
    'cancelada',
    'fila_concluida'  -- NOVO: status "Concluída"
  ];
BEGIN
  -- Valida se o novo status pertence ao conjunto de estados permitidos
  IF NEW.situacao IS NOT NULL AND NOT (NEW.situacao = ANY(valid_statuses)) THEN
    RAISE EXCEPTION 'Status inválido: %. Status permitidos: %',
      NEW.situacao, array_to_string(valid_statuses, ', ');
  END IF;

  -- Registra a transição no histórico quando a situação muda
  IF (TG_OP = 'UPDATE' AND OLD.situacao IS DISTINCT FROM NEW.situacao) THEN
    INSERT INTO demanda_transitions (demanda_id, from_status, to_status, user_id, justificativa)
    VALUES (
      NEW.id,
      OLD.situacao,
      NEW.situacao,
      auth.uid(),
      NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Garante que a trigger está ativa na tabela demandas
DROP TRIGGER IF EXISTS trg_validate_demanda_transition ON demandas;
CREATE TRIGGER trg_validate_demanda_transition
  BEFORE INSERT OR UPDATE ON demandas
  FOR EACH ROW
  EXECUTE FUNCTION validate_demanda_transition();

COMMENT ON FUNCTION validate_demanda_transition() IS
  'Valida transições de status de demandas. Inclui fila_concluida desde 2026-06-08.';
