-- Quality Intelligence - validacao cumulativa, somente leitura.
-- Executar no SQL Editor do Lovable Cloud depois de aplicar todas as migrations
-- Quality ate 20260725150000. Este arquivo nao altera dados nem configuracoes.

begin;
set transaction read only;

with
expected_tables(name) as (
  values
    ('quality_code_counters'),
    ('quality_test_cases'),
    ('quality_test_steps'),
    ('quality_test_case_links'),
    ('quality_test_case_versions'),
    ('quality_test_suites'),
    ('quality_test_suite_items'),
    ('quality_test_plans'),
    ('quality_test_plan_items'),
    ('quality_test_runs'),
    ('quality_test_run_items'),
    ('quality_test_step_results'),
    ('quality_findings'),
    ('quality_test_evidences')
),
expected_rpcs(name) as (
  values
    ('create_quality_test_case_v1'),
    ('update_quality_test_case_v1'),
    ('archive_quality_test_case_v1'),
    ('link_quality_test_case_v1'),
    ('unlink_quality_test_case_v1'),
    ('create_quality_test_suite_v1'),
    ('add_quality_test_suite_item_v1'),
    ('remove_quality_test_suite_item_v1'),
    ('create_quality_test_plan_v1'),
    ('update_quality_test_plan_v1'),
    ('add_quality_test_plan_item_v1'),
    ('remove_quality_test_plan_item_v1'),
    ('create_quality_test_run_from_plan_v1'),
    ('start_quality_test_run_v1'),
    ('update_quality_step_result_v1'),
    ('add_quality_external_evidence_v1'),
    ('complete_quality_test_run_v1'),
    ('reopen_quality_test_run_v1'),
    ('check_organization_has_quality_module')
),
table_state as (
  select
    count(*) filter (where c.oid is not null)::int as tables_available,
    count(*) filter (where c.relrowsecurity)::int as tables_with_rls
  from expected_tables expected
  left join pg_class c
    on c.relname = expected.name
   and c.relnamespace = 'public'::regnamespace
   and c.relkind = 'r'
),
rpc_state as (
  select count(distinct expected.name)::int as rpcs_available
  from expected_rpcs expected
  join pg_proc p on p.proname = expected.name
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
),
permission_state as (
  select count(*)::int as quality_permissions
  from public.app_permissions
  where group_key = 'quality'
),
catalog_state as (
  select
    count(distinct feature.id) filter (
      where feature.code = 'quality.cases.view'
        and feature.status = 'active'
    )::int as quality_entry_features,
    count(*) filter (
      where feature.code = 'quality.cases.view'
        and plan_feature.enabled
    )::int as enabled_plan_bindings
  from public.product_features feature
  left join public.saas_plan_version_features plan_feature
    on plan_feature.feature_id = feature.id
),
entitlement_rpc_state as (
  select
    coalesce(bool_or(p.prosecdef), false) as security_definer,
    coalesce(
      bool_or('search_path=public, pg_temp' = any(coalesce(p.proconfig, '{}'))),
      false
    ) as safe_search_path
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'check_organization_has_quality_module'
),
grant_state as (
  select
    has_function_privilege(
      'authenticated',
      'public.check_organization_has_quality_module(uuid)',
      'execute'
    ) as authenticated_can_check_entitlement,
    not has_function_privilege(
      'anon',
      'public.check_organization_has_quality_module(uuid)',
      'execute'
    ) as anon_cannot_check_entitlement,
    not has_table_privilege(
      'authenticated',
      'public.quality_test_cases',
      'insert'
    ) as authenticated_cannot_insert_cases_directly
)
select
  table_state.tables_available,
  table_state.tables_with_rls,
  rpc_state.rpcs_available,
  permission_state.quality_permissions,
  catalog_state.quality_entry_features,
  catalog_state.enabled_plan_bindings,
  entitlement_rpc_state.security_definer as entitlement_rpc_security_definer,
  entitlement_rpc_state.safe_search_path as entitlement_rpc_safe_search_path,
  grant_state.authenticated_can_check_entitlement,
  grant_state.anon_cannot_check_entitlement,
  grant_state.authenticated_cannot_insert_cases_directly,
  (
    table_state.tables_available = 14
    and table_state.tables_with_rls = 14
    and rpc_state.rpcs_available = 19
    and permission_state.quality_permissions >= 8
    and catalog_state.quality_entry_features = 1
    and catalog_state.enabled_plan_bindings > 0
    and entitlement_rpc_state.security_definer
    and entitlement_rpc_state.safe_search_path
    and grant_state.authenticated_can_check_entitlement
    and grant_state.anon_cannot_check_entitlement
    and grant_state.authenticated_cannot_insert_cases_directly
  ) as quality_intelligence_cumulative_validation_ok
from table_state
cross join rpc_state
cross join permission_state
cross join catalog_state
cross join entitlement_rpc_state
cross join grant_state;

rollback;
