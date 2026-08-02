begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(4);

select ok(
  (select relrowsecurity
   from pg_class relation
   join pg_namespace namespace on namespace.oid = relation.relnamespace
   where namespace.nspname = 'public' and relation.relname = 'team_members'),
  'RLS remains enabled on team_members'
);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'team_members'
      and policyname = 'tm_member_insert_self'
  ),
  'authenticated users cannot self-insert into an arbitrary team'
);

select ok(
  has_function_privilege(
    'authenticated',
    'public.add_organization_team_member_v2(uuid,uuid,uuid,text)',
    'execute'
  ),
  'authenticated organization admins retain the guarded membership RPC'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.add_organization_team_member_v2(uuid,uuid,uuid,text)',
    'execute'
  ),
  'service role retains the guarded membership RPC'
);

select * from finish();
rollback;
