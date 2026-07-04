begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(3);

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
  ('22100000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner-reuse@invite.test', '', now(), now(), now()),
  ('22100000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'recipient-reuse@invite.test', '', now(), now(), now()),
  ('22100000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'attacker-reuse@invite.test', '', now(), now(), now())
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, status, plan)
values (
  '12100000-0000-0000-0000-000000000001',
  'Invite Token Reuse Tenant',
  'invite-token-reuse-tenant',
  'active',
  'pro'
)
on conflict (id) do nothing;

insert into public.organization_members (org_id, user_id, role, is_active)
values (
  '12100000-0000-0000-0000-000000000001',
  '22100000-0000-0000-0000-000000000001',
  'owner',
  true
)
on conflict (org_id, user_id) do update set role = excluded.role, is_active = true;

create temporary table token_reuse_fixture as
select *
from public.create_organization_invitation(
  '12100000-0000-0000-0000-000000000001',
  'recipient-reuse@invite.test',
  'member',
  array['sala_agil'],
  '22100000-0000-0000-0000-000000000001',
  now() + interval '7 days'
);

select pg_temp.authenticate_as('22100000-0000-0000-0000-000000000002');

select is(
  (select result_status from public.accept_organization_invitation(
    (select raw_token from token_reuse_fixture)
  )),
  'accepted',
  'intended recipient accepts the invitation'
);

select pg_temp.authenticate_as('22100000-0000-0000-0000-000000000003');

select is(
  (select result_status from public.accept_organization_invitation(
    (select raw_token from token_reuse_fixture)
  )),
  'already_used',
  'another authenticated user cannot reuse an accepted token'
);

select is(
  public.is_organization_member(
    '12100000-0000-0000-0000-000000000001',
    '22100000-0000-0000-0000-000000000003'
  ),
  false,
  'token reuse does not create a membership for another user'
);

select * from finish();
rollback;
