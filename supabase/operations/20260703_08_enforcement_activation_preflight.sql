-- One-off production operation: enforcement activation preflight.
-- Run manually in Lovable Cloud SQL Editor only after Operation 7 passed and
-- the team explicitly starts planning a future enforcement activation window.
-- This file is read-only except for transaction-local advisory lock state.
-- It does not activate tenancy enforcement and does not call set_tenancy_enforcement(true).

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('axionn:20260703:08_enforcement_activation_preflight'));

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
    RAISE EXCEPTION 'Missing required enforcement-preflight dependencies: %', v_missing;
  END IF;

  IF public.is_tenancy_enforced() THEN
    RAISE EXCEPTION 'Enforcement activation preflight expects enforcement still disabled.';
  END IF;

  SELECT coalesce(sum(affected_rows), 0)::bigint
    INTO v_readiness_affected_rows
  FROM public.get_tenancy_readiness_report();

  IF v_readiness_affected_rows <> 0 THEN
    RAISE EXCEPTION 'Enforcement activation preflight blocked: readiness report has % affected rows.', v_readiness_affected_rows;
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
    RAISE EXCEPTION 'Enforcement activation preflight blocked: active/trial organization without owner/admin.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.platform_user_roles role
    WHERE role.role = 'platform_admin'
  ) THEN
    RAISE EXCEPTION 'Enforcement activation preflight blocked: no platform_admin exists.';
  END IF;

  IF has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Enforcement activation preflight blocked: client role can toggle tenancy enforcement.';
  END IF;

  IF has_function_privilege('anon', 'public.get_my_organizations_v2()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_accessible_teams_v2(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_accessible_companies_v2(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_accessible_contracts_v2(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_accessible_projects_v2(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Enforcement activation preflight blocked: anon can execute tenant-scoped RPCs.';
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
owner_admin AS (
  SELECT count(*)::bigint AS active_or_trial_organizations_without_owner_or_admin
  FROM public.organizations organization
  WHERE organization.status IN ('active', 'trial')
    AND NOT EXISTS (
      SELECT 1
      FROM public.organization_members member
      WHERE member.org_id = organization.id
        AND member.role IN ('owner', 'admin')
    )
),
platform_admins AS (
  SELECT count(*)::bigint AS platform_admins
  FROM public.platform_user_roles role
  WHERE role.role = 'platform_admin'
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
    )::bigint AS relation_policies,
    NOT EXISTS (
      SELECT 1
      FROM pg_policies relation_policy
      WHERE relation_policy.schemaname = 'public'
        AND relation_policy.tablename IN ('contract_teams', 'contract_room_teams', 'contract_slas')
        AND relation_policy.policyname IN (
          'contract_teams_select_member',
          'contract_room_teams_select_member',
          'contract_slas_select_member',
          'contract_teams_tenant_boundary',
          'contract_room_teams_tenant_boundary',
          'contract_slas_tenant_boundary'
        )
        AND (
          coalesce(relation_policy.qual, '') ILIKE '%FROM public.contracts%'
          OR coalesce(relation_policy.with_check, '') ILIKE '%FROM public.contracts%'
        )
    ) AS relation_policies_do_not_query_contracts_directly
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
  owner_admin.active_or_trial_organizations_without_owner_or_admin,
  platform_admins.platform_admins,
  policy_counts.tenant_boundary_policies,
  policy_counts.contract_select_policies,
  policy_counts.relation_policies,
  policy_counts.relation_policies_do_not_query_contracts_directly,
  trigger_counts.tenancy_consistency_triggers,
  rpc_privileges.organizations_rpc_available,
  rpc_privileges.teams_rpc_available,
  rpc_privileges.companies_rpc_available,
  rpc_privileges.contracts_rpc_available,
  rpc_privileges.projects_rpc_available,
  has_function_privilege('service_role', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') AS service_role_can_toggle_enforcement,
  NOT has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') AS authenticated_cannot_toggle_enforcement,
  NOT has_function_privilege('anon', 'public.get_my_organizations_v2()', 'EXECUTE') AS anon_cannot_call_tenant_rpcs,
  'No activation in this file. Future activation requires explicit approval, backup, window, and rollback SQL: select public.set_tenancy_enforcement(false);'::text AS activation_note,
  (
    public.is_tenancy_enforced() IS FALSE
    AND setting.tenancy_setting_enabled IS FALSE
    AND readiness_summary.readiness_checks = 9
    AND readiness_summary.readiness_affected_rows = 0
    AND owner_admin.active_or_trial_organizations_without_owner_or_admin = 0
    AND platform_admins.platform_admins > 0
    AND policy_counts.tenant_boundary_policies = 7
    AND policy_counts.contract_select_policies = 1
    AND policy_counts.relation_policies = 6
    AND policy_counts.relation_policies_do_not_query_contracts_directly
    AND trigger_counts.tenancy_consistency_triggers = 6
    AND rpc_privileges.organizations_rpc_available
    AND rpc_privileges.teams_rpc_available
    AND rpc_privileges.companies_rpc_available
    AND rpc_privileges.contracts_rpc_available
    AND rpc_privileges.projects_rpc_available
    AND has_function_privilege('service_role', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.get_my_organizations_v2()', 'EXECUTE')
  ) AS enforcement_activation_preflight_ok_enforcement_off
FROM readiness_summary
CROSS JOIN setting
CROSS JOIN owner_admin
CROSS JOIN platform_admins
CROSS JOIN policy_counts
CROSS JOIN trigger_counts
CROSS JOIN rpc_privileges;
