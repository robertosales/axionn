\ir ../../operations/20260704_02_organization_member_invitations_rollout.sql

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

select has_table(
  'public',
  'organization_invitations',
  'Lovable rollout creates organization invitations'
);

select has_table(
  'public',
  'organization_member_modules',
  'Lovable rollout creates organization module memberships'
);

select has_table(
  'public',
  'organization_membership_audit_log',
  'Lovable rollout creates membership audit log'
);

select has_column(
  'public',
  'organization_members',
  'is_active',
  'Lovable rollout adds soft membership deactivation'
);

select ok(
  not has_table_privilege('authenticated', 'public.organization_invitations', 'select')
  and not has_table_privilege('authenticated', 'public.organization_invitations', 'insert')
  and not has_table_privilege('anon', 'public.organization_invitations', 'select'),
  'Lovable rollout revokes direct client table access'
);

select ok(
  has_function_privilege('authenticated', 'public.get_organization_members_v2(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.get_organization_invitations_v2(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.accept_organization_invitation(text)', 'execute'),
  'Lovable rollout exposes tenant-scoped membership RPCs'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_organization_invitation(uuid,text,text,text[],uuid,timestamptz)',
    'execute'
  )
  and has_function_privilege(
    'service_role',
    'public.create_organization_invitation(uuid,text,text,text[],uuid,timestamptz)',
    'execute'
  ),
  'raw-token creation remains service-role only'
);

select ok(
  to_regprocedure('public.digest(text,text)') is null,
  'temporary crypto compatibility wrapper is absent'
);

select * from finish();
rollback;
