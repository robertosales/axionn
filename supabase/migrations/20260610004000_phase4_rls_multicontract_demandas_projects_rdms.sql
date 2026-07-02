-- ============================================================
-- FASE 4: RLS multi-contrato — demandas, projects, rdms
-- Data: 2026-06-10
-- Dependência: Fase 3 (get_user_contract_id)
-- ============================================================

DROP POLICY IF EXISTS "demandas_select_multicontract" ON public.demandas;
CREATE POLICY "demandas_select_multicontract"
  ON public.demandas FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR contract_id = public.get_user_contract_id()
    OR (
      contract_id IS NULL
      AND team_id IN (
        SELECT team.id
        FROM public.teams team
        WHERE team.contract_id = public.get_user_contract_id()
           OR team.contract_id IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "demandas_insert_multicontract" ON public.demandas;
CREATE POLICY "demandas_insert_multicontract"
  ON public.demandas FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR contract_id = public.get_user_contract_id()
    OR contract_id IS NULL
  );

DROP POLICY IF EXISTS "demandas_update_multicontract" ON public.demandas;
CREATE POLICY "demandas_update_multicontract"
  ON public.demandas FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR contract_id = public.get_user_contract_id()
    OR (
      contract_id IS NULL
      AND team_id IN (
        SELECT team.id
        FROM public.teams team
        WHERE team.contract_id = public.get_user_contract_id()
           OR team.contract_id IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "projects_admin_all" ON public.projects;
DROP POLICY IF EXISTS "projects_member_select" ON public.projects;
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
DROP POLICY IF EXISTS "projects_update" ON public.projects;

CREATE POLICY "projects_admin_all"
  ON public.projects FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "projects_member_select"
  ON public.projects FOR SELECT
  USING (contract_id = public.get_user_contract_id());

ALTER TABLE public.rdms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rdms_select_multicontract" ON public.rdms;
CREATE POLICY "rdms_select_multicontract"
  ON public.rdms FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR project_id IN (
      SELECT project.id
      FROM public.projects project
      WHERE project.contract_id = public.get_user_contract_id()
    )
    OR (
      project_id IS NULL
      AND team_id IN (
        SELECT team.id
        FROM public.teams team
        WHERE team.contract_id = public.get_user_contract_id()
           OR team.contract_id IS NULL
      )
    )
  );

DROP POLICY IF EXISTS "rdms_insert_multicontract" ON public.rdms;
CREATE POLICY "rdms_insert_multicontract"
  ON public.rdms FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR project_id IN (
      SELECT project.id
      FROM public.projects project
      WHERE project.contract_id = public.get_user_contract_id()
    )
    OR project_id IS NULL
  );

DROP POLICY IF EXISTS "rdms_update_multicontract" ON public.rdms;
CREATE POLICY "rdms_update_multicontract"
  ON public.rdms FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin')
    OR project_id IN (
      SELECT project.id
      FROM public.projects project
      WHERE project.contract_id = public.get_user_contract_id()
    )
    OR (
      project_id IS NULL
      AND team_id IN (
        SELECT team.id
        FROM public.teams team
        WHERE team.contract_id = public.get_user_contract_id()
           OR team.contract_id IS NULL
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_rdms_project_id
  ON public.rdms (project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rdms_team_id
  ON public.rdms (team_id);
