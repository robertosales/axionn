-- Quality read policies must use the tenant-scoped public wrapper. The internal
-- two-argument membership helper intentionally is not executable by authenticated
-- clients, so referencing it directly from an invoker RLS policy causes 42501.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'quality_test_cases',
    'quality_test_steps',
    'quality_test_case_links',
    'quality_test_case_versions',
    'quality_test_suites',
    'quality_test_suite_items',
    'quality_test_plans',
    'quality_test_plan_items',
    'quality_test_runs',
    'quality_test_run_items',
    'quality_test_step_results',
    'quality_test_evidences',
    'quality_findings'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      'quality_tenant_select_' || table_name,
      table_name
    );

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_read_organization(organization_id))',
      'quality_tenant_select_' || table_name,
      table_name
    );
  end loop;
end
$$;

