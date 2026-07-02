CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
      AND lower(role) = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_contract_admin(_user_id uuid, _contract_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1
    FROM public.contract_members
    WHERE user_id = _user_id
      AND contract_id = _contract_id
      AND lower(role) = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_manager(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR public.is_team_admin(_user_id, _team_id)
      OR EXISTS (
        SELECT 1
        FROM public.teams team
        JOIN public.contract_members member ON member.contract_id = team.contract_id
        WHERE team.id = _team_id
          AND member.user_id = _user_id
          AND lower(member.role) = 'admin'
      );
$$;

CREATE OR REPLACE FUNCTION public.can_view_team(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR public.is_team_member(_user_id, _team_id)
      OR public.is_team_in_user_contracts(_user_id, _team_id);
$$;

CREATE OR REPLACE FUNCTION public.is_demanda_responsible(_user_id uuid, _demanda_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.demandas demand
    WHERE demand.id = _demanda_id
      AND (
        demand.responsavel_dev = _user_id
        OR demand.responsavel_requisitos = _user_id
        OR demand.responsavel_arquiteto = _user_id
        OR demand.responsavel_teste = _user_id
        OR demand.aceite_responsavel = _user_id
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.demanda_responsaveis responsible
    WHERE responsible.demanda_id = _demanda_id
      AND responsible.user_id = _user_id
  );
$$;

-- Remove policies temporárias e versões anteriores dos nomes consolidados.
DROP POLICY IF EXISTS "temp_authenticated_select_demandas" ON public.demandas;
DROP POLICY IF EXISTS "temp_authenticated_select_sprints" ON public.sprints;
DROP POLICY IF EXISTS "temp_authenticated_select_teams" ON public.teams;
DROP POLICY IF EXISTS "temp_authenticated_select_epics" ON public.epics;
DROP POLICY IF EXISTS "temp_authenticated_select_activity_comments" ON public.activity_comments;
DROP POLICY IF EXISTS "temp_authenticated_select_contracts" ON public.contracts;

DROP POLICY IF EXISTS "contract_members_can_select_demandas" ON public.demandas;
DROP POLICY IF EXISTS "contract_members_can_insert_demandas" ON public.demandas;
DROP POLICY IF EXISTS "contract_members_can_update_demandas" ON public.demandas;
DROP POLICY IF EXISTS "contract_members_can_delete_demandas" ON public.demandas;
DROP POLICY IF EXISTS "demandas_select_team_or_contract" ON public.demandas;
DROP POLICY IF EXISTS "demandas_insert_team_member" ON public.demandas;
DROP POLICY IF EXISTS "demandas_update_manager_or_responsible" ON public.demandas;
DROP POLICY IF EXISTS "demandas_delete_manager" ON public.demandas;

CREATE POLICY "demandas_select_team_or_contract"
ON public.demandas FOR SELECT TO authenticated
USING (public.can_view_team(auth.uid(), team_id));

CREATE POLICY "demandas_insert_team_member"
ON public.demandas FOR INSERT TO authenticated
WITH CHECK (public.can_view_team(auth.uid(), team_id));

CREATE POLICY "demandas_update_manager_or_responsible"
ON public.demandas FOR UPDATE TO authenticated
USING (
  public.is_team_manager(auth.uid(), team_id)
  OR public.is_demanda_responsible(auth.uid(), id)
)
WITH CHECK (
  public.is_team_manager(auth.uid(), team_id)
  OR public.is_demanda_responsible(auth.uid(), id)
);

CREATE POLICY "demandas_delete_manager"
ON public.demandas FOR DELETE TO authenticated
USING (public.is_team_manager(auth.uid(), team_id));

DROP POLICY IF EXISTS "contract_members_can_select_user_stories" ON public.user_stories;
DROP POLICY IF EXISTS "contract_members_can_insert_user_stories" ON public.user_stories;
DROP POLICY IF EXISTS "contract_members_can_update_user_stories" ON public.user_stories;
DROP POLICY IF EXISTS "contract_members_can_delete_user_stories" ON public.user_stories;
DROP POLICY IF EXISTS "user_stories_select" ON public.user_stories;
DROP POLICY IF EXISTS "user_stories_insert" ON public.user_stories;
DROP POLICY IF EXISTS "user_stories_update" ON public.user_stories;
DROP POLICY IF EXISTS "user_stories_delete" ON public.user_stories;

CREATE POLICY "user_stories_select"
ON public.user_stories FOR SELECT TO authenticated
USING (public.can_view_team(auth.uid(), team_id));

CREATE POLICY "user_stories_insert"
ON public.user_stories FOR INSERT TO authenticated
WITH CHECK (public.can_view_team(auth.uid(), team_id));

CREATE POLICY "user_stories_update"
ON public.user_stories FOR UPDATE TO authenticated
USING (
  public.is_team_manager(auth.uid(), team_id)
  OR assignee_id = auth.uid()
)
WITH CHECK (
  public.is_team_manager(auth.uid(), team_id)
  OR assignee_id = auth.uid()
);

CREATE POLICY "user_stories_delete"
ON public.user_stories FOR DELETE TO authenticated
USING (public.is_team_manager(auth.uid(), team_id));

DROP POLICY IF EXISTS "contract_members_can_select_activities" ON public.activities;
DROP POLICY IF EXISTS "contract_members_can_insert_activities" ON public.activities;
DROP POLICY IF EXISTS "contract_members_can_update_activities" ON public.activities;
DROP POLICY IF EXISTS "contract_members_can_delete_activities" ON public.activities;
DROP POLICY IF EXISTS "activities_select" ON public.activities;
DROP POLICY IF EXISTS "activities_insert" ON public.activities;
DROP POLICY IF EXISTS "activities_update" ON public.activities;
DROP POLICY IF EXISTS "activities_delete" ON public.activities;

CREATE POLICY "activities_select"
ON public.activities FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_stories story
    WHERE story.id = activities.hu_id
      AND public.can_view_team(auth.uid(), story.team_id)
  )
);

CREATE POLICY "activities_insert"
ON public.activities FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_stories story
    WHERE story.id = activities.hu_id
      AND public.can_view_team(auth.uid(), story.team_id)
  )
);

CREATE POLICY "activities_update"
ON public.activities FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_stories story
    WHERE story.id = activities.hu_id
      AND (
        public.is_team_manager(auth.uid(), story.team_id)
        OR activities.assignee_id = auth.uid()
        OR story.assignee_id = auth.uid()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_stories story
    WHERE story.id = activities.hu_id
      AND (
        public.is_team_manager(auth.uid(), story.team_id)
        OR activities.assignee_id = auth.uid()
        OR story.assignee_id = auth.uid()
      )
  )
);

CREATE POLICY "activities_delete"
ON public.activities FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.user_stories story
    WHERE story.id = activities.hu_id
      AND public.is_team_manager(auth.uid(), story.team_id)
  )
);

DROP POLICY IF EXISTS "contract_members_can_select_sprints" ON public.sprints;
DROP POLICY IF EXISTS "contract_members_can_insert_sprints" ON public.sprints;
DROP POLICY IF EXISTS "contract_members_can_update_sprints" ON public.sprints;
DROP POLICY IF EXISTS "contract_members_can_delete_sprints" ON public.sprints;
DROP POLICY IF EXISTS "sprints_select" ON public.sprints;
DROP POLICY IF EXISTS "sprints_insert" ON public.sprints;
DROP POLICY IF EXISTS "sprints_update" ON public.sprints;
DROP POLICY IF EXISTS "sprints_delete" ON public.sprints;

CREATE POLICY "sprints_select"
ON public.sprints FOR SELECT TO authenticated
USING (public.can_view_team(auth.uid(), team_id));

CREATE POLICY "sprints_insert"
ON public.sprints FOR INSERT TO authenticated
WITH CHECK (public.is_team_manager(auth.uid(), team_id));

CREATE POLICY "sprints_update"
ON public.sprints FOR UPDATE TO authenticated
USING (public.is_team_manager(auth.uid(), team_id))
WITH CHECK (public.is_team_manager(auth.uid(), team_id));

CREATE POLICY "sprints_delete"
ON public.sprints FOR DELETE TO authenticated
USING (public.is_team_manager(auth.uid(), team_id));

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'epics'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.epics', policy_record.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "epics_select"
ON public.epics FOR SELECT TO authenticated
USING (public.can_view_team(auth.uid(), team_id));

CREATE POLICY "epics_insert"
ON public.epics FOR INSERT TO authenticated
WITH CHECK (public.can_view_team(auth.uid(), team_id));

CREATE POLICY "epics_update"
ON public.epics FOR UPDATE TO authenticated
USING (public.is_team_manager(auth.uid(), team_id))
WITH CHECK (public.is_team_manager(auth.uid(), team_id));

CREATE POLICY "epics_delete"
ON public.epics FOR DELETE TO authenticated
USING (public.is_team_manager(auth.uid(), team_id));

DROP POLICY IF EXISTS "contract_members_can_select_teams" ON public.teams;
DROP POLICY IF EXISTS "teams_select_member" ON public.teams;
DROP POLICY IF EXISTS "teams_select_admin" ON public.teams;
DROP POLICY IF EXISTS "teams_select" ON public.teams;

CREATE POLICY "teams_select"
ON public.teams FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.is_team_member(auth.uid(), id)
  OR public.is_contract_member(auth.uid(), contract_id)
);

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'contracts'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.contracts', policy_record.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "contracts_select_member"
ON public.contracts FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.is_contract_member(auth.uid(), id)
  OR EXISTS (
    SELECT 1
    FROM public.teams team
    JOIN public.team_members member ON member.team_id = team.id
    WHERE team.contract_id = contracts.id
      AND member.user_id = auth.uid()
  )
);

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'activity_comments'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.activity_comments', policy_record.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "activity_comments_select"
ON public.activity_comments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.activities activity
    JOIN public.user_stories story ON story.id = activity.hu_id
    WHERE activity.id = activity_comments.activity_id
      AND public.can_view_team(auth.uid(), story.team_id)
  )
);
