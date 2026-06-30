-- Axion SaaS — Fase 0
-- Auditoria somente leitura para executar no Supabase SQL Editor.
-- Este arquivo não altera policies, grants, tabelas ou funções.

-- 1. Tabelas expostas sem RLS.
select
  n.nspname as schema_name,
  c.relname as relation_name,
  c.relkind,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and not c.relrowsecurity
order by c.relname;

-- 2. Quantidade de policies por tabela e operação.
select
  schemaname,
  tablename,
  cmd,
  count(*) as policy_count,
  string_agg(policyname, ', ' order by policyname) as policies
from pg_policies
where schemaname = 'public'
group by schemaname, tablename, cmd
order by tablename, cmd;

-- 3. Tabelas sem vínculo direto com organization/company/contract/team.
-- Resultado é triagem: algumas relações chegam ao tenant por FK intermediária.
select
  c.table_name
from information_schema.tables c
where c.table_schema = 'public'
  and c.table_type = 'BASE TABLE'
  and not exists (
    select 1
    from information_schema.columns col
    where col.table_schema = c.table_schema
      and col.table_name = c.table_name
      and col.column_name in (
        'org_id',
        'organization_id',
        'company_id',
        'contract_id',
        'project_id',
        'team_id',
        'user_id'
      )
  )
order by c.table_name;

-- 4. Colunas de tenancy atualmente presentes.
select
  table_name,
  string_agg(column_name, ', ' order by ordinal_position) as tenant_columns
from information_schema.columns
where table_schema = 'public'
  and column_name in (
    'org_id',
    'organization_id',
    'company_id',
    'contract_id',
    'project_id',
    'team_id',
    'user_id'
  )
group by table_name
order by table_name;

-- 5. Grants de tabelas para os papéis acessíveis pela API.
select
  grantee,
  table_schema,
  table_name,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'public')
group by grantee, table_schema, table_name
order by table_name, grantee;

-- 6. Grants de rotinas para anon/authenticated/public.
select
  routine_schema,
  routine_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_routine_grants
where routine_schema = 'public'
  and grantee in ('anon', 'authenticated', 'public')
group by routine_schema, routine_name, grantee
order by routine_name, grantee;

-- 7. Funções SECURITY DEFINER para revisão obrigatória.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  coalesce(array_to_string(p.proconfig, ', '), '') as function_config,
  pg_get_userbyid(p.proowner) as owner
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef
order by p.proname;

-- 8. Funções com nomes sensíveis e seus grants efetivos.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname ilike '%service_role%'
    or p.proname ilike '%provider_key%'
    or p.proname ilike '%secret%'
    or p.proname ilike '%license%'
    or p.proname ilike '%admin%'
  )
order by p.proname;

-- 9. Views públicas: confirmar security_invoker e grants.
select
  n.nspname as schema_name,
  c.relname as view_name,
  c.reloptions,
  pg_get_userbyid(c.relowner) as owner
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('v', 'm')
order by c.relname;

-- 10. Índices iniciados por colunas comuns de isolamento.
select
  schemaname,
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and (
    indexdef ilike '%(organization_id%'
    or indexdef ilike '%(org_id%'
    or indexdef ilike '%(company_id%'
    or indexdef ilike '%(contract_id%'
    or indexdef ilike '%(team_id%'
  )
order by tablename, indexname;

-- 11. Registros potencialmente órfãos nas entidades centrais.
select 'teams_without_company_or_contract' as check_name, count(*) as affected_rows
from public.teams
where company_id is null and contract_id is null
union all
select 'contracts_without_company_or_org', count(*)
from public.contracts
where company_id is null and org_id is null
union all
select 'projects_without_contract_or_team', count(*)
from public.projects
where contract_id is null and team_id is null
union all
select 'profiles_without_team', count(*)
from public.profiles
where team_id is null;

-- 12. Duplicidade de memberships que deverá ser consolidada na Fase 1.
select 'organization_members' as membership_source, count(*) as total from public.organization_members
union all
select 'contract_members', count(*) from public.contract_members
union all
select 'user_contracts', count(*) from public.user_contracts
union all
select 'team_members', count(*) from public.team_members;
