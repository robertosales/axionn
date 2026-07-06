-- ============================================================
-- FASE 3: RLS multi-contrato — teams, sprints, user_stories
-- Data: 2026-06-10
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_contract_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT team.contract_id
  FROM public.profiles profile
  JOIN public.teams team ON team.id = profile.team_id
  WHERE profile.user_id = auth.uid()
  LIMIT 1;
$$;

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "teams_select_multicontract" ON public.teams;
CREATE POLICY "teams_select_multicontract"
  ON public.teams FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR contract_id = public.get_user_contract_id()
    OR contract_id IS NULL
  );

ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sprints_select_multicontract" ON public.sprints;
CREATE POLICY "sprints_select_multicontract"
  ON public.sprints FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR team_id IN (
      SELECT team.id
      FROM public.teams team
      WHERE team.contract_id = public.get_user_contract_id()
         OR team.contract_id IS NULL
    )
  );

ALTER TABLE public.user_stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_stories_select_multicontract" ON public.user_stories;
CREATE POLICY "user_stories_select_multicontract"
  ON public.user_stories FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR sprint_id IN (
      SELECT sprint.id
      FROM public.sprints sprint
      JOIN public.teams team ON team.id = sprint.team_id
      WHERE team.contract_id = public.get_user_contract_id()
         OR team.contract_id IS NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_teams_contract_id
  ON public.teams (contract_id)
  WHERE contract_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sprints_team_id
  ON public.sprints (team_id);

CREATE INDEX IF NOT EXISTS idx_user_stories_sprint_id
  ON public.user_stories (sprint_id);
