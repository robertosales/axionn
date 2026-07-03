-- One-off production operation: post-enforcement monitoring.
-- Run manually in Lovable Cloud SQL Editor after Operation 9 activation and
-- after the frontend smoke test succeeds with VITE_ORG_TENANCY_ENABLED=true.
-- This file is read-only except for transaction-local advisory lock state.
-- It does not change tenancy enforcement.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('axionn:20260703:10_post_enforcement_monitoring'));

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
    RAISE EXCEPTION 'Missing required post-enforcement monitoring dependencies: %', v_missing;
  END IF;

  IF NOT public.is_tenancy_enforced() THEN
    RAISE EXCEPTION 'Post-enforcement monitoring expects tenancy enforcement enabled.';
  END IF;

  SELECT coalesce(sum(affected_rows), 0)::bigint
    INTO v_readiness_affected_rows
  FROM public.get_tenancy_readiness_report();

  IF v_readiness_affected_rows <> 0 THEN
    RAISE EXCEPTION 'Post-enforcement monitoring blocked: readiness report has % affected rows.', v_readiness_affected_rows;
  END IF;

  IF has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Post-enforcement monitoring blocked: client role can toggle tenancy enforcement.';
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
),
policy_counts AS (
  SELECT
    count(*) FILTER (
      WHERE policy.policyname IN (
        'companies_tenant_boundary',
        'contracts_tenant_boundary',
        'teams_tenant_boundary',
        'projects_tenant_boundary',
        'contract_teams_tenant_boundary',
        'contract_room_teams_tenant_boundary',
        'contract_slas_tenant_boundary'
      )
    )::bigint AS tenant_boundary_policies,
    count(*) FILTER (
      WHERE policy.tablename = 'contracts'
        AND policy.policyname = 'contracts_select_member'
    )::bigint AS contract_select_policies,
    count(*) FILTER (
      WHERE policy.tablename IN ('contract_teams', 'contract_room_teams', 'contract_slas')
        AND policy.policyname IN (
          'contract_teams_select_member',
          'contract_room_teams_select_member',
          'contract_slas_select_member',
          'contract_teams_tenant_boundary',
          'contract_room_teams_tenant_boundary',
          'contract_slas_tenant_boundary'
        )
    )::bigint AS relation_policies
  FROM pg_policies policy
  WHERE policy.schemaname = 'public'
),
trigger_counts AS (
  SELECT count(DISTINCT trigger_info.trigger_name)::bigint AS tenancy_consistency_triggers
  FROM information_schema.triggers trigger_info
  WHERE trigger_info.trigger_schema = 'public'
    AND trigger_info.trigger_name IN (
      'trg_company_org_boundary',
      'trg_contract_org_consistency',
      'trg_team_org_consistency',
      'trg_project_org_consistency',
      'trg_contract_team_org_consistency',
      'trg_contract_room_team_org_consistency'
    )
),
rpc_privileges AS (
  SELECT
    has_function_privilege('authenticated', 'public.get_my_organizations_v2()', 'EXECUTE') AS organizations_rpc_available,
    has_function_privilege('authenticated', 'public.get_accessible_teams_v2(uuid)', 'EXECUTE') AS teams_rpc_available,
    has_function_privilege('authenticated', 'public.get_accessible_companies_v2(uuid)', 'EXECUTE') AS companies_rpc_available,
    has_function_privilege('authenticated', 'public.get_accessible_contracts_v2(uuid)', 'EXECUTE') AS contracts_rpc_available,
    has_function_privilege('authenticated', 'public.get_accessible_projects_v2(uuid,uuid)', 'EXECUTE') AS projects_rpc_available
)
SELECT
  public.is_tenancy_enforced() AS tenancy_enforcement_enabled,
  setting.tenancy_setting_enabled,
  readiness_summary.readiness_checks,
  readiness_summary.readiness_affected_rows,
  policy_counts.tenant_boundary_policies,
  policy_counts.contract_select_policies,
  policy_counts.relation_policies,
  trigger_counts.tenancy_consistency_triggers,
  rpc_privileges.organizations_rpc_available,
  rpc_privileges.teams_rpc_available,
  rpc_privileges.companies_rpc_available,
  rpc_privileges.contracts_rpc_available,
  rpc_privileges.projects_rpc_available,
  has_function_privilege('service_role', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') AS service_role_can_toggle_enforcement,
  NOT has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') AS authenticated_cannot_toggle_enforcement,
  NOT has_function_privilege('anon', 'public.get_my_organizations_v2()', 'EXECUTE') AS anon_cannot_call_tenant_rpcs,
  'Keep rollback file ready during the monitoring window: supabase/operations/20260703_09_disable_tenancy_enforcement_rollback.sql.'::text AS rollback_reminder,
  (
    public.is_tenancy_enforced() IS TRUE
    AND setting.tenancy_setting_enabled IS TRUE
    AND readiness_summary.readiness_checks = 9
    AND readiness_summary.readiness_affected_rows = 0
    AND policy_counts.tenant_boundary_policies = 7
    AND policy_counts.contract_select_policies = 1
    AND policy_counts.relation_policies = 6
    AND trigger_counts.tenancy_consistency_triggers = 6
    AND rpc_privileges.organizations_rpc_available
    AND rpc_privileges.teams_rpc_available
    AND rpc_privileges.companies_rpc_available
    AND rpc_privileges.contracts_rpc_available
    AND rpc_privileges.projects_rpc_available
    AND has_function_privilege('service_role', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.get_my_organizations_v2()', 'EXECUTE')
  ) AS post_enforcement_monitoring_ok
FROM readiness_summary
CROSS JOIN setting
CROSS JOIN policy_counts
CROSS JOIN trigger_counts
CROSS JOIN rpc_privileges;
