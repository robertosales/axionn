begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(30);

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

select public.set_tenancy_enforcement(false);

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
  ('22000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner@invite.test', '', now(), now(), now()),
  ('22000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'admin@invite.test', '', now(), now(), now()),
  ('22000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'member@invite.test', '', now(), now(), now()),
  ('22000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'other@invite.test', '', now(), now(), now()),
  ('22000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'newuser@invite.test', '', now(), now(), now()),
  ('22000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'platform@invite.test', '', now(), now(), now())
on conflict (id) do nothing;

update public.profiles
set display_name = case user_id
  when '22000000-0000-0000-0000-000000000001' then 'Owner Test'
  when '22000000-0000-0000-0000-000000000002' then 'Admin Test'
  when '22000000-0000-0000-0000-000000000003' then 'Member Test'
  when '22000000-0000-0000-0000-000000000005' then 'New User Test'
  else display_name
end
where user_id::text like '22000000-%';

insert into public.organizations (
  id, name, slug, status, plan, max_projects, max_users, max_countings_per_month
)
values
  ('12000000-0000-0000-0000-000000000001', 'Invite Tenant A', 'invite-tenant-a', 'active', 'pro', 20, 20, 100),
  ('12000000-0000-0000-0000-000000000002', 'Invite Tenant B', 'invite-tenant-b', 'active', 'pro', 20, 20, 100)
on conflict (id) do nothing;

insert into public.organization_members (
  org_id, user_id, role, is_active
)
values
  ('12000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', 'owner', true),
  ('12000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000002', 'admin', true),
  ('12000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000003', 'member', true),
  ('12000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-000000000004', 'owner', true)
on conflict (org_id, user_id) do update
set role = excluded.role, is_active = excluded.is_active;

insert into public.platform_user_roles (user_id, role)
values ('22000000-0000-0000-0000-000000000006', 'platform_admin')
on conflict do nothing;

create temporary table invite_fixture as
select *
from public.create_organization_invitation(
  '12000000-0000-0000-0000-000000000001',
  'NewUser@Invite.Test',
  'member',
  array['sala_agil', 'rdm'],
  '22000000-0000-0000-0000-000000000001',
  now() + interval '7 days'
);

select has_table('public', 'organization_invitations', 'organization invitations table exists');
select has_table('public', 'organization_member_modules', 'organization member modules table exists');
select has_table('public', 'organization_membership_audit_log', 'organization membership audit table exists');
select has_column('public', 'organization_members', 'is_active', 'organization memberships support soft deactivation');

select is(
  (select normalized_email from invite_fixture),
  'newuser@invite.test',
  'invitation email is normalized'
);

select is(
  (select count(*)::integer from public.organization_invitations where org_id = '12000000-0000-0000-0000-000000000001' and status = 'pending'),
  1,
  'one pending invitation is created'
);

select ok(
  (select raw_token from invite_fixture) is not null
  and length((select raw_token from invite_fixture)) >= 64,
  'a high-entropy raw token is returned only to the service operation'
);

select is(
  (select invitation_status from public.get_organization_invitation_preview((select raw_token from invite_fixture))),
  'pending',
  'invitation preview resolves a pending invitation'
);

select isnt(
  (select masked_email from public.get_organization_invitation_preview((select raw_token from invite_fixture))),
  'newuser@invite.test',
  'invitation preview masks the recipient email'
);

select pg_temp.authenticate_as('22000000-0000-0000-0000-000000000005');

select is(
  (select result_status from public.accept_organization_invitation((select raw_token from invite_fixture))),
  'accepted',
  'the invited user accepts the invitation'
);

select ok(
  public.is_organization_member(
    '12000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000005'
  ),
  'accepted invitation creates an active organization membership'
);

select is(
  (select role::text from public.organization_members where org_id = '12000000-0000-0000-0000-000000000001' and user_id = '22000000-0000-0000-0000-000000000005'),
  'member',
  'accepted membership uses the invitation role'
);

select results_eq(
  $query$
    select module_key
    from public.organization_member_modules
    where org_id = '12000000-0000-0000-0000-000000000001'
      and user_id = '22000000-0000-0000-0000-000000000005'
    order by module_key
  $query$,
  $expected$ values ('rdm'::text), ('sala_agil'::text) $expected$,
  'accepted membership receives organization-scoped modules'
);

select is(
  (select status from public.organization_invitations where id = (select invitation_id from invite_fixture)),
  'accepted',
  'accepted invitation becomes immutable accepted history'
);

select is(
  (select result_status from public.accept_organization_invitation((select raw_token from invite_fixture))),
  'already_accepted',
  'reusing an accepted token is idempotent'
);

select throws_ok(
  $sql$
    select * from public.create_organization_invitation(
      '12000000-0000-0000-0000-000000000001',
      'member@invite.test',
      'member',
      array['sala_agil'],
      '22000000-0000-0000-0000-000000000001',
      now() + interval '7 days'
    )
  $sql$,
  '23505',
  'organization_invitation_existing_member',
  'an active member cannot receive another invitation'
);

select pg_temp.authenticate_as('22000000-0000-0000-0000-000000000002');

select is(
  (select count(*)::integer from public.get_organization_members_v2('12000000-0000-0000-0000-000000000001')),
  4,
  'organization admin lists organization members'
);

select ok(
  public.update_organization_member_v2(
    '12000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000003',
    'admin',
    true,
    array['sustentacao']
  ),
  'organization admin updates a member role and modules'
);

select is(
  (select role::text from public.organization_members where org_id = '12000000-0000-0000-0000-000000000001' and user_id = '22000000-0000-0000-0000-000000000003'),
  'admin',
  'member role is updated to admin'
);

select results_eq(
  $query$
    select module_key from public.organization_member_modules
    where org_id = '12000000-0000-0000-0000-000000000001'
      and user_id = '22000000-0000-0000-0000-000000000003'
  $query$,
  $expected$ values ('sustentacao'::text) $expected$,
  'member modules are replaced atomically'
);

select throws_ok(
  $sql$
    select public.deactivate_organization_member_v2(
      '12000000-0000-0000-0000-000000000001',
      '22000000-0000-0000-0000-000000000001'
    )
  $sql$,
  '22023',
  'organization_owner_requires_transfer',
  'the owner cannot be deactivated without ownership transfer'
);

select ok(
  public.deactivate_organization_member_v2(
    '12000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000005'
  ),
  'organization admin can deactivate a non-owner member'
);

select is(
  public.is_organization_member(
    '12000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000005'
  ),
  false,
  'deactivated membership no longer grants organization access'
);

select pg_temp.authenticate_as('22000000-0000-0000-0000-000000000001');

select ok(
  public.transfer_organization_ownership_v2(
    '12000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000003'
  ),
  'current owner transfers ownership to an active member'
);

select is(
  (select role::text from public.organization_members where org_id = '12000000-0000-0000-0000-000000000001' and user_id = '22000000-0000-0000-0000-000000000003'),
  'owner',
  'new owner receives the owner role'
);

select is(
  (select role::text from public.organization_members where org_id = '12000000-0000-0000-0000-000000000001' and user_id = '22000000-0000-0000-0000-000000000001'),
  'admin',
  'previous owner is demoted to admin'
);

create temporary table revoke_fixture as
select *
from public.create_organization_invitation(
  '12000000-0000-0000-0000-000000000001',
  'pending@invite.test',
  'member',
  array['rdm'],
  '22000000-0000-0000-0000-000000000003',
  now() + interval '7 days'
);

select pg_temp.authenticate_as('22000000-0000-0000-0000-000000000003');

select ok(
  public.revoke_organization_invitation_v2((select invitation_id from revoke_fixture)),
  'organization owner revokes a pending invitation'
);

select is(
  (select invitation_status from public.get_organization_invitation_preview((select raw_token from revoke_fixture))),
  'revoked',
  'revoked token cannot be accepted'
);

select ok(
  not has_table_privilege('authenticated', 'public.organization_invitations', 'select')
  and not has_table_privilege('authenticated', 'public.organization_invitations', 'insert')
  and not has_table_privilege('authenticated', 'public.organization_member_modules', 'update'),
  'authenticated has no direct access to invitation domain tables'
);

select ok(
  not has_function_privilege('anon', 'public.accept_organization_invitation(text)', 'execute')
  and has_function_privilege('anon', 'public.get_organization_invitation_preview(text)', 'execute'),
  'anon can preview but cannot accept invitations'
);

select ok(
  not has_function_privilege('authenticated', 'public.create_organization_invitation(uuid,text,text,text[],uuid,timestamptz)', 'execute')
  and has_function_privilege('authenticated', 'public.get_organization_members_v2(uuid)', 'execute'),
  'raw-token creation stays service-only while tenant RPCs are authenticated'
);

select is(public.is_tenancy_enforced(), false, 'membership rollout does not change tenancy enforcement');

select * from finish();
rollback;
