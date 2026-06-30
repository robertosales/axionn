-- Axion SaaS — Fase 1.4
-- Testes pgTAP de isolamento multi-tenant.
--
-- Execução esperada em staging/local depois das migrations da Fase 1:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/tenant_isolation.sql
--
-- O arquivo roda em transação e termina com rollback.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_temp;

select plan(18);

select set_tenancy_enforcement(false);

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000001001', 'authenticated', 'authenticated', 'tenant-a@example.test', '', now(), now(), now()),
  ('00000000-0000-4000-8000-000000001002', 'authenticated', 'authenticated', 'tenant-b@example.test', '', now(), now(), now()),
  ('00000000-0000-4000-8000-000000001003', 'authenticated', 'authenticated', 'tenant-suspended@example.test', '', now(), now(), now()),
  ('00000000-0000-4000-8000-000000001004', 'authenticated', 'authenticated', 'platform-admin@example.test', '', now(), now(), now())
on conflict (id) do nothing;

insert into public.organizations (
  id, name, slug, status, plan, max_users, max_projects, max_countings_per_month
)
values
  ('00000000-0000-4000-8000-00000000a001', 'Tenant A', 'tenant-a-pgtap', 'active', 'enterprise', 100, 100, 1000),
  ('00000000-0000-4000-8000-00000000b001', 'Tenant B', 'tenant-b-pgtap', 'active', 'enterprise', 100, 100, 1000),
  ('00000000-0000-4000-8000-00000000c001', 'Tenant Suspenso', 'tenant-suspended-pgtap', 'suspended', 'enterprise', 100, 100, 1000)
on conflict (id) do nothing;

insert into public.organization_members (org_id, user_id, role)
values
  ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-000000001001', 'admin'),
  ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-000000001002', 'admin'),
  ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-000000001003', 'admin')
on conflict do nothing;

insert into public.platform_user_roles (user_id, role)
values ('00000000-0000-4000-8000-000000001004', 'platform_admin')
on conflict do nothing;

insert into public.companies (id, name, status, org_id)
values
  ('00000000-0000-4000-8000-00000000a101', 'Empresa A', 'active', '00000000-0000-4000-8000-00000000a001'),
  ('00000000-0000-4000-8000-00000000b101', 'Empresa B', 'active', '00000000-0000-4000-8000-00000000b001'),
  ('00000000-0000-4000-8000-00000000c101', 'Empresa Suspensa', 'active', '00000000-0000-4000-8000-00000000c001')
on conflict (id) do nothing;

insert into public.contracts (id, name, status, company_id, org_id, currency, room_mode)
values
  ('00000000-0000-4000-8000-00000000a201', 'Contrato A', 'active', '00000000-0000-4000-8000-00000000a101', '00000000-0000-4000-8000-00000000a001', 'BRL', 'sustentacao'),
  ('00000000-0000-4000-8000-00000000b201', 'Contrato B', 'active', '00000000-0000-4000-8000-00000000b101', '00000000-0000-4000-8000-00000000b001', 'BRL', 'sustentacao'),
  ('00000000-0000-4000-8000-00000000c201', 'Contrato Suspenso', 'active', '00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000c001', 'BRL', 'sustentacao')
on conflict (id) do nothing;

insert into public.teams (id, name, module, company_id, org_id)
values
  ('00000000-0000-4000-8000-00000000a301', 'Time A', 'sustentacao', '00000000-0000-4000-8000-00000000a101', '00000000-0000-4000-8000-00000000a001'),
  ('00000000-0000-4000-8000-00000000b301', 'Time B', 'sustentacao', '00000000-0000-4000-8000-00000000b101', '00000000-0000-4000-8000-00000000b001'),
  ('00000000-0000-4000-8000-00000000c301', 'Time Suspenso', 'sustentacao', '00000000-0000-4000-8000-00000000c101', '00000000-0000-4000-8000-00000000c001')
on conflict (id) do nothing;

insert into public.projects (id, name, status, module_type, contract_id, team_id, org_id)
values
  ('00000000-0000-4000-8000-00000000a401', 'Projeto A', 'active', 'sustenance', '00000000-0000-4000-8000-00000000a201', '00000000-0000-4000-8000-00000000a301', '00000000-0000-4000-8000-00000000a001'),
  ('00000000-0000-4000-8000-00000000b401', 'Projeto B', 'active', 'sustenance', '00000000-0000-4000-8000-00000000b201', '00000000-0000-4000-8000-00000000b301', '00000000-0000-4000-8000-00000000b001'),
  ('00000000-0000-4000-8000-00000000c401', 'Projeto Suspenso', 'active', 'sustenance', '00000000-0000-4000-8000-00000000c201', '00000000-0000-4000-8000-00000000c301', '00000000-0000-4000-8000-00000000c001')
on conflict (id) do nothing;

-- Usuário da organização A.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(public.can_read_organization('00000000-0000-4000-8000-00000000a001'), 'usuário A lê a organização A');
select ok(not public.can_read_organization('00000000-0000-4000-8000-00000000b001'), 'usuário A não lê a organização B');
select ok(public.can_operate_organization('00000000-0000-4000-8000-00000000a001'), 'usuário A opera organização ativa A');
select ok(not public.can_operate_organization('00000000-0000-4000-8000-00000000b001'), 'usuário A não opera organização B');

select is(
  (select count(*)::integer from public.get_accessible_contracts_v2('00000000-0000-4000-8000-00000000a001')),
  1,
  'usuário A lista somente contratos da organização A'
);
select is(
  (select array_agg(name order by name)::text from public.get_accessible_contracts_v2('00000000-0000-4000-8000-00000000a001')),
  '{Contrato A}',
  'contratos acessíveis de A não incluem B'
);
select is(
  (select array_agg(name order by name)::text from public.get_accessible_projects_v2('00000000-0000-4000-8000-00000000a001', null)),'{Projeto A}',
  'projetos acessíveis de A não incluem B'
);
select is(
  (select array_agg(name order by name)::text from public.get_accessible_teams_v2('00000000-0000-4000-8000-00000000a001')),
  '{Time A}',
  'times acessíveis de A não incluem B'
);

-- Usuário da organização B.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(public.can_read_organization('00000000-0000-4000-8000-00000000b001'), 'usuário B lê a organização B');
select ok(not public.can_read_organization('00000000-0000-4000-8000-00000000a001'), 'usuário B não lê a organização A');
select is(
  (select array_agg(name order by name)::text from public.get_accessible_contracts_v2('00000000-0000-4000-8000-00000000b001')),
  '{Contrato B}',
  'contratos acessíveis de B não incluem A'
);

-- Organização suspensa: leitura permitida ao membro, operação bloqueada.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(public.can_read_organization('00000000-0000-4000-8000-00000000c001'), 'membro lê organização suspensa');
select ok(not public.can_operate_organization('00000000-0000-4000-8000-00000000c001'), 'membro não opera organização suspensa');

-- Administrador da plataforma mantém operação para suporte.
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000001004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select ok(public.is_platform_admin(), 'usuário de plataforma é reconhecido como platform_admin');
select ok(public.can_operate_organization('00000000-0000-4000-8000-00000000c001'), 'platform_admin pode operar organização suspensa para suporte');

-- Triggers de consistência entre organizações.
select set_tenancy_enforcement(true);

select throws_like(
  $$ insert into public.contract_teams (contract_id, team_id)
     values ('00000000-0000-4000-8000-00000000a201', '00000000-0000-4000-8000-00000000b301') $$,
  '%contract_team_organization_mismatch%',
  'não permite vincular contrato A a time B'
);

select throws_like(
  $$ insert into public.contract_room_teams (contract_id, team_id, room_type)
     values ('00000000-0000-4000-8000-00000000a201', '00000000-0000-4000-8000-00000000b301', 'sustentacao') $$,
  '%contract_room_team_organization_mismatch%',
  'não permite sala contratual com time de outra organização'
);

select throws_like(
  $$ insert into public.projects (id, name, status, module_type, contract_id, team_id, org_id)
     values ('00000000-0000-4000-8000-00000000a499', 'Projeto Cruzado', 'active', 'sustenance', '00000000-0000-4000-8000-00000000a201', '00000000-0000-4000-8000-00000000b301', '00000000-0000-4000-8000-00000000a001') $$,
  '%project_relationship_organization_mismatch%',
  'não permite projeto com contrato A e time B'
);

select set_tenancy_enforcement(false);

select * from finish();
rollback;
