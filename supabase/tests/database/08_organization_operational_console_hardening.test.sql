\ir ../../migrations/20260704080000_organization_operational_console_hardening.sql
\ir ../../migrations/20260704080100_platform_ai_provider_hardening.sql

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

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
values
 ('22500000-0000-0000-0000-000000000001','authenticated','authenticated','console-admin@test.local','',now(),now(),now()),
 ('22500000-0000-0000-0000-000000000002','authenticated','authenticated','console-member@test.local','',now(),now(),now()),
 ('22500000-0000-0000-0000-000000000003','authenticated','authenticated','platform-admin@test.local','',now(),now(),now())
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, status, plan)
values
 ('12500000-0000-0000-0000-000000000001','Console Tenant A','console-tenant-a','active','pro'),
 ('12500000-0000-0000-0000-000000000002','Console Tenant B','console-tenant-b','active','pro')
on conflict (id) do nothing;

insert into public.organization_members (org_id, user_id, role, is_active)
values
 ('12500000-0000-0000-0000-000000000001','22500000-0000-0000-0000-000000000001','admin',true),
 ('12500000-0000-0000-0000-000000000001','22500000-0000-0000-0000-000000000002','member',true)
on conflict (org_id, user_id) do update set role=excluded.role, is_active=true;

insert into public.platform_user_roles (user_id, role)
values ('22500000-0000-0000-0000-000000000003','platform_admin')
on conflict (user_id, role) do nothing;

insert into public.companies (id, org_id, name, status)
values
 ('32500000-0000-0000-0000-000000000001','12500000-0000-0000-0000-000000000001','Company A','active'),
 ('32500000-0000-0000-0000-000000000002','12500000-0000-0000-0000-000000000002','Company B','active')
on conflict (id) do nothing;

insert into public.contracts (id, org_id, company_id, name, status)
values
 ('42500000-0000-0000-0000-000000000001','12500000-0000-0000-0000-000000000001','32500000-0000-0000-0000-000000000001','Contract A','active'),
 ('42500000-0000-0000-0000-000000000002','12500000-0000-0000-0000-000000000002','32500000-0000-0000-0000-000000000002','Contract B','active')
on conflict (id) do nothing;

select pg_temp.authenticate_as('22500000-0000-0000-0000-000000000001');
select lives_ok($sql$select public.create_organization_project_v2('12500000-0000-0000-0000-000000000001','42500000-0000-0000-0000-000000000001',null,'Project A',null,null,'agile',null)$sql$,'admin creates project in own tenant');
select throws_ok($sql$select public.create_organization_project_v2('12500000-0000-0000-0000-000000000001','42500000-0000-0000-0000-000000000002',null,'Cross Project',null,null,'agile',null)$sql$,'42501','resource_cross_tenant','cross tenant project is blocked');
select lives_ok($sql$select public.create_organization_team_v2('12500000-0000-0000-0000-000000000001','Team A','sala_agil','32500000-0000-0000-0000-000000000001','42500000-0000-0000-0000-000000000001')$sql$,'admin creates team in own tenant');
select throws_ok($sql$select public.create_organization_team_v2('12500000-0000-0000-0000-000000000001','Cross Team','sala_agil','32500000-0000-0000-0000-000000000002',null)$sql$,'42501','resource_cross_tenant','cross tenant team is blocked');

select pg_temp.authenticate_as('22500000-0000-0000-0000-000000000002');
select throws_ok($sql$select public.create_organization_project_v2('12500000-0000-0000-0000-000000000001','42500000-0000-0000-0000-000000000001',null,'Forbidden',null,null,'agile',null)$sql$,'42501','organization_access_denied','member cannot mutate resources');
select throws_ok($sql$select * from public.list_platform_ai_providers_v2(false)$sql$,'42501','platform_admin_required','member cannot list platform providers');

select pg_temp.authenticate_as('22500000-0000-0000-0000-000000000003');
select lives_ok($sql$select * from public.list_platform_ai_providers_v2(false)$sql$,'platform admin lists provider metadata');
select lives_ok($sql$select public.create_platform_ai_provider_v2('Test Provider','test-provider','test-model','https://example.com/v1','openai_compatible',false,true)$sql$,'platform admin creates provider');

select * from finish();
rollback;
