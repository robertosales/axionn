-- One-off production operation: final readiness validation after Operation 3.
-- Run manually in Lovable Cloud SQL Editor.
-- This file is read-only except for transaction-local advisory lock state.
-- It does not activate tenancy enforcement and does not call set_tenancy_enforcement(true).

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('axionn:20260703:04_final_readiness_validation'));

DO $$
DECLARE
  v_missing text;
  v_enabled boolean;
  v_settings_enabled boolean;
  v_issue_groups bigint;
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
    RAISE EXCEPTION 'Missing required final-readiness dependencies: %', v_missing;
  END IF;

  SELECT public.is_tenancy_enforced() INTO v_enabled;
  IF coalesce(v_enabled, false) THEN
    RAISE EXCEPTION 'Final-readiness validation requires enforcement disabled.';
  END IF;

  SELECT lower(setting.value ->> 'enabled') = 'true'
    INTO v_settings_enabled
  FROM public.saas_runtime_settings setting
  WHERE setting.key = 'tenancy_enforcement';

  IF v_settings_enabled IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Unexpected tenancy_enforcement setting value; expected {"enabled": false}.';
  END IF;

  SELECT count(*)::bigint
    INTO v_issue_groups
  FROM public.get_tenancy_readiness_report()
  WHERE affected_rows > 0;

  IF v_issue_groups > 0 THEN
    RAISE EXCEPTION 'Readiness report has % issue groups with affected rows.', v_issue_groups;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organizations organization
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.organization_members member
      WHERE member.org_id = organization.id
        AND member.role IN ('owner', 'admin')
    )
  ) THEN
    RAISE EXCEPTION 'At least one organization has no owner/admin membership.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.platform_user_roles role
    WHERE role.role = 'platform_admin'
  ) THEN
    RAISE EXCEPTION 'No platform_admin role exists.';
  END IF;

  IF has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Client role can execute set_tenancy_enforcement(boolean).';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot execute set_tenancy_enforcement(boolean).';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.is_tenancy_enforced()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot execute is_tenancy_enforced(), required by restrictive policies.';
  END IF;

  IF has_function_privilege('anon', 'public.get_my_organizations_v2()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_accessible_teams_v2(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_accessible_companies_v2(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_accessible_contracts_v2(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_accessible_projects_v2(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute tenant-scoped RPCs.';
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
    coalesce(sum(affected_rows), 0)::bigint AS readiness_affected_rows,
    coalesce(sum(affected_rows) FILTER (WHERE issue = 'missing_org_id'), 0)::bigint AS missing_org_rows,
    coalesce(sum(affected_rows) FILTER (WHERE issue <> 'missing_org_id'), 0)::bigint AS org_mismatch_rows
  FROM readiness
),
owner_admin AS (
  SELECT count(*)::bigint AS organizations_without_owner_or_admin
  FROM public.organizations organization
  WHERE NOT EXISTS (
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
policy_count AS (
  SELECT count(DISTINCT policy.policyname)::bigint AS tenant_boundary_policies
  FROM pg_policies policy
  WHERE policy.schemaname = 'public'
    AND policy.policyname IN (
      'companies_tenant_boundary',
      'contracts_tenant_boundary',
      'teams_tenant_boundary',
      'projects_tenant_boundary',
      'contract_teams_tenant_boundary',
      'contract_room_teams_tenant_boundary',
      'contract_slas_tenant_boundary'
    )
),
trigger_count AS (
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
  readiness_summary.missing_org_rows,
  readiness_summary.org_mismatch_rows,
  owner_admin.organizations_without_owner_or_admin,
  platform_admins.platform_admins,
  policy_count.tenant_boundary_policies,
  trigger_count.tenancy_consistency_triggers,
  has_function_privilege('service_role', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') AS service_role_can_toggle_enforcement,
  NOT has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') AS authenticated_cannot_toggle_enforcement,
  NOT has_function_privilege('anon', 'public.get_my_organizations_v2()', 'EXECUTE') AS anon_cannot_call_tenant_rpcs,
  (
    public.is_tenancy_enforced() IS FALSE
    AND setting.tenancy_setting_enabled IS FALSE
    AND readiness_summary.readiness_checks = 9
    AND readiness_summary.readiness_affected_rows = 0
    AND owner_admin.organizations_without_owner_or_admin = 0
    AND platform_admins.platform_admins > 0
    AND policy_count.tenant_boundary_policies = 7
    AND trigger_count.tenancy_consistency_triggers = 6
    AND has_function_privilege('service_role', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.get_my_organizations_v2()', 'EXECUTE')
  ) AS final_readiness_ok_enforcement_off
FROM readiness_summary
CROSS JOIN owner_admin
CROSS JOIN platform_admins
CROSS JOIN policy_count
CROSS JOIN trigger_count
CROSS JOIN setting;
