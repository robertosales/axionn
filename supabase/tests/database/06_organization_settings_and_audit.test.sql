\ir ../../migrations/20260704050000_organization_settings_and_audit.sql

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

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
values (
  'd59ab6dc-421f-41b4-b415-ae0bc072ebd4',
  'Auth Fixture Contract',
  'active'
)
on conflict (id) do nothing;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
)
values
  ('22400000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'settings-admin@test.local', '', now(), now(), now()),
  ('22400000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'settings-member@test.local', '', now(), now(), now())
on conflict (id) do nothing;

insert into public.organizations (
  id, name, slug, status, plan, contact_name, contact_email
)
values (
  '12400000-0000-0000-0000-000000000001',
  'Settings Tenant',
  'settings-tenant',
  'active',
  'pro',
  'Contato Inicial',
  'initial@test.local'
)
on conflict (id) do nothing;

insert into public.organization_members (org_id, user_id, role, is_active)
values
  ('12400000-0000-0000-0000-000000000001', '22400000-0000-0000-0000-000000000001', 'admin', true),
  ('12400000-0000-0000-0000-000000000001', '22400000-0000-0000-0000-000000000002', 'member', true)
on conflict (org_id, user_id) do update
set role = excluded.role,
    is_active = true;

select pg_temp.authenticate_as('22400000-0000-0000-0000-000000000001');

select results_eq(
  $query$
    select name, slug, contact_email
    from public.get_organization_settings_v2(
      '12400000-0000-0000-0000-000000000001'
    )
  $query$,
  $expected$
    values ('Settings Tenant'::text, 'settings-tenant'::text, 'initial@test.local'::text)
  $expected$,
  'organization admin can read settings'
);

select lives_ok(
  $sql$
    select *
    from public.update_organization_settings_v2(
      '12400000-0000-0000-0000-000000000001',
      'Settings Tenant Updated',
      'Novo Contato',
      'contact@test.local',
      'https://example.com/logo.png'
    )
  $sql$,
  'organization admin can update safe settings'
);

select is(
  (
    select organization.name
    from public.organizations organization
    where organization.id = '12400000-0000-0000-0000-000000000001'
  ),
  'Settings Tenant Updated',
  'organization name is updated'
);

select is(
  (
    select organization.slug
    from public.organizations organization
    where organization.id = '12400000-0000-0000-0000-000000000001'
  ),
  'settings-tenant',
  'technical slug remains unchanged'
);

select is(
  (
    select count(*)::integer
    from public.organization_settings_audit_log audit
    where audit.org_id = '12400000-0000-0000-0000-000000000001'
  ),
  1,
  'settings update creates one audit event'
);

select results_eq(
  $query$
    select changed_fields
    from public.organization_settings_audit_log audit
    where audit.org_id = '12400000-0000-0000-0000-000000000001'
  $query$,
  $expected$
    values (array['name', 'contact_name', 'contact_email', 'logo_url']::text[])
  $expected$,
  'audit event identifies all changed fields'
);

do $$
begin
  perform *
  from public.update_organization_settings_v2(
    '12400000-0000-0000-0000-000000000001',
    'Settings Tenant Updated',
    'Novo Contato',
    'contact@test.local',
    'https://example.com/logo.png'
  );
end;
$$;

select is(
  (
    select count(*)::integer
    from public.organization_settings_audit_log audit
    where audit.org_id = '12400000-0000-0000-0000-000000000001'
  ),
  1,
  'no-op update does not duplicate audit events'
);

select pg_temp.authenticate_as('22400000-0000-0000-0000-000000000002');

select throws_ok(
  $sql$
    select *
    from public.get_organization_settings_v2(
      '12400000-0000-0000-0000-000000000001'
    )
  $sql$,
  '42501',
  'organization_settings_access_denied',
  'regular member cannot read administrative settings'
);

select throws_ok(
  $sql$
    select *
    from public.update_organization_settings_v2(
      '12400000-0000-0000-0000-000000000001',
      'Forbidden Update',
      null,
      null,
      null
    )
  $sql$,
  '42501',
  'organization_settings_update_denied',
  'regular member cannot update organization settings'
);

select * from finish();
rollback;
