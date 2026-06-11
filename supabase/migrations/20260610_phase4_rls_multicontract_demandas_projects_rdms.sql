-- ============================================================
-- FASE 4: RLS multi-contrato — demandas, projects, rdms
-- Data: 2026-06-10
-- Depêndencia: Fase 3 (get_user_contract_id já existe)
-- Premissa:
--   demandas.contract_id  — FK direta (nullable, desnormalizada)
--   projects.contract_id  — FK NOT NULL
--   rdms.project_id       — FK nullable
--   Admin check: public.has_role(auth.uid(), 'admin')
-- ============================================================

-- ============================================================
-- 1. DEMANDAS
--    contract_id direto — caminho mais simples
-- ============================================================
DROP POLICY IF EXISTS "demandas_select_multicontract" ON public.demandas;
CREATE POLICY "demandas_select_multicontract"
  ON public.demandas FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR
    -- demanda já migrada: contract_id preenchido
    contract_id = get_user_contract_id()
    OR
    -- demanda legada: sem contract_id, vai via team
    (
      contract_id IS NULL
      AND team_id IN (
        SELECT id FROM teams
        WHERE contract_id = get_user_contract_id()
           OR contract_id IS NULL
      )
    )
  );

-- INSERT: membro só insere no seu próprio contrato
DROP POLICY IF EXISTS "demandas_insert_multicontract" ON public.demandas;
CREATE POLICY "demandas_insert_multicontract"
  ON public.demandas FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR contract_id = get_user_contract_id()
    OR contract_id IS NULL
  );

-- UPDATE: membro só atualiza demandas do seu contrato
DROP POLICY IF EXISTS "demandas_update_multicontract" ON public.demandas;
CREATE POLICY "demandas_update_multicontract"
  ON public.demandas FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR contract_id = get_user_contract_id()
    OR (
      contract_id IS NULL
      AND team_id IN (
        SELECT id FROM teams
        WHERE contract_id = get_user_contract_id()
           OR contract_id IS NULL
      )
    )
  );

-- ============================================================
-- 2. PROJECTS
--    Substitui policies da Fase 2 que usavam is_admin() (inexistente)
--    pela função correta has_role()
-- ============================================================
DROP POLICY IF EXISTS "projects_admin_all"       ON public.projects;
DROP POLICY IF EXISTS "projects_member_select"   ON public.projects;
DROP POLICY IF EXISTS "projects_insert"          ON public.projects;
DROP POLICY IF EXISTS "projects_update"          ON public.projects;

-- Admin gerencia tudo
CREATE POLICY "projects_admin_all"
  ON public.projects FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Membro vê projetos do seu contrato
CREATE POLICY "projects_member_select"
  ON public.projects FOR SELECT
  USING (
    contract_id = get_user_contract_id()
  );

-- Membro não insere nem atualiza projetos (só admin)
-- (sem policies adicionais de INSERT/UPDATE para member)

-- ============================================================
-- 3. RDMS
--    Sem contract_id direto — navega via project_id
-- ============================================================
ALTER TABLE public.rdms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rdms_select_multicontract" ON public.rdms;
CREATE POLICY "rdms_select_multicontract"
  ON public.rdms FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR
    -- rdm já vinculado a projeto: navega via project.contract_id
    project_id IN (
      SELECT id FROM projects
      WHERE contract_id = get_user_contract_id()
    )
    OR
    -- rdm legado sem project_id: vai via team_id
    (
      project_id IS NULL
      AND team_id IN (
        SELECT id FROM teams
        WHERE contract_id = get_user_contract_id()
           OR contract_id IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "rdms_insert_multicontract" ON public.rdms;
CREATE POLICY "rdms_insert_multicontract"
  ON public.rdms FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR project_id IN (
      SELECT id FROM projects
      WHERE contract_id = get_user_contract_id()
    )
    OR project_id IS NULL
  );

DROP POLICY IF EXISTS "rdms_update_multicontract" ON public.rdms;
CREATE POLICY "rdms_update_multicontract"
  ON public.rdms FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR project_id IN (
      SELECT id FROM projects
      WHERE contract_id = get_user_contract_id()
    )
    OR (
      project_id IS NULL
      AND team_id IN (
        SELECT id FROM teams
        WHERE contract_id = get_user_contract_id()
           OR contract_id IS NULL
      )
    )
  );

-- ============================================================
-- ÍNDICES de suporte
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_rdms_project_id
  ON public.rdms (project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rdms_team_id
  ON public.rdms (team_id);

-- ============================================================
-- FIM
-- Migration: 20260610_phase4_rls_multicontract_demandas_projects_rdms.sql
-- ============================================================
