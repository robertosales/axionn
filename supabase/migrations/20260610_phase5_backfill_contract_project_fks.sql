-- ============================================================
-- FASE 5: Backfill de FKs legadas
-- Data: 2026-06-10
-- Objetivo: preencher contract_id e project_id NULL em
--           demandas e rdms navegando pela cadeia team → project → contract.
-- Princípio: 100% idempotente (WHERE ... IS NULL garante re-run seguro).
-- ============================================================

-- ============================================================
-- 1. DEMANDAS — backfill contract_id via team.contract_id
--    Cobre demandas legadas cujo team já foi vinculado a um contrato
--    (teams.contract_id preenchido na Fase 1 / migration 20260603).
-- ============================================================
UPDATE public.demandas d
SET
  contract_id = t.contract_id,
  updated_at  = NOW()
FROM public.teams t
WHERE d.team_id      = t.id
  AND d.contract_id  IS NULL
  AND t.contract_id  IS NOT NULL;

-- ============================================================
-- 2. DEMANDAS — backfill project_id via team.project_id
--    Cobre demandas cujo team já foi vinculado a um projeto.
-- ============================================================
UPDATE public.demandas d
SET
  project_id = t.project_id,
  updated_at = NOW()
FROM public.teams t
WHERE d.team_id     = t.id
  AND d.project_id  IS NULL
  AND t.project_id  IS NOT NULL;

-- ============================================================
-- 3. RDMS — backfill project_id via team.project_id
--    Cobre rdms legados sem project_id vinculado.
-- ============================================================
UPDATE public.rdms r
SET
  project_id = t.project_id,
  updated_at = NOW()
FROM public.teams t
WHERE r.team_id     = t.id
  AND r.project_id  IS NULL
  AND t.project_id  IS NOT NULL;

-- ============================================================
-- 4. DEMANDAS — backfill contract_id via project.contract_id
--    Segunda passagem: cobre demandas que agora têm project_id
--    mas ainda não têm contract_id.
-- ============================================================
UPDATE public.demandas d
SET
  contract_id = p.contract_id,
  updated_at  = NOW()
FROM public.projects p
WHERE d.project_id  = p.id
  AND d.contract_id IS NULL
  AND p.contract_id IS NOT NULL;

-- ============================================================
-- 5. LOG de cobertura pós-backfill
--    Executa um SELECT de diagnóstico para confirmar o resultado.
--    (Não bloqueia a migration — apenas retorna para o operador.)
-- ============================================================
SELECT
  'demandas'                                                AS tabela,
  COUNT(*)                                                  AS total,
  COUNT(*) FILTER (WHERE contract_id IS NOT NULL)           AS com_contract_id,
  COUNT(*) FILTER (WHERE contract_id IS NULL)               AS sem_contract_id,
  COUNT(*) FILTER (WHERE project_id  IS NOT NULL)           AS com_project_id,
  COUNT(*) FILTER (WHERE project_id  IS NULL)               AS sem_project_id
FROM public.demandas

UNION ALL

SELECT
  'rdms'                                                    AS tabela,
  COUNT(*)                                                  AS total,
  NULL                                                      AS com_contract_id,
  NULL                                                      AS sem_contract_id,
  COUNT(*) FILTER (WHERE project_id IS NOT NULL)            AS com_project_id,
  COUNT(*) FILTER (WHERE project_id IS NULL)                AS sem_project_id
FROM public.rdms;

-- ============================================================
-- FIM
-- Migration: 20260610_phase5_backfill_contract_project_fks.sql
-- ============================================================
