begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(28);

select has_table(
  'public',
  'saas_runtime_settings',
  'runtime settings table exists'
);

select has_column('public', 'companies', 'org_id', 'companies has org_id');
select has_column('public', 'contracts', 'org_id', 'contracts has org_id');
select has_column('public', 'teams', 'org_id', 'teams has org_id');
select has_column('public', 'projects', 'org_id', 'projects has org_id');

select has_function(
  'public',
  'is_tenancy_enforced',
  array[]::text[],
  'tenancy enforcement state function exists'
);
select has_function(
  'public',
  'set_tenancy_enforcement',
  array['boolean'],
  'tenancy enforcement control function exists'
);
select has_function(
  'public',
  'can_read_organization',
  array['uuid'],
  'organization read helper exists'
);
select has_function(
  'public',
  'can_operate_organization',
  array['uuid'],
  'organization operation helper exists'
);
select has_function(
  'public',
  'get_accessible_companies_v2',
  array['uuid'],
  'tenant-scoped companies RPC exists'
);
select has_function(
  'public',
  'get_accessible_contracts_v2',
  array['uuid'],
  'tenant-scoped contracts RPC exists'
);
select has_function(
  'public',
  'get_accessible_projects_v2',
  array['uuid', 'uuid'],
  'tenant-scoped projects RPC exists'
);
select has_function(
  'public',
  'get_accessible_teams_v2',
  array['uuid'],
  'tenant-scoped teams RPC exists'
);
select has_function(
  'public',
  'get_tenancy_readiness_report',
  array[]::text[],
  'tenancy readiness report exists'
);

select has_trigger(
  'public',
  'companies',
  'trg_company_org_boundary',
  'companies organization trigger exists'
);
select has_trigger(
  'public',
  'contracts',
  'trg_contract_org_consistency',
  'contracts organization trigger exists'
);
select has_trigger(
  'public',
  'teams',
  'trg_team_org_consistency',
  'teams organization trigger exists'
);
select has_trigger(
  'public',
  'projects',
  'trg_project_org_consistency',
  'projects organization trigger exists'
);
select has_trigger(
  'public',
  'contract_teams',
  'trg_contract_team_org_consistency',
  'contract-team boundary trigger exists'
);
select has_trigger(
  'public',
  'contract_room_teams',
  'trg_contract_room_team_org_consistency',
  'contract-room-team boundary trigger exists'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and policyname in (
        'companies_tenant_boundary',
        'contracts_tenant_boundary',
        'teams_tenant_boundary',
        'projects_tenant_boundary',
        'contract_teams_tenant_boundary',
        'contract_room_teams_tenant_boundary',
        'contract_slas_tenant_boundary'
      )
  ),
  7,
  'all tenant boundary policies exist'
);

select is(
  (
    select count(*)::integer
    from pg_policies
    where schemaname = 'public'
      and upper(permissive) = 'RESTRICTIVE'
      and policyname in (
        'companies_tenant_boundary',
        'contracts_tenant_boundary',
        'teams_tenant_boundary',
        'projects_tenant_boundary',
        'contract_teams_tenant_boundary',
        'contract_room_teams_tenant_boundary',
        'contract_slas_tenant_boundary'
      )
  ),
  7,
  'tenant boundary policies are restrictive'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.set_tenancy_enforcement(boolean)',
    'execute'
  ),
  'authenticated users cannot change tenancy enforcement'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.set_tenancy_enforcement(boolean)',
    'execute'
  ),
  'service role can change tenancy enforcement'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.get_tenancy_readiness_report()',
    'execute'
  ),
  'authenticated users cannot execute the readiness report'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.get_tenancy_readiness_report()',
    'execute'
  ),
  'service role can execute the readiness report'
);

select is(
  public.is_tenancy_enforced(),
  false,
  'tenancy enforcement starts disabled for controlled rollout'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_accessible_companies_v2(uuid)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.get_accessible_contracts_v2(uuid)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.get_accessible_projects_v2(uuid,uuid)',
    'execute'
  )
  and has_function_privilege(
    'authenticated',
    'public.get_accessible_teams_v2(uuid)',
    'execute'
  ),
  'authenticated users can execute only the tenant-scoped resource RPCs'
);

select * from finish();
rollback;
