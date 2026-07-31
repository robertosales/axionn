begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

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

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
)
values
  ('22900000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner-a@rbac.test', '', now(), now(), now()),
  ('22900000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'admin-a@rbac.test', '', now(), now(), now()),
  ('22900000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'member-a@rbac.test', '', now(), now(), now()),
  ('22900000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'owner-b@rbac.test', '', now(), now(), now()),
  ('22900000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'shared@rbac.test', '', now(), now(), now())
on conflict (id) do nothing;

insert into public.organizations (
  id, name, slug, status, plan, max_projects, max_users, max_countings_per_month
)
values
  ('12900000-0000-0000-0000-000000000001', 'RBAC Tenant A', 'rbac-tenant-a', 'active', 'pro', 20, 20, 100),
  ('12900000-0000-0000-0000-000000000002', 'RBAC Tenant B', 'rbac-tenant-b', 'active', 'pro', 20, 20, 100)
on conflict (id) do nothing;

insert into public.organization_members (org_id, user_id, role, is_active)
values
  ('12900000-0000-0000-0000-000000000001', '22900000-0000-0000-0000-000000000001', 'owner', true),
  ('12900000-0000-0000-0000-000000000001', '22900000-0000-0000-0000-000000000002', 'admin', true),
  ('12900000-0000-0000-0000-000000000001', '22900000-0000-0000-0000-000000000003', 'member', true),
  ('12900000-0000-0000-0000-000000000002', '22900000-0000-0000-0000-000000000004', 'owner', true),
  ('12900000-0000-0000-0000-000000000001', '22900000-0000-0000-0000-000000000005', 'member', true),
  ('12900000-0000-0000-0000-000000000002', '22900000-0000-0000-0000-000000000005', 'member', true)
on conflict (org_id, user_id) do update
set role = excluded.role, is_active = excluded.is_active;

select has_function(
  'public'::name,
  'manage_organization_member_v1'::name,
  array['uuid', 'uuid', 'text', 'text', 'boolean', 'text[]'],
  'tenant-scoped management RPC exists'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.manage_organization_member_v1(uuid,uuid,text,text,boolean,text[])',
    'execute'
  ),
  'anon cannot manage organization members'
);

select pg_temp.authenticate_as('22900000-0000-0000-0000-000000000002');

select ok(
  public.manage_organization_member_v1(
    '12900000-0000-0000-0000-000000000001',
    '22900000-0000-0000-0000-000000000003',
    'Member Updated',
    null,
    null,
    array['rdm', 'sala_agil']
  ),
  'organization admin updates a member'
);

select is(
  (select display_name from public.profiles where user_id = '22900000-0000-0000-0000-000000000003'),
  'Member Updated',
  'display name is updated for a single-tenant member'
);

select results_eq(
  $query$
    select module_key
    from public.organization_member_modules
    where org_id = '12900000-0000-0000-0000-000000000001'
      and user_id = '22900000-0000-0000-0000-000000000003'
    order by module_key
  $query$,
  $expected$ values ('rdm'::text), ('sala_agil'::text) $expected$,
  'module access is replaced atomically'
);

select ok(
  public.manage_organization_member_v1(
    '12900000-0000-0000-0000-000000000001',
    '22900000-0000-0000-0000-000000000003',
    null, null, false, null
  ),
  'organization admin deactivates the tenant membership'
);

select is(
  (select is_active from public.organization_members
   where org_id = '12900000-0000-0000-0000-000000000001'
     and user_id = '22900000-0000-0000-0000-000000000003'),
  false,
  'target membership becomes inactive'
);

select ok(
  (select is_active from public.profiles
   where user_id = '22900000-0000-0000-0000-000000000003'),
  'tenant deactivation does not globally block the account'
);

select throws_ok(
  $sql$
    select public.manage_organization_member_v1(
      '12900000-0000-0000-0000-000000000002',
      '22900000-0000-0000-0000-000000000004',
      null, null, false, null
    )
  $sql$,
  '42501',
  'organization_member_update_forbidden',
  'admin cannot mutate another tenant'
);

select throws_ok(
  $sql$
    select public.manage_organization_member_v1(
      '12900000-0000-0000-0000-000000000001',
      '22900000-0000-0000-0000-000000000001',
      null, null, false, null
    )
  $sql$,
  '22023',
  'organization_owner_requires_transfer',
  'owner cannot be deactivated'
);

select throws_ok(
  $sql$
    select public.manage_organization_member_v1(
      '12900000-0000-0000-0000-000000000001',
      '22900000-0000-0000-0000-000000000005',
      'Shared Renamed',
      null, null, null
    )
  $sql$,
  '22023',
  'organization_member_shared_profile_name_forbidden',
  'org admin cannot rename a profile shared with another tenant'
);

select is(
  (select count(*)::integer
   from public.organization_membership_audit_log
   where org_id = '12900000-0000-0000-0000-000000000001'
     and subject_user_id = '22900000-0000-0000-0000-000000000003'
     and action = 'member_managed'),
  2,
  'successful mutations are audited'
);

select pg_temp.authenticate_as('22900000-0000-0000-0000-000000000003');

select throws_ok(
  $sql$
    select public.manage_organization_member_v1(
      '12900000-0000-0000-0000-000000000001',
      '22900000-0000-0000-0000-000000000002',
      null, null, false, null
    )
  $sql$,
  '42501',
  'organization_member_update_forbidden',
  'ordinary member cannot manage RBAC'
);

select * from finish();
rollback;
