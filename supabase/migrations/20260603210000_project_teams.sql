-- Vínculo legado entre projetos e times existentes.

CREATE TABLE IF NOT EXISTS public.project_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'sustentacao'
    CHECK (role IN ('agile', 'sustentacao')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, team_id)
);

COMMENT ON TABLE public.project_teams IS
  'Vincula times existentes a projetos do fluxo legado de sustentação.';

CREATE INDEX IF NOT EXISTS idx_project_teams_project_id
  ON public.project_teams(project_id);
CREATE INDEX IF NOT EXISTS idx_project_teams_team_id
  ON public.project_teams(team_id);

ALTER TABLE public.project_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_teams_select ON public.project_teams;
DROP POLICY IF EXISTS project_teams_manage ON public.project_teams;

CREATE POLICY project_teams_select
ON public.project_teams FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR public.is_team_member(auth.uid(), team_id)
);

CREATE POLICY project_teams_manage
ON public.project_teams FOR ALL TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.team_members member
    WHERE member.team_id = project_teams.team_id
      AND member.user_id = auth.uid()
      AND member.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.team_members member
    WHERE member.team_id = project_teams.team_id
      AND member.user_id = auth.uid()
      AND member.role IN ('owner', 'admin')
  )
);
