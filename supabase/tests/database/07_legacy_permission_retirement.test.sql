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
  ('22600000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'single-umr@lote6.test', '', now(), now(), now()),
  ('22600000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'single-profile@lote6.test', '', now(), now(), now()),
  ('22600000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'multi@lote6.test', '', now(), now(), now()),
  ('22600000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'existing@lote6.test', '', now(), now(), now()),
  ('22600000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'inactive@lote6.test', '', now(), now(), now()),
  ('22600000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'platform@lote6.test', '', now(), now(), now()),
  ('22600000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'common@lote6.test', '', now(), now(), now())
on conflict (id) do nothing;

insert into public.profiles (user_id, display_name, email, module_access, is_active)
values
  ('22600000-0000-0000-0000-000000000001', 'Single UMR', 'single-umr@lote6.test', 'sala_agil', true),
  ('22600000-0000-0000-0000-000000000002', 'Single Profile', 'single-profile@lote6.test', 'admin', true),
  ('22600000-0000-0000-0000-000000000003', 'Multi Org', 'multi@lote6.test', 'admin', true),
  ('22600000-0000-0000-0000-000000000004', 'Existing Org', 'existing@lote6.test', 'admin', true),
  ('22600000-0000-0000-0000-000000000005', 'Inactive', 'inactive@lote6.test', 'rdm', true),
  ('22600000-0000-0000-0000-000000000006', 'Platform', 'platform@lote6.test', 'sala_agil', true),
  ('22600000-0000-0000-0000-000000000007', 'Common', 'common@lote6.test', 'sala_agil', true)
on conflict (user_id) do update
  set module_access = excluded.module_access,
      is_active = excluded.is_active;

insert into public.organizations (id, name, slug, status, plan)
values
  ('12600000-0000-0000-0000-000000000001', 'Lote 6 Org A', 'lote6-a', 'active', 'pro'),
  ('12600000-0000-0000-0000-000000000002', 'Lote 6 Org B', 'lote6-b', 'active', 'pro')
on conflict (id) do nothing;

insert into public.organization_members (org_id, user_id, role, is_active)
values
  ('12600000-0000-0000-0000-000000000001', '22600000-0000-0000-0000-000000000001', 'member', true),
  ('12600000-0000-0000-0000-000000000001', '22600000-0000-0000-0000-000000000002', 'member', true),
  ('12600000-0000-0000-0000-000000000001', '22600000-0000-0000-0000-000000000003', 'member', true),
  ('12600000-0000-0000-0000-000000000002', '22600000-0000-0000-0000-000000000003', 'member', true),
  ('12600000-0000-0000-0000-000000000001', '22600000-0000-0000-0000-000000000004', 'admin', true),
  ('12600000-0000-0000-0000-000000000001', '22600000-0000-0000-0000-000000000005', 'member', false),
  ('12600000-0000-0000-0000-000000000001', '22600000-0000-0000-0000-000000000007', 'member', true)
on conflict (org_id, user_id) do update
  set role = excluded.role,
      is_active = excluded.is_active;

insert into public.user_module_roles (user_id, module, role_name)
values
  ('22600000-0000-0000-0000-000000000001', 'sustentacao', 'member'),
  ('22600000-0000-0000-0000-000000000003', 'rdm', 'admin'),
  ('22600000-0000-0000-0000-000000000005', 'rdm', 'member')
on conflict do nothing;

insert into public.organization_member_modules (org_id, user_id, module_key, role_name)
values
  ('12600000-0000-0000-0000-000000000001', '22600000-0000-0000-0000-000000000004', 'rdm', 'member')
on conflict (org_id, user_id, module_key) do update set role_name = excluded.role_name;

insert into public.platform_user_roles (user_id, role)
values ('22600000-0000-0000-0000-000000000006', 'platform_admin')
on conflict do nothing;

\ir ../../migrations/20260704060000_organization_permission_authority.sql

select results_eq(
  $query$
    select module_key, role_name
    from public.organization_member_modules
    where org_id = '12600000-0000-0000-0000-000000000001'
      and user_id = '22600000-0000-0000-0000-000000000001'
    order by module_key
  $query$,
  $expected$ values ('sustentacao'::text, 'member'::text) $expected$,
  'backfill uses user_module_roles for a single active organization'
);

select results_eq(
  $query$
    select module_key, role_name
    from public.organization_member_modules
    where org_id = '12600000-0000-0000-0000-000000000001'
      and user_id = '22600000-0000-0000-0000-000000000002'
    order by module_key
  $query$,
  $expected$
    values
      ('rdm'::text, 'member'::text),
      ('sala_agil'::text, 'member'::text),
      ('sustentacao'::text, 'member'::text)
  $expected$,
  'profile.module_access admin does not promote member to admin'
);

select is(
  (
    select count(*)::integer
    from public.organization_member_modules
    where user_id = '22600000-0000-0000-0000-000000000003'
  ),
  0,
  'multi-organization user is not automatically backfilled'
);

select results_eq(
  $query$
    select module_key, role_name
    from public.organization_member_modules
    where org_id = '12600000-0000-0000-0000-000000000001'
      and user_id = '22600000-0000-0000-0000-000000000004'
    order by module_key
  $query$,
  $expected$ values ('rdm'::text, 'member'::text) $expected$,
  'existing organization module configuration is preserved'
);

select is(
  (
    select count(*)::integer
    from public.organization_member_modules
    where user_id = '22600000-0000-0000-0000-000000000005'
  ),
  0,
  'inactive membership receives no module access'
);

select pg_temp.authenticate_as('22600000-0000-0000-0000-000000000007');

select throws_ok(
  $sql$ select public.set_organization_legacy_permission_fallback(false) $sql$,
  '42501',
  'organization_legacy_permission_fallback_toggle_denied',
  'common user cannot toggle fallback'
);

select pg_temp.authenticate_as('22600000-0000-0000-0000-000000000006');

select lives_ok(
  $sql$ select public.set_organization_legacy_permission_fallback(false) $sql$,
  'platform admin can disable fallback'
);

select is(
  public.is_organization_legacy_permission_fallback_enabled(),
  false,
  'fallback disabled flag is readable'
);

select lives_ok(
  $sql$ select public.set_organization_legacy_permission_fallback(true) $sql$,
  'rollback reactivates only the fallback flag'
);

select is(
  public.is_organization_legacy_permission_fallback_enabled(),
  true,
  'fallback enabled after rollback'
);

select is(
  (
    select count(*)::integer
    from public.user_module_roles
    where user_id in (
      '22600000-0000-0000-0000-000000000001',
      '22600000-0000-0000-0000-000000000003',
      '22600000-0000-0000-0000-000000000005'
    )
  ),
  3,
  'legacy user_module_roles rows are not deleted'
);

select is(
  (
    select module_access
    from public.profiles
    where user_id = '22600000-0000-0000-0000-000000000002'
  ),
  'admin',
  'legacy profile.module_access is not removed'
);

select is(
  (
    select count(*)::integer
    from public.organization_member_modules
    where user_id = '22600000-0000-0000-0000-000000000003'
  ),
  0,
  'no cross-tenant access amplification occurs'
);

select * from finish();
rollback;
