-- ============================================================
-- MIGRATION: Backfill teams.contract_id → CONTRATO DE FABRICA PF
-- Data: 2026-06-11
-- Ambiente: PRODUÇÃO
--
-- CONTEXTO:
--   A tabela `teams` possui a coluna `contract_id` (adicionada na
--   Fase 3 do SLA Engine), porém todos os times cadastrados estão
--   com contract_id = NULL.
--
--   Todos os times ativos pertencem ao contrato:
--     id:   d59ab6dc-421f-41b4-b415-ae0bc072ebd4
--     name: CONTRATO DE FABRICA PF
--     mode: hibrido (Sala Ágil + Sustentação)
--
-- O QUE MUDA:
--   UPDATE em `teams` definindo contract_id para todos os registros
--   que ainda não possuem vínculo.
--
-- SEGURANÇA:
--   ✅ UPDATE simples — sem lock de tabela (não altera schema)
--   ✅ WHERE contract_id IS NULL — idempotente, pode rodar N vezes
--   ✅ Não afeta demandas, sprints ou qualquer outra tabela
--   ✅ fn_resolve_sla_limits() já usa t.contract_id — melhora SLA automático
--
-- ROLLBACK (se necessário):
--   UPDATE public.teams SET contract_id = NULL
--   WHERE contract_id = 'd59ab6dc-421f-41b4-b415-ae0bc072ebd4';
-- ============================================================

BEGIN;

  -- ──────────────────────────────────────────────────────────
  -- VALIDAÇÃO PRÉ-UPDATE: confirma que o contrato existe
  -- e está ativo antes de vincular qualquer time.
  -- ──────────────────────────────────────────────────────────
  DO $$
  DECLARE
    v_contract_status TEXT;
  BEGIN
    SELECT status INTO v_contract_status
    FROM   public.contracts
    WHERE  id = 'd59ab6dc-421f-41b4-b415-ae0bc072ebd4';

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'ABORT: Contrato d59ab6dc não encontrado. Migration cancelada.';
    END IF;

    IF v_contract_status != 'active' THEN
      RAISE EXCEPTION
        'ABORT: Contrato d59ab6dc está com status = %. Esperado: active. Migration cancelada.',
        v_contract_status;
    END IF;
  END;
  $$;

  -- ──────────────────────────────────────────────────────────
  -- BACKFILL: vincula todos os times sem contrato
  -- ──────────────────────────────────────────────────────────
  UPDATE public.teams
  SET
    contract_id = 'd59ab6dc-421f-41b4-b415-ae0bc072ebd4',
    updated_at  = NOW()
  WHERE contract_id IS NULL;

  -- ──────────────────────────────────────────────────────────
  -- LOG: registra quantos times foram vinculados
  -- ──────────────────────────────────────────────────────────
  DO $$
  DECLARE
    v_total   INT;
    v_sem_contrato INT;
  BEGIN
    SELECT COUNT(*) INTO v_total       FROM public.teams;
    SELECT COUNT(*) INTO v_sem_contrato FROM public.teams WHERE contract_id IS NULL;

    RAISE NOTICE
      'Backfill concluído — Total de times: %, Times ainda sem contrato: %',
      v_total, v_sem_contrato;
  END;
  $$;

COMMIT;

-- ============================================================
-- PÓS-MIGRATION: Verificação manual recomendada
--
--   SELECT id, name, module, contract_id
--   FROM   public.teams
--   ORDER  BY module, name;
--
-- Todos os times devem exibir:
--   contract_id = d59ab6dc-421f-41b4-b415-ae0bc072ebd4
-- ============================================================
