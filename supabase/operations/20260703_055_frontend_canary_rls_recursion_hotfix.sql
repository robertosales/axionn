-- One-off production operation: fix RLS recursion found during frontend canary.
-- Run manually in Lovable Cloud SQL Editor after Operation 5 validation if the
-- frontend reports: infinite recursion detected in policy for relation "contracts".
-- This keeps tenancy enforcement disabled and does not call set_tenancy_enforcement(true).

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('axionn:20260703:055_frontend_canary_rls_recursion_hotfix'));

DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(object_name, ', ' ORDER BY object_name)
    INTO v_missing
  FROM (
    VALUES
      ('table public.contract_members', to_regclass('public.contract_members') IS NOT NULL),
      ('table public.contract_room_teams', to_regclass('public.contract_room_teams') IS NOT NULL),
      ('table public.contract_slas', to_regclass('public.contract_slas') IS NOT NULL),
      ('table public.contract_teams', to_regclass('public.contract_teams') IS NOT NULL),
      ('table public.contracts', to_regclass('public.contracts') IS NOT NULL),
      ('table public.team_members', to_regclass('public.team_members') IS NOT NULL),
      ('table public.teams', to_regclass('public.teams') IS NOT NULL),
      ('function auth.uid()', to_regprocedure('auth.uid()') IS NOT NULL),
      ('function public.has_role(uuid,app_role)', to_regprocedure('public.has_role(uuid,app_role)') IS NOT NULL),
      ('function public.is_contract_member(uuid,uuid)', to_regprocedure('public.is_contract_member(uuid,uuid)') IS NOT NULL),
      ('function public.is_organization_admin(uuid,uuid)', to_regprocedure('public.is_organization_admin(uuid,uuid)') IS NOT NULL),
      ('function public.is_organization_member(uuid,uuid)', to_regprocedure('public.is_organization_member(uuid,uuid)') IS NOT NULL),
      ('function public.is_platform_admin(uuid)', to_regprocedure('public.is_platform_admin(uuid)') IS NOT NULL),
      ('function public.is_tenancy_enforced()', to_regprocedure('public.is_tenancy_enforced()') IS NOT NULL),
      ('function public.resolve_contract_org_id(uuid)', to_regprocedure('public.resolve_contract_org_id(uuid)') IS NOT NULL)
  ) AS required(object_name, present)
  WHERE NOT present;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required RLS recursion hotfix dependencies: %', v_missing;
  END IF;

  IF public.is_tenancy_enforced() THEN
    RAISE EXCEPTION 'RLS recursion hotfix must be applied with tenancy enforcement disabled.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_read_contract_v2(
  p_contract_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_contract_id IS NOT NULL
    AND p_user_id IS NOT NULL
    AND (
      public.is_platform_admin(p_user_id)
      OR public.has_role(p_user_id, 'admin'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.contracts contract
        WHERE contract.id = p_contract_id
          AND contract.org_id IS NOT NULL
          AND public.is_organization_member(contract.org_id, p_user_id)
      )
      OR public.is_contract_member(p_user_id, p_contract_id)
      OR EXISTS (
        SELECT 1
        FROM public.teams team
        JOIN public.team_members member ON member.team_id = team.id
        WHERE team.contract_id = p_contract_id
          AND member.user_id = p_user_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.contract_room_teams room_team
        JOIN public.team_members member ON member.team_id = room_team.team_id
        WHERE room_team.contract_id = p_contract_id
          AND room_team.is_active = true
          AND member.user_id = p_user_id
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_operate_contract_v2(
  p_contract_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_contract_id IS NOT NULL
    AND p_user_id IS NOT NULL
    AND (
      public.is_platform_admin(p_user_id)
      OR public.has_role(p_user_id, 'admin'::app_role)
      OR EXISTS (
        SELECT 1
        FROM public.contracts contract
        WHERE contract.id = p_contract_id
          AND contract.org_id IS NOT NULL
          AND public.is_organization_admin(contract.org_id, p_user_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.contract_members member
        WHERE member.contract_id = p_contract_id
          AND member.user_id = p_user_id
          AND member.role IN ('admin_contrato', 'gestor')
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_read_contract_v2(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_operate_contract_v2(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_contract_v2(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_operate_contract_v2(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.can_read_contract_v2(uuid, uuid) IS
  'Wrapper SECURITY DEFINER usado por policies para evitar recursao entre contracts e tabelas de vinculo.';
COMMENT ON FUNCTION public.can_operate_contract_v2(uuid, uuid) IS
  'Wrapper SECURITY DEFINER usado por policies de escrita para evitar recursao entre contracts e tabelas de vinculo.';

DROP POLICY IF EXISTS "contracts_select" ON public.contracts;
DROP POLICY IF EXISTS contracts_select ON public.contracts;
DROP POLICY IF EXISTS "contracts_select_member" ON public.contracts;
DROP POLICY IF EXISTS contracts_select_member ON public.contracts;
DROP POLICY IF EXISTS "contract_members_can_select_contract" ON public.contracts;
DROP POLICY IF EXISTS contract_members_can_select_contract ON public.contracts;

CREATE POLICY contracts_select_member
ON public.contracts FOR SELECT TO authenticated
USING (public.can_read_contract_v2(id));

DROP POLICY IF EXISTS "Members view contract_room_teams" ON public.contract_room_teams;
DROP POLICY IF EXISTS "Admins manage contract_room_teams" ON public.contract_room_teams;
DROP POLICY IF EXISTS "contract_room_teams_admin_contrato_select" ON public.contract_room_teams;
DROP POLICY IF EXISTS contract_room_teams_select_member ON public.contract_room_teams;

CREATE POLICY contract_room_teams_select_member
ON public.contract_room_teams FOR SELECT TO authenticated
USING (public.can_read_contract_v2(contract_id));

DROP POLICY IF EXISTS contract_teams_select_member ON public.contract_teams;
CREATE POLICY contract_teams_select_member
ON public.contract_teams FOR SELECT TO authenticated
USING (public.can_read_contract_v2(contract_id));

DROP POLICY IF EXISTS contract_slas_select_member ON public.contract_slas;
CREATE POLICY contract_slas_select_member
ON public.contract_slas FOR SELECT TO authenticated
USING (public.can_read_contract_v2(contract_id));

DROP POLICY IF EXISTS contract_teams_tenant_boundary ON public.contract_teams;
CREATE POLICY contract_teams_tenant_boundary
ON public.contract_teams AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  NOT public.is_tenancy_enforced()
  OR public.can_read_contract_v2(contract_id)
)
WITH CHECK (
  NOT public.is_tenancy_enforced()
  OR public.can_operate_contract_v2(contract_id)
);

DROP POLICY IF EXISTS contract_room_teams_tenant_boundary ON public.contract_room_teams;
CREATE POLICY contract_room_teams_tenant_boundary
ON public.contract_room_teams AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  NOT public.is_tenancy_enforced()
  OR public.can_read_contract_v2(contract_id)
)
WITH CHECK (
  NOT public.is_tenancy_enforced()
  OR public.can_operate_contract_v2(contract_id)
);

DROP POLICY IF EXISTS contract_slas_tenant_boundary ON public.contract_slas;
CREATE POLICY contract_slas_tenant_boundary
ON public.contract_slas AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  NOT public.is_tenancy_enforced()
  OR public.can_read_contract_v2(contract_id)
)
WITH CHECK (
  NOT public.is_tenancy_enforced()
  OR public.can_operate_contract_v2(contract_id)
);

DO $$
BEGIN
  IF public.is_tenancy_enforced() THEN
    RAISE EXCEPTION 'Post-validation failed: tenancy enforcement was enabled.';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.can_read_contract_v2(uuid, uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.can_operate_contract_v2(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Post-validation failed: authenticated cannot execute contract RLS wrappers.';
  END IF;

  IF has_function_privilege('anon', 'public.can_read_contract_v2(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.can_operate_contract_v2(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Post-validation failed: anon can execute contract RLS wrappers.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies policy
    WHERE policy.schemaname = 'public'
      AND policy.tablename IN ('contract_teams', 'contract_room_teams', 'contract_slas')
      AND policy.policyname IN (
        'contract_teams_tenant_boundary',
        'contract_room_teams_tenant_boundary',
        'contract_slas_tenant_boundary'
      )
      AND (
        coalesce(policy.qual, '') ILIKE '%FROM public.contracts%'
        OR coalesce(policy.with_check, '') ILIKE '%FROM public.contracts%'
      )
  ) THEN
    RAISE EXCEPTION 'Post-validation failed: link-table tenant policies still query public.contracts directly.';
  END IF;
END;
$$;

COMMIT;

WITH target_policies AS (
  SELECT
    policy.tablename,
    policy.policyname,
    policy.permissive,
    policy.cmd,
    policy.qual,
    policy.with_check
  FROM pg_policies policy
  WHERE policy.schemaname = 'public'
    AND policy.tablename IN ('contracts', 'contract_teams', 'contract_room_teams', 'contract_slas')
    AND policy.policyname IN (
      'contracts_select_member',
      'contract_teams_select_member',
      'contract_room_teams_select_member',
      'contract_slas_select_member',
      'contract_teams_tenant_boundary',
      'contract_room_teams_tenant_boundary',
      'contract_slas_tenant_boundary'
    )
)
SELECT
  public.is_tenancy_enforced() AS tenancy_enforcement_enabled,
  to_regprocedure('public.can_read_contract_v2(uuid,uuid)') IS NOT NULL AS can_read_contract_wrapper_installed,
  to_regprocedure('public.can_operate_contract_v2(uuid,uuid)') IS NOT NULL AS can_operate_contract_wrapper_installed,
  count(*) FILTER (WHERE tablename = 'contracts' AND policyname = 'contracts_select_member') AS contract_select_policies,
  count(*) FILTER (WHERE tablename IN ('contract_teams', 'contract_room_teams', 'contract_slas')) AS relation_policies,
  NOT EXISTS (
    SELECT 1
    FROM target_policies policy
    WHERE policy.tablename IN ('contract_teams', 'contract_room_teams', 'contract_slas')
      AND (
        coalesce(policy.qual, '') ILIKE '%FROM public.contracts%'
        OR coalesce(policy.with_check, '') ILIKE '%FROM public.contracts%'
      )
  ) AS relation_policies_do_not_query_contracts_directly,
  (
    public.is_tenancy_enforced() IS FALSE
    AND to_regprocedure('public.can_read_contract_v2(uuid,uuid)') IS NOT NULL
    AND to_regprocedure('public.can_operate_contract_v2(uuid,uuid)') IS NOT NULL
    AND count(*) FILTER (WHERE tablename = 'contracts' AND policyname = 'contracts_select_member') = 1
    AND count(*) FILTER (WHERE tablename IN ('contract_teams', 'contract_room_teams', 'contract_slas')) = 6
    AND NOT EXISTS (
      SELECT 1
      FROM target_policies policy
      WHERE policy.tablename IN ('contract_teams', 'contract_room_teams', 'contract_slas')
        AND (
          coalesce(policy.qual, '') ILIKE '%FROM public.contracts%'
          OR coalesce(policy.with_check, '') ILIKE '%FROM public.contracts%'
        )
    )
  ) AS frontend_canary_rls_recursion_hotfix_ok
FROM target_policies;
