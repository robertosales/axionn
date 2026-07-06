-- One-off production operation: frontend canary validation with tenant-aware RPCs.
-- Run manually in Lovable Cloud SQL Editor after Operation 4 validation.
-- This file is read-only except for transaction-local advisory lock state.
-- It does not activate tenancy enforcement and does not call set_tenancy_enforcement(true).

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('axionn:20260703:05_frontend_canary_validation'));

DO $$
DECLARE
  v_missing text;
  v_enabled boolean;
  v_setting_enabled boolean;
  v_readiness_affected_rows bigint;
BEGIN
  SELECT string_agg(object_name, ', ' ORDER BY object_name)
    INTO v_missing
  FROM (
    VALUES
      ('table public.organizations', to_regclass('public.organizations') IS NOT NULL),
      ('table public.organization_members', to_regclass('public.organization_members') IS NOT NULL),
      ('table public.platform_user_roles', to_regclass('public.platform_user_roles') IS NOT NULL),
      ('table public.saas_runtime_settings', to_regclass('public.saas_runtime_settings') IS NOT NULL),
      ('function public.is_tenancy_enforced()', to_regprocedure('public.is_tenancy_enforced()') IS NOT NULL),
      ('function public.set_tenancy_enforcement(boolean)', to_regprocedure('public.set_tenancy_enforcement(boolean)') IS NOT NULL),
      ('function public.get_tenancy_readiness_report()', to_regprocedure('public.get_tenancy_readiness_report()') IS NOT NULL),
      ('function public.get_my_organizations_v2()', to_regprocedure('public.get_my_organizations_v2()') IS NOT NULL),
      ('function public.get_accessible_teams_v2(uuid)', to_regprocedure('public.get_accessible_teams_v2(uuid)') IS NOT NULL),
      ('function public.get_accessible_companies_v2(uuid)', to_regprocedure('public.get_accessible_companies_v2(uuid)') IS NOT NULL),
      ('function public.get_accessible_contracts_v2(uuid)', to_regprocedure('public.get_accessible_contracts_v2(uuid)') IS NOT NULL),
      ('function public.get_accessible_projects_v2(uuid,uuid)', to_regprocedure('public.get_accessible_projects_v2(uuid,uuid)') IS NOT NULL)
  ) AS required(object_name, present)
  WHERE NOT present;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required frontend-canary dependencies: %', v_missing;
  END IF;

  SELECT public.is_tenancy_enforced() INTO v_enabled;
  IF coalesce(v_enabled, false) THEN
    RAISE EXCEPTION 'Frontend canary requires tenancy enforcement disabled.';
  END IF;

  SELECT coalesce(
    (
      SELECT lower(setting.value ->> 'enabled') = 'true'
      FROM public.saas_runtime_settings setting
      WHERE setting.key = 'tenancy_enforcement'
    ),
    false
  ) INTO v_setting_enabled;

  IF coalesce(v_setting_enabled, false) THEN
    RAISE EXCEPTION 'Frontend canary requires saas_runtime_settings.tenancy_enforcement.enabled = false.';
  END IF;

  SELECT coalesce(sum(affected_rows), 0)::bigint
    INTO v_readiness_affected_rows
  FROM public.get_tenancy_readiness_report();

  IF v_readiness_affected_rows <> 0 THEN
    RAISE EXCEPTION 'Frontend canary blocked: readiness report has % affected rows.', v_readiness_affected_rows;
  END IF;

  IF has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Frontend canary blocked: client role can toggle tenancy enforcement.';
  END IF;

  IF has_function_privilege('anon', 'public.get_my_organizations_v2()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_accessible_teams_v2(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_accessible_companies_v2(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_accessible_contracts_v2(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_accessible_projects_v2(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Frontend canary blocked: anon can execute tenant-scoped RPCs.';
  END IF;
END;
$$;

COMMIT;

WITH readiness AS (
  SELECT *
  FROM public.get_tenancy_readiness_report()
),
summary AS (
  SELECT
    count(*)::bigint AS readiness_checks,
    coalesce(sum(affected_rows), 0)::bigint AS readiness_affected_rows
  FROM readiness
),
tenant_rpcs AS (
  SELECT
    has_function_privilege('authenticated', 'public.get_my_organizations_v2()', 'EXECUTE') AS organizations_rpc_available,
    has_function_privilege('authenticated', 'public.get_accessible_teams_v2(uuid)', 'EXECUTE') AS teams_rpc_available,
    has_function_privilege('authenticated', 'public.get_accessible_companies_v2(uuid)', 'EXECUTE') AS companies_rpc_available,
    has_function_privilege('authenticated', 'public.get_accessible_contracts_v2(uuid)', 'EXECUTE') AS contracts_rpc_available,
    has_function_privilege('authenticated', 'public.get_accessible_projects_v2(uuid,uuid)', 'EXECUTE') AS projects_rpc_available
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
  summary.readiness_checks,
  summary.readiness_affected_rows,
  tenant_rpcs.organizations_rpc_available,
  tenant_rpcs.teams_rpc_available,
  tenant_rpcs.companies_rpc_available,
  tenant_rpcs.contracts_rpc_available,
  tenant_rpcs.projects_rpc_available,
  NOT has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') AS authenticated_cannot_toggle_enforcement,
  NOT has_function_privilege('anon', 'public.get_my_organizations_v2()', 'EXECUTE') AS anon_cannot_call_tenant_rpcs,
  'Set VITE_ORG_TENANCY_ENABLED=true only in the Lovable canary/test environment.'::text AS frontend_canary_action,
  (
    public.is_tenancy_enforced() IS FALSE
    AND setting.tenancy_setting_enabled IS FALSE
    AND summary.readiness_checks = 9
    AND summary.readiness_affected_rows = 0
    AND tenant_rpcs.organizations_rpc_available
    AND tenant_rpcs.teams_rpc_available
    AND tenant_rpcs.companies_rpc_available
    AND tenant_rpcs.contracts_rpc_available
    AND tenant_rpcs.projects_rpc_available
    AND NOT has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.get_my_organizations_v2()', 'EXECUTE')
  ) AS frontend_canary_db_ready_enforcement_off
FROM summary
CROSS JOIN tenant_rpcs
CROSS JOIN setting;
