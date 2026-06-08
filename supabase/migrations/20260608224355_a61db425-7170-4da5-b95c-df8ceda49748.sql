
-- ============================================================
-- Security hardening: fix scanner findings
-- ============================================================

-- 1) profiles: drop blanket authenticated read; scoped policies remain
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON public.profiles;

-- 1b) Prevent privilege escalation via profiles.module_access
CREATE OR REPLACE FUNCTION public.fn_protect_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.module_access IS DISTINCT FROM OLD.module_access
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change module_access';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.fn_protect_profile_privileged_fields();

-- 2) contract_room_teams: restrict reads to team members / admins
DROP POLICY IF EXISTS "Members view contract_room_teams" ON public.contract_room_teams;
CREATE POLICY "Members view contract_room_teams"
ON public.contract_room_teams
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);

-- 3) contracts: scope reads to admins or team members linked via contract_room_teams;
--    restrict writes to admins
DROP POLICY IF EXISTS contracts_select ON public.contracts;
DROP POLICY IF EXISTS contracts_insert ON public.contracts;
DROP POLICY IF EXISTS contracts_update ON public.contracts;

CREATE POLICY contracts_select
ON public.contracts
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (
    SELECT 1 FROM public.contract_room_teams crt
    JOIN public.team_members tm ON tm.team_id = crt.team_id
    WHERE crt.contract_id = contracts.id AND tm.user_id = auth.uid()
  )
);

CREATE POLICY contracts_insert
ON public.contracts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY contracts_update
ON public.contracts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) user_module_roles: replace mutable-field admin check with role-based check
DROP POLICY IF EXISTS umr_admin_all ON public.user_module_roles;
CREATE POLICY umr_admin_all
ON public.user_module_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5) user_management_audit_log: same fix
DROP POLICY IF EXISTS admin_select_audit_log ON public.user_management_audit_log;
CREATE POLICY admin_select_audit_log
ON public.user_management_audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 6) demanda_hours: add missing UPDATE policy for owners on their team
CREATE POLICY "Member update own demanda_hours"
ON public.demanda_hours
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id = demanda_hours.demanda_id
      AND public.is_team_member(auth.uid(), d.team_id)
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id = demanda_hours.demanda_id
      AND public.is_team_member(auth.uid(), d.team_id)
  )
);
