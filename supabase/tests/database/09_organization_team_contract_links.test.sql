\ir ../../migrations/20260704080200_organization_team_contract_links.sql

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);

create or replace function pg_temp.authenticate_as(p_user_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
end;
$$;

insert into public.contracts (id, name, status)
values ('d59ab6dc-421f-41b4-b415-ae0bc072ebd4', 'Auth Fixture Contract', 'active')
on conflict (id) do nothing;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('22600000-0000-0000-0000-000000000001','authenticated','authenticated','team-links-admin@test.local','',now(),now(),now())
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, status, plan)
values
 ('12600000-0000-0000-0000-000000000001','Team Links Tenant A','team-links-a','active','pro'),
 ('12600000-0000-0000-0000-000000000002','Team Links Tenant B','team-links-b','active','pro')
on conflict (id) do nothing;

insert into public.organization_members (org_id, user_id, role, is_active)
values ('12600000-0000-0000-0000-000000000001','22600000-0000-0000-0000-000000000001','admin',true)
on conflict (org_id, user_id) do update set role=excluded.role, is_active=true;

insert into public.companies (id, org_id, name, status)
values
 ('32600000-0000-0000-0000-000000000001','12600000-0000-0000-0000-000000000001','Team Company A','active'),
 ('32600000-0000-0000-0000-000000000002','12600000-0000-0000-0000-000000000002','Team Company B','active')
on conflict (id) do nothing;

insert into public.contracts (id, org_id, company_id, name, status)
values
 ('42600000-0000-0000-0000-000000000001','12600000-0000-0000-0000-000000000001','32600000-0000-0000-0000-000000000001','Team Contract A1','active'),
 ('42600000-0000-0000-0000-000000000002','12600000-0000-0000-0000-000000000001','32600000-0000-0000-0000-000000000001','Team Contract A2','active'),
 ('42600000-0000-0000-0000-000000000003','12600000-0000-0000-0000-000000000002','32600000-0000-0000-0000-000000000002','Team Contract B','active')
on conflict (id) do nothing;

insert into public.teams (id, org_id, name, module, company_id, contract_id, is_active)
values ('52600000-0000-0000-0000-000000000001','12600000-0000-0000-0000-000000000001','Scoped Team','sala_agil','32600000-0000-0000-0000-000000000001','42600000-0000-0000-0000-000000000001',true)
on conflict (id) do nothing;

insert into public.contract_teams (contract_id, team_id)
values ('42600000-0000-0000-0000-000000000001','52600000-0000-0000-0000-000000000001')
on conflict do nothing;

select pg_temp.authenticate_as('22600000-0000-0000-0000-000000000001');

select lives_ok(
  $sql$select public.update_organization_team_v2('12600000-0000-0000-0000-000000000001','52600000-0000-0000-0000-000000000001','Scoped Team','sala_agil','32600000-0000-0000-0000-000000000001','42600000-0000-0000-0000-000000000002')$sql$,
  'team can move to another contract in the same tenant'
);

select is(
  (select contract_id from public.teams where id='52600000-0000-0000-0000-000000000001'),
  '42600000-0000-0000-0000-000000000002'::uuid,
  'teams.contract_id points to the new contract'
);

select is(
  (select count(*)::integer from public.contract_teams where team_id='52600000-0000-0000-0000-000000000001' and contract_id='42600000-0000-0000-0000-000000000001'),
  0,
  'old contract_teams link is removed'
);

select is(
  (select count(*)::integer from public.contract_teams where team_id='52600000-0000-0000-0000-000000000001' and contract_id='42600000-0000-0000-0000-000000000002'),
  1,
  'new contract_teams link is created'
);

select throws_ok(
  $sql$select public.update_organization_team_v2('12600000-0000-0000-0000-000000000001','52600000-0000-0000-0000-000000000001','Scoped Team','sala_agil','32600000-0000-0000-0000-000000000001','42600000-0000-0000-0000-000000000003')$sql$,
  '42501',
  'resource_cross_tenant',
  'cross tenant contract remains blocked'
);

select lives_ok(
  $sql$select public.update_organization_team_v2('12600000-0000-0000-0000-000000000001','52600000-0000-0000-0000-000000000001','Scoped Team','sala_agil','32600000-0000-0000-0000-000000000001',null)$sql$,
  'team can be detached from a contract'
);

select is(
  (select count(*)::integer from public.contract_teams where team_id='52600000-0000-0000-0000-000000000001'),
  0,
  'detaching removes tenant contract links'
);

select * from finish();
rollback;
