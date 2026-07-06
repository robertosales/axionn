\ir ../../operations/20260704_02b_organization_module_access_runtime.sql

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

create or replace function pg_temp.authenticate_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
end;
$$;

insert into public.contracts (id, name, status)
values ('d59ab6dc-421f-41b4-b415-ae0bc072ebd4', 'Auth Fixture Contract', 'active')
on conflict (id) do nothing;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
)
values
  ('22200000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'module-a@invite.test', '', now(), now(), now()),
  ('22200000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'module-b@invite.test', '', now(), now(), now()),
  ('22200000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'module-platform@invite.test', '', now(), now(), now())
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, status, plan)
values
  ('12200000-0000-0000-0000-000000000001', 'Module Tenant A', 'module-tenant-a', 'active', 'pro'),
  ('12200000-0000-0000-0000-000000000002', 'Module Tenant B', 'module-tenant-b', 'active', 'pro')
on conflict (id) do nothing;

insert into public.organization_members (org_id, user_id, role, is_active)
values
  ('12200000-0000-0000-0000-000000000001', '22200000-0000-0000-0000-000000000001', 'member', true),
  ('12200000-0000-0000-0000-000000000002', '22200000-0000-0000-0000-000000000002', 'member', true)
on conflict (org_id, user_id) do update set role = excluded.role, is_active = true;

insert into public.organization_member_modules (
  org_id, user_id, module_key, role_name
)
values
  ('12200000-0000-0000-0000-000000000001', '22200000-0000-0000-0000-000000000001', 'sala_agil', 'member'),
  ('12200000-0000-0000-0000-000000000002', '22200000-0000-0000-0000-000000000002', 'rdm', 'member')
on conflict (org_id, user_id, module_key) do update set role_name = excluded.role_name;

insert into public.platform_user_roles (user_id, role)
values ('22200000-0000-0000-0000-000000000003', 'platform_admin')
on conflict do nothing;

select pg_temp.authenticate_as('22200000-0000-0000-0000-000000000001');

select results_eq(
  $query$
    select module, role_name
    from public.get_my_organization_module_roles('12200000-0000-0000-0000-000000000001')
  $query$,
  $expected$ values ('sala_agil'::text, 'member'::text) $expected$,
  'member receives only modules assigned in the active organization'
);

select throws_ok(
  $sql$
    select *
    from public.get_my_organization_module_roles('12200000-0000-0000-0000-000000000002')
  $sql$,
  '42501',
  'organization_module_access_denied',
  'member cannot read another organization module access'
);

update public.organization_members
set is_active = false
where org_id = '12200000-0000-0000-0000-000000000001'
  and user_id = '22200000-0000-0000-0000-000000000001';

select throws_ok(
  $sql$
    select *
    from public.get_my_organization_module_roles('12200000-0000-0000-0000-000000000001')
  $sql$,
  '42501',
  'organization_module_access_denied',
  'inactive membership loses module access'
);

select pg_temp.authenticate_as('22200000-0000-0000-0000-000000000003');

select is(
  (select count(*)::integer
    from public.get_my_organization_module_roles('12200000-0000-0000-0000-000000000001')),
  3,
  'platform administrator receives all modules'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.get_my_organization_module_roles(uuid)',
    'execute'
  ),
  'authenticated can execute the tenant-scoped module RPC'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.get_my_organization_module_roles(uuid)',
    'execute'
  ),
  'anon cannot execute the module RPC'
);

select is(
  public.is_tenancy_enforced(),
  false,
  'module runtime operation preserves tenancy enforcement in the test environment'
);

select * from finish();
rollback;
