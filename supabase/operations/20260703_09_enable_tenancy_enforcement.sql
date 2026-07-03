-- One-off production operation: enable tenancy enforcement.
-- Run manually in Lovable Cloud SQL Editor only after explicit approval,
-- backup, activation window, and rollback readiness are confirmed.
-- This operation intentionally calls public.set_tenancy_enforcement(true).
-- Keep supabase/operations/20260703_09_disable_tenancy_enforcement_rollback.sql
-- ready before running this file.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('axionn:20260703:09_enable_tenancy_enforcement'));

DO $$
DECLARE
  v_missing text;
  v_readiness_affected_rows bigint;
BEGIN
  SELECT string_agg(object_name, ', ' ORDER BY object_name)
    INTO v_missing
  FROM (
    VALUES
      ('table public.audit_log', to_regclass('public.audit_log') IS NOT NULL),
      ('table public.organizations', to_regclass('public.organizations') IS NOT NULL),
      ('table public.organization_members', to_regclass('public.organization_members') IS NOT NULL),
      ('table public.platform_user_roles', to_regclass('public.platform_user_roles') IS NOT NULL),
      ('table public.saas_runtime_settings', to_regclass('public.saas_runtime_settings') IS NOT NULL),
      ('function public.can_read_contract_v2(uuid,uuid)', to_regprocedure('public.can_read_contract_v2(uuid,uuid)') IS NOT NULL),
      ('function public.can_operate_contract_v2(uuid,uuid)', to_regprocedure('public.can_operate_contract_v2(uuid,uuid)') IS NOT NULL),
      ('function public.get_accessible_companies_v2(uuid)', to_regprocedure('public.get_accessible_companies_v2(uuid)') IS NOT NULL),
      ('function public.get_accessible_contracts_v2(uuid)', to_regprocedure('public.get_accessible_contracts_v2(uuid)') IS NOT NULL),
      ('function public.get_accessible_projects_v2(uuid,uuid)', to_regprocedure('public.get_accessible_projects_v2(uuid,uuid)') IS NOT NULL),
      ('function public.get_accessible_teams_v2(uuid)', to_regprocedure('public.get_accessible_teams_v2(uuid)') IS NOT NULL),
      ('function public.get_my_organizations_v2()', to_regprocedure('public.get_my_organizations_v2()') IS NOT NULL),
      ('function public.get_tenancy_readiness_report()', to_regprocedure('public.get_tenancy_readiness_report()') IS NOT NULL),
      ('function public.is_tenancy_enforced()', to_regprocedure('public.is_tenancy_enforced()') IS NOT NULL),
      ('function public.set_tenancy_enforcement(boolean)', to_regprocedure('public.set_tenancy_enforcement(boolean)') IS NOT NULL)
  ) AS required(object_name, present)
  WHERE NOT present;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required enforcement-activation dependencies: %', v_missing;
  END IF;

  IF public.is_tenancy_enforced() THEN
    RAISE EXCEPTION 'Tenancy enforcement is already enabled; aborting duplicate activation.';
  END IF;

  SELECT coalesce(sum(affected_rows), 0)::bigint
    INTO v_readiness_affected_rows
  FROM public.get_tenancy_readiness_report();

  IF v_readiness_affected_rows <> 0 THEN
    RAISE EXCEPTION 'Tenancy enforcement activation blocked: readiness report has % affected rows.', v_readiness_affected_rows;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organizations organization
    WHERE organization.status IN ('active', 'trial')
      AND NOT EXISTS (
        SELECT 1
        FROM public.organization_members member
        WHERE member.org_id = organization.id
          AND member.role IN ('owner', 'admin')
      )
  ) THEN
    RAISE EXCEPTION 'Tenancy enforcement activation blocked: active/trial organization without owner/admin.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.platform_user_roles role
    WHERE role.role = 'platform_admin'
  ) THEN
    RAISE EXCEPTION 'Tenancy enforcement activation blocked: no platform_admin exists.';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Tenancy enforcement activation blocked: service_role cannot toggle enforcement.';
  END IF;

  IF has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Tenancy enforcement activation blocked: client role can toggle enforcement.';
  END IF;
END;
$$;

SELECT public.set_tenancy_enforcement(true);

DO $$
DECLARE
  v_enabled boolean;
  v_setting_enabled boolean;
  v_readiness_affected_rows bigint;
BEGIN
  SELECT public.is_tenancy_enforced() INTO v_enabled;

  SELECT coalesce(
    (
      SELECT lower(value ->> 'enabled') = 'true'
      FROM public.saas_runtime_settings
      WHERE key = 'tenancy_enforcement'
    ),
    false
  ) INTO v_setting_enabled;

  IF v_enabled IS DISTINCT FROM true OR v_setting_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Post-activation validation failed: enforcement flag is not enabled.';
  END IF;

  SELECT coalesce(sum(affected_rows), 0)::bigint
    INTO v_readiness_affected_rows
  FROM public.get_tenancy_readiness_report();

  IF v_readiness_affected_rows <> 0 THEN
    RAISE EXCEPTION 'Post-activation validation failed: readiness report has % affected rows.', v_readiness_affected_rows;
  END IF;
END;
$$;

COMMIT;

WITH readiness AS (
  SELECT *
  FROM public.get_tenancy_readiness_report()
),
readiness_summary AS (
  SELECT
    count(*)::bigint AS readiness_checks,
    coalesce(sum(affected_rows), 0)::bigint AS readiness_affected_rows
  FROM readiness
),
setting AS (
  SELECT coalesce(
    (
      SELECT lower(value ->> 'enabled') = 'true'
      FROM public.saas_runtime_settings
      WHERE key = 'tenancy_enforcement'
    ),
    false
  ) AS tenancy_setting_enabled
)
SELECT
  public.is_tenancy_enforced() AS tenancy_enforcement_enabled,
  setting.tenancy_setting_enabled,
  readiness_summary.readiness_checks,
  readiness_summary.readiness_affected_rows,
  has_function_privilege('service_role', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') AS service_role_can_toggle_enforcement,
  NOT has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') AS authenticated_cannot_toggle_enforcement,
  NOT has_function_privilege('anon', 'public.get_my_organizations_v2()', 'EXECUTE') AS anon_cannot_call_tenant_rpcs,
  'If any critical issue appears, immediately run supabase/operations/20260703_09_disable_tenancy_enforcement_rollback.sql.'::text AS rollback_instruction,
  (
    public.is_tenancy_enforced() IS TRUE
    AND setting.tenancy_setting_enabled IS TRUE
    AND readiness_summary.readiness_checks = 9
    AND readiness_summary.readiness_affected_rows = 0
    AND has_function_privilege('service_role', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.get_my_organizations_v2()', 'EXECUTE')
  ) AS tenancy_enforcement_activation_ok
FROM readiness_summary
CROSS JOIN setting;
