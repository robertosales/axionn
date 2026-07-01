begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(32);

create or replace function pg_temp.authenticate_as(
  p_user_id uuid,
  p_role text default 'authenticated'
)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', p_role, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id, 'role', p_role)::text,
    true
  );
end;
$$;

select public.set_tenancy_enforcement(false);

-- As fixtures de autenticação não devem executar automações de onboarding.
-- DISABLE TRIGGER USER preserva os triggers de FK e é revertido no fim da transação.
alter table auth.users disable trigger user;

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
values
  ('20000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'tenant-a@axion.test', '', now(), now(), now()),
  ('20000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'tenant-b@axion.test', '', now(), now(), now()),
  ('20000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'tenant-suspended@axion.test', '', now(), now(), now()),
  ('20000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'platform-admin@axion.test', '', now(), now(), now())
on conflict (id) do nothing;

alter table auth.users enable trigger user;

insert into public.organizations (id, name, slug, status, plan)
values
  ('10000000-0000-0000-0000-000000000001', 'Tenant Test A', 'tenant-test-a', 'active', 'pro'),
  ('10000000-0000-0000-0000-000000000002', 'Tenant Test B', 'tenant-test-b', 'active', 'pro'),
  ('10000000-0000-0000-0000-000000000003', 'Tenant Test Suspended', 'tenant-test-suspended', 'suspended', 'pro')
on conflict (id) do nothing;

insert into public.organization_members (org_id, user_id, role)
values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'owner'),
  ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'owner'),
  ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'owner')
on conflict do nothing;

insert into public.platform_user_roles (user_id, role)
values ('20000000-0000-0000-0000-000000000004', 'platform_admin')
on conflict do nothing;

insert into public.companies (id, name, status, org_id)
values
  ('30000000-0000-0000-0000-000000000001', 'Company Tenant A', 'active', '10000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002', 'Company Tenant B', 'active', '10000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000003', 'Company Suspended', 'active', '10000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;

insert into public.contracts (id, name, status, company_id, org_id)
values
  ('40000000-0000-0000-0000-000000000001', 'Contract Tenant A', 'active', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('40000000-0000-0000-0000-000000000002', 'Contract Tenant B', 'active', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000003', 'Contract Suspended', 'active', '30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;

insert into public.teams (id, name, module, company_id, contract_id, org_id)
values
  ('50000000-0000-0000-0000-000000000001', 'Team Tenant A', 'sala_agil', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('50000000-0000-0000-0000-000000000002', 'Team Tenant B', 'sala_agil', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'),
  ('50000000-0000-0000-0000-000000000003', 'Team Suspended', 'sala_agil', '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;

insert into public.projects (
  id,
  name,
  module_type,
  status,
  contract_id,
  team_id,
  org_id
)
values
  ('60000000-0000-0000-0000-000000000001', 'Project Tenant A', 'agile', 'active', '40000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('60000000-0000-0000-0000-000000000002', 'Project Tenant B', 'agile', 'active', '40000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'),
  ('60000000-0000-0000-0000-000000000003', 'Project Suspended', 'agile', 'active', '40000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;

-- Organização A.
select pg_temp.authenticate_as('20000000-0000-0000-0000-000000000001');

select is(
  public.is_platform_admin(),
  false,
  'organization owner A is not a platform administrator'
);
select is(
  public.is_organization_member('10000000-0000-0000-0000-000000000001'),
  true,
  'user A is a member of organization A'
);
select is(
  public.is_organization_member('10000000-0000-0000-0000-000000000002'),
  false,
  'user A is not a member of organization B'
);
select is(
  public.can_operate_organization('10000000-0000-0000-0000-000000000001'),
  true,
  'user A can operate organization A'
);
select is(
  public.can_operate_organization('10000000-0000-0000-0000-000000000002'),
  false,
  'user A cannot operate organization B'
);

select results_eq(
  $query$
    select id
    from public.get_accessible_contracts_v2('10000000-0000-0000-0000-000000000001')
    order by id
  $query$,
  $expected$
    values ('40000000-0000-0000-0000-000000000001'::uuid)
  $expected$,
  'user A lists only contracts from organization A'
);

select is_empty(
  $query$
    select id
    from public.get_accessible_contracts_v2('10000000-0000-0000-0000-000000000002')
  $query$,
  'user A cannot list contracts from organization B'
);

select results_eq(
  $query$
    select id
    from public.get_accessible_companies_v2('10000000-0000-0000-0000-000000000001')
    order by id
  $query$,
  $expected$
    values ('30000000-0000-0000-0000-000000000001'::uuid)
  $expected$,
  'user A lists only companies from organization A'
);

select results_eq(
  $query$
    select id
    from public.get_accessible_projects_v2(
      '10000000-0000-0000-0000-000000000001',
      null::uuid
    )
    order by id
  $query$,
  $expected$
    values ('60000000-0000-0000-0000-000000000001'::uuid)
  $expected$,
  'user A lists only projects from organization A'
);

select results_eq(
  $query$
    select id
    from public.get_accessible_teams_v2('10000000-0000-0000-0000-000000000001')
    order by id
  $query$,
  $expected$
    values ('50000000-0000-0000-0000-000000000001'::uuid)
  $expected$,
  'user A lists only teams from organization A'
);

select results_eq(
  $query$
    select id
    from public.get_my_organizations_v2()
    order by id
  $query$,
  $expected$
    values ('10000000-0000-0000-0000-000000000001'::uuid)
  $expected$,
  'user A receives only organization A from the selector RPC'
);

-- Organização B: cenário independente e simétrico ao tenant A.
select pg_temp.authenticate_as('20000000-0000-0000-0000-000000000002');

select is(
  public.is_organization_member('10000000-0000-0000-0000-000000000002'),
  true,
  'user B is a member of organization B'
);
select is(
  public.is_organization_member('10000000-0000-0000-0000-000000000001'),
  false,
  'user B is not a member of organization A'
);

select results_eq(
  $query$
    select id
    from public.get_accessible_contracts_v2('10000000-0000-0000-0000-000000000002')
    order by id
  $query$,
  $expected$
    values ('40000000-0000-0000-0000-000000000002'::uuid)
  $expected$,
  'user B lists only contracts from organization B'
);

select is_empty(
  $query$
    select id
    from public.get_accessible_contracts_v2('10000000-0000-0000-0000-000000000001')
  $query$,
  'user B cannot list contracts from organization A'
);

select results_eq(
  $query$
    select id
    from public.get_accessible_projects_v2(
      '10000000-0000-0000-0000-000000000002',
      null::uuid
    )
    order by id
  $query$,
  $expected$
    values ('60000000-0000-0000-0000-000000000002'::uuid)
  $expected$,
  'user B lists only projects from organization B'
);

-- Organização suspensa: leitura de membership permanece, operação é bloqueada.
select pg_temp.authenticate_as('20000000-0000-0000-0000-000000000003');

select is(
  public.is_organization_member('10000000-0000-0000-0000-000000000003'),
  true,
  'suspended organization user remains a member'
);
select is(
  public.can_read_organization('10000000-0000-0000-0000-000000000003'),
  true,
  'suspended organization user keeps read access'
);
select is(
  public.can_operate_organization('10000000-0000-0000-0000-000000000003'),
  false,
  'suspended organization user cannot operate resources'
);

-- Administrador da plataforma.
select pg_temp.authenticate_as('20000000-0000-0000-0000-000000000004');

select is(
  public.is_platform_admin(),
  true,
  'platform administrator is recognized independently from organization roles'
);

select results_eq(
  $query$
    select id
    from public.get_my_organizations_v2()
    where id in (
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000003'
    )
    order by id
  $query$,
  $expected$
    values
      ('10000000-0000-0000-0000-000000000001'::uuid),
      ('10000000-0000-0000-0000-000000000002'::uuid),
      ('10000000-0000-0000-0000-000000000003'::uuid)
  $expected$,
  'platform administrator can enumerate all organizations'
);

select is(
  public.can_operate_organization('10000000-0000-0000-0000-000000000003'),
  true,
  'platform administrator can support a suspended organization'
);

-- Integridade entre organizações.
select throws_ok(
  $sql$
    insert into public.contract_teams (contract_id, team_id)
    values (
      '40000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000002'
    )
  $sql$,
  'P0001',
  'contract_team_organization_mismatch',
  'contract cannot be linked to a team from another organization'
);

select throws_ok(
  $sql$
    insert into public.contract_room_teams (
      contract_id,
      team_id,
      room_type,
      is_active
    )
    values (
      '40000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000002',
      'agil',
      true
    )
  $sql$,
  'P0001',
  'contract_room_team_organization_mismatch',
  'contract room cannot use a team from another organization'
);

select throws_ok(
  $sql$
    insert into public.projects (
      id,
      name,
      module_type,
      status,
      contract_id,
      team_id
    )
    values (
      '60000000-0000-0000-0000-000000000099',
      'Cross Tenant Project',
      'agile',
      'active',
      '40000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000002'
    )
  $sql$,
  'P0001',
  'project_relationship_organization_mismatch',
  'project cannot combine contract and team from different organizations'
);

-- Enforcement temporário dentro da transação de teste.
select public.set_tenancy_enforcement(true);
select is(
  public.is_tenancy_enforced(),
  true,
  'tenancy enforcement can be enabled by the privileged database session'
);

select throws_ok(
  $sql$
    insert into public.companies (id, name, status)
    values (
      '30000000-0000-0000-0000-000000000090',
      'Company Without Organization',
      'active'
    )
  $sql$,
  'P0001',
  'organization_required',
  'resource creation requires an organization after enforcement'
);

select pg_temp.authenticate_as('20000000-0000-0000-0000-000000000001');

select throws_ok(
  $sql$
    insert into public.companies (id, name, status, org_id)
    values (
      '30000000-0000-0000-0000-000000000091',
      'Unauthorized Company B',
      'active',
      '10000000-0000-0000-0000-000000000002'
    )
  $sql$,
  'P0001',
  'organization_not_operational',
  'user A cannot create resources in organization B'
);

select lives_ok(
  $sql$
    insert into public.companies (id, name, status, org_id)
    values (
      '30000000-0000-0000-0000-000000000092',
      'Authorized Company A',
      'active',
      '10000000-0000-0000-0000-000000000001'
    )
  $sql$,
  'user A can create resources in its active organization'
);

select pg_temp.authenticate_as('20000000-0000-0000-0000-000000000003');

select throws_ok(
  $sql$
    insert into public.companies (id, name, status, org_id)
    values (
      '30000000-0000-0000-0000-000000000093',
      'Blocked Suspended Company',
      'active',
      '10000000-0000-0000-0000-000000000003'
    )
  $sql$,
  'P0001',
  'organization_not_operational',
  'suspended organization user cannot create resources'
);

select pg_temp.authenticate_as('20000000-0000-0000-0000-000000000004');

select lives_ok(
  $sql$
    insert into public.companies (id, name, status, org_id)
    values (
      '30000000-0000-0000-0000-000000000094',
      'Platform Support Company',
      'active',
      '10000000-0000-0000-0000-000000000003'
    )
  $sql$,
  'platform administrator can operate suspended organization resources'
);

select public.set_tenancy_enforcement(false);
select is(
  public.is_tenancy_enforced(),
  false,
  'tenancy enforcement can be returned to audit mode'
);

select * from finish();
rollback;
