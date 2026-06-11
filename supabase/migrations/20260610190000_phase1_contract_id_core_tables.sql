-- ============================================================
-- MIGRATION: Fase 1 — contract_id nas tabelas core
-- Data: 2026-06-10
-- Estratégia: ADDITIVE ONLY — sem DROP, sem ALTER breaking
--             Sistema em produção: nullable primeiro, NOT NULL depois
-- ============================================================

-- ============================================================
-- 1. TEAMS — contract_id já existe (adicionado em 20260603)
--    Garantir que o índice existe e adicionar room_type como alias
-- ============================================================

-- Nada a adicionar em teams.contract_id — já existe e é FK para contracts.
-- Apenas garantir o índice (já criado, mas idempotente):
CREATE INDEX IF NOT EXISTS idx_teams_contract_id
  ON public.teams (contract_id)
  WHERE contract_id IS NOT NULL;

COMMENT ON COLUMN public.teams.contract_id IS
  'FK para o contrato dono deste time/sala. Nullable para compatibilidade com registros legados.';


-- ============================================================
-- 2. PROJECTS — adicionar contract_id
-- ============================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS contract_id UUID
    REFERENCES public.contracts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.projects.contract_id IS
  'FK para o contrato dono deste projeto. Nullable — projetos legados sem contrato continuam funcionando.';

CREATE INDEX IF NOT EXISTS idx_projects_contract_id
  ON public.projects (contract_id)
  WHERE contract_id IS NOT NULL;


-- ============================================================
-- 3. DEMANDAS — adicionar contract_id (derivado do team/sala)
--    Permite queries diretas por contrato sem precisar JOIN teams
-- ============================================================

ALTER TABLE public.demandas
  ADD COLUMN IF NOT EXISTS contract_id UUID
    REFERENCES public.contracts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.demandas.contract_id IS
  'FK de atalho para o contrato. Derivado de demandas.team_id -> teams.contract_id. '
  'Nullable — populado via backfill abaixo para registros existentes.';

CREATE INDEX IF NOT EXISTS idx_demandas_contract_id
  ON public.demandas (contract_id)
  WHERE contract_id IS NOT NULL;


-- ============================================================
-- 4. USER_STORIES (sprints/kanban) — adicionar contract_id
-- ============================================================

ALTER TABLE public.user_stories
  ADD COLUMN IF NOT EXISTS contract_id UUID
    REFERENCES public.contracts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.user_stories.contract_id IS
  'FK para o contrato dono desta user story. Derivado via team -> contract.';

CREATE INDEX IF NOT EXISTS idx_user_stories_contract_id
  ON public.user_stories (contract_id)
  WHERE contract_id IS NOT NULL;


-- ============================================================
-- 5. BACKFILL — propagar contract_id nos registros existentes
--    Seguro: só atualiza onde team tem contract_id definido
-- ============================================================

-- 5a. demandas via team_id
UPDATE public.demandas d
   SET contract_id = t.contract_id
  FROM public.teams t
 WHERE d.team_id    = t.id
   AND t.contract_id IS NOT NULL
   AND d.contract_id IS NULL;

-- 5b. user_stories via team_id (coluna pode ser team_id ou sprint -> team)
--    Tenta via team_id direto se existir na tabela
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'user_stories'
       AND column_name  = 'team_id'
  ) THEN
    UPDATE public.user_stories us
       SET contract_id = t.contract_id
      FROM public.teams t
     WHERE us.team_id      = t.id
       AND t.contract_id   IS NOT NULL
       AND us.contract_id  IS NULL;
  END IF;
END;
$$;

-- 5c. projects — se tiver team_id, propaga
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'projects'
       AND column_name  = 'team_id'
  ) THEN
    UPDATE public.projects p
       SET contract_id = t.contract_id
      FROM public.teams t
     WHERE p.team_id     = t.id
       AND t.contract_id IS NOT NULL
       AND p.contract_id IS NULL;
  END IF;
END;
$$;


-- ============================================================
-- 6. TRIGGER — manter contract_id sincronizado em novos registros
--    demandas: ao inserir/atualizar team_id, propaga contract_id
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_sync_demanda_contract_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.team_id IS NOT NULL THEN
    SELECT t.contract_id
      INTO NEW.contract_id
      FROM public.teams t
     WHERE t.id = NEW.team_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_demanda_sync_contract ON public.demandas;
CREATE TRIGGER trg_demanda_sync_contract
  BEFORE INSERT OR UPDATE OF team_id
  ON public.demandas
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_demanda_contract_id();


-- ============================================================
-- 7. VIEW de diagnóstico — mostra cobertura do contract_id
--    Útil para monitorar o backfill em produção
-- ============================================================

CREATE OR REPLACE VIEW public.vw_contract_coverage AS
SELECT
  'teams'        AS tabela,
  COUNT(*)       AS total,
  COUNT(contract_id) AS com_contrato,
  COUNT(*) - COUNT(contract_id) AS sem_contrato
FROM public.teams
UNION ALL
SELECT
  'demandas',
  COUNT(*),
  COUNT(contract_id),
  COUNT(*) - COUNT(contract_id)
FROM public.demandas
UNION ALL
SELECT
  'user_stories',
  COUNT(*),
  COUNT(contract_id),
  COUNT(*) - COUNT(contract_id)
FROM public.user_stories
UNION ALL
SELECT
  'projects',
  COUNT(*),
  COUNT(contract_id),
  COUNT(*) - COUNT(contract_id)
FROM public.projects;

COMMENT ON VIEW public.vw_contract_coverage IS
  'Diagnóstico de cobertura do contract_id por tabela. Rode: SELECT * FROM vw_contract_coverage;';


-- ============================================================
-- FIM DA FASE 1
-- Próximo passo: Fase 2 — role admin_contrato + user_contracts
--
-- Para verificar cobertura após aplicar:
--   SELECT * FROM public.vw_contract_coverage;
-- ============================================================
