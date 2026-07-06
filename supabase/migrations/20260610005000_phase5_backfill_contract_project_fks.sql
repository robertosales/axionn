-- ============================================================
-- FASE 5: Backfill de FKs legadas
-- Data: 2026-06-10
-- Idempotente: atualiza somente registros ainda sem vínculo.
-- ============================================================

UPDATE public.demandas demand
SET
  contract_id = team.contract_id,
  updated_at = now()
FROM public.teams team
WHERE demand.team_id = team.id
  AND demand.contract_id IS NULL
  AND team.contract_id IS NOT NULL;

UPDATE public.demandas demand
SET
  project_id = team.project_id,
  updated_at = now()
FROM public.teams team
WHERE demand.team_id = team.id
  AND demand.project_id IS NULL
  AND team.project_id IS NOT NULL;

UPDATE public.rdms rdm
SET
  project_id = team.project_id,
  updated_at = now()
FROM public.teams team
WHERE rdm.team_id = team.id
  AND rdm.project_id IS NULL
  AND team.project_id IS NOT NULL;

UPDATE public.demandas demand
SET
  contract_id = project.contract_id,
  updated_at = now()
FROM public.projects project
WHERE demand.project_id = project.id
  AND demand.contract_id IS NULL
  AND project.contract_id IS NOT NULL;
