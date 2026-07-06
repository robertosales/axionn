-- ============================================================
-- FASE 5a: EXPAND — projects recebe team_id + view de compatibilidade
-- Data: 2026-06-10
-- ============================================================

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS team_id uuid
    REFERENCES public.teams(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.projects.team_id IS
  'FK nullable para o time principal do projeto durante a transição do modelo legado.';

CREATE INDEX IF NOT EXISTS idx_projects_team_id
  ON public.projects (team_id)
  WHERE team_id IS NOT NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS sla_id uuid
    REFERENCES public.contract_slas(id) ON DELETE SET NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS legacy_projetos_id uuid;

CREATE INDEX IF NOT EXISTS idx_projects_legacy_projetos_id
  ON public.projects (legacy_projetos_id)
  WHERE legacy_projetos_id IS NOT NULL;

CREATE OR REPLACE VIEW public.vw_projetos
WITH (security_invoker = true)
AS
  SELECT
    legacy.id,
    legacy.team_id,
    legacy.nome,
    legacy.descricao,
    legacy.equipe,
    legacy.sla,
    legacy.sla_id,
    legacy.contract_id,
    legacy.created_at,
    legacy.updated_at,
    contract.name AS contract_name,
    'legacy'::text AS source
  FROM public.projetos legacy
  LEFT JOIN public.contracts contract ON contract.id = legacy.contract_id

  UNION ALL

  SELECT
    project.id,
    project.team_id,
    project.name AS nome,
    project.description AS descricao,
    NULL::text AS equipe,
    CASE
      WHEN project.sla_id IS NOT NULL THEN 'customizado'
      ELSE 'padrao'
    END AS sla,
    project.sla_id,
    project.contract_id,
    project.created_at,
    project.updated_at,
    contract.name AS contract_name,
    'new'::text AS source
  FROM public.projects project
  LEFT JOIN public.contracts contract ON contract.id = project.contract_id
  WHERE project.legacy_projetos_id IS NULL
    AND project.status = 'active';

GRANT SELECT ON public.vw_projetos TO authenticated, service_role;

DROP POLICY IF EXISTS "projects_member_select" ON public.projects;
CREATE POLICY "projects_member_select"
  ON public.projects FOR SELECT
  USING (
    contract_id = public.get_user_contract_id()
    OR team_id IN (
      SELECT member.team_id
      FROM public.team_members member
      WHERE member.user_id = auth.uid()
    )
  );
