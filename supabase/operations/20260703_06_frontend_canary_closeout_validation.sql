-- One-off production operation: frontend canary closeout validation.
-- Run manually in Lovable Cloud SQL Editor after the app canary works with
-- VITE_ORG_TENANCY_ENABLED=true.
-- This file is read-only except for transaction-local advisory lock state.
-- It does not activate tenancy enforcement and does not call set_tenancy_enforcement(true).

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('axionn:20260703:06_frontend_canary_closeout_validation'));

DO $$
DECLARE
  v_missing text;
  v_readiness_affected_rows bigint;
BEGIN
  SELECT string_agg(object_name, ', ' ORDER BY object_name)
    INTO v_missing
  FROM (
    VALUES
      ('table public.saas_runtime_settings', to_regclass('public.saas_runtime_settings') IS NOT NULL),
      ('function public.can_read_contract_v2(uuid,uuid)', to_regprocedure('public.can_read_contract_v2(uuid,uuid)') IS NOT NULL),
      ('function public.can_operate_contract_v2(uuid,uuid)', to_regprocedure('public.can_operate_contract_v2(uuid,uuid)') IS NOT NULL),
      ('function public.get_tenancy_readiness_report()', to_regprocedure('public.get_tenancy_readiness_report()') IS NOT NULL),
      ('function public.is_tenancy_enforced()', to_regprocedure('public.is_tenancy_enforced()') IS NOT NULL),
      ('function public.set_tenancy_enforcement(boolean)', to_regprocedure('public.set_tenancy_enforcement(boolean)') IS NOT NULL)
  ) AS required(object_name, present)
  WHERE NOT present;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required canary closeout dependencies: %', v_missing;
  END IF;

  IF public.is_tenancy_enforced() THEN
    RAISE EXCEPTION 'Canary closeout requires tenancy enforcement disabled.';
  END IF;

  SELECT coalesce(sum(affected_rows), 0)::bigint
    INTO v_readiness_affected_rows
  FROM public.get_tenancy_readiness_report();

  IF v_readiness_affected_rows <> 0 THEN
    RAISE EXCEPTION 'Canary closeout blocked: readiness report has % affected rows.', v_readiness_affected_rows;
  END IF;

  IF has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Canary closeout blocked: client role can toggle tenancy enforcement.';
  END IF;

  IF has_function_privilege('anon', 'public.get_my_organizations_v2()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_accessible_teams_v2(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_accessible_companies_v2(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_accessible_contracts_v2(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_accessible_projects_v2(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Canary closeout blocked: anon can execute tenant-scoped RPCs.';
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
target_policies AS (
  SELECT
    policy.tablename,
    policy.policyname,
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
  setting.tenancy_setting_enabled,
  summary.readiness_checks,
  summary.readiness_affected_rows,
  count(*) FILTER (WHERE target_policies.tablename = 'contracts'
    AND target_policies.policyname = 'contracts_select_member') AS contract_select_policies,
  count(*) FILTER (WHERE target_policies.tablename IN (
    'contract_teams',
    'contract_room_teams',
    'contract_slas'
  )) AS relation_policies,
  NOT EXISTS (
    SELECT 1
    FROM target_policies policy
    WHERE policy.tablename IN ('contract_teams', 'contract_room_teams', 'contract_slas')
      AND (
        coalesce(policy.qual, '') ILIKE '%FROM public.contracts%'
        OR coalesce(policy.with_check, '') ILIKE '%FROM public.contracts%'
      )
  ) AS relation_policies_do_not_query_contracts_directly,
  NOT has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') AS authenticated_cannot_toggle_enforcement,
  NOT has_function_privilege('anon', 'public.get_my_organizations_v2()', 'EXECUTE') AS anon_cannot_call_tenant_rpcs,
  (
    public.is_tenancy_enforced() IS FALSE
    AND setting.tenancy_setting_enabled IS FALSE
    AND summary.readiness_checks = 9
    AND summary.readiness_affected_rows = 0
    AND count(*) FILTER (WHERE target_policies.tablename = 'contracts'
      AND target_policies.policyname = 'contracts_select_member') = 1
    AND count(*) FILTER (WHERE target_policies.tablename IN (
      'contract_teams',
      'contract_room_teams',
      'contract_slas'
    )) = 6
    AND NOT EXISTS (
      SELECT 1
      FROM target_policies policy
      WHERE policy.tablename IN ('contract_teams', 'contract_room_teams', 'contract_slas')
        AND (
          coalesce(policy.qual, '') ILIKE '%FROM public.contracts%'
          OR coalesce(policy.with_check, '') ILIKE '%FROM public.contracts%'
        )
    )
    AND NOT has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.get_my_organizations_v2()', 'EXECUTE')
  ) AS frontend_canary_closeout_ok_enforcement_off
FROM summary
CROSS JOIN setting
CROSS JOIN target_policies
GROUP BY
  setting.tenancy_setting_enabled,
  summary.readiness_checks,
  summary.readiness_affected_rows;
