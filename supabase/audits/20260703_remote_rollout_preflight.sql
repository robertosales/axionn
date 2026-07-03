-- Axion SaaS — preflight remoto para Lovable Cloud
-- SOMENTE LEITURA. Este arquivo não aplica migrations, não altera histórico
-- e não ativa o enforcement multi-tenant.

-- 1. Histórico remoto das migrations relevantes.
with expected(version) as (
  values
    ('20260630010000'),
    ('20260630011000'),
    ('20260630015900'),
    ('20260630019000'),
    ('20260630019500'),
    ('20260630020000'),
    ('20260630020500'),
    ('20260630021000'),
    ('20260630022000'),
    ('20260630023000'),
    ('20260702000026'),
    ('20260702000027'),
    ('20260702000028'),
    ('20260702000029'),
    ('20260702000030'),
    ('20260702000031')
)
select
  expected.version,
  exists (
    select 1
    from supabase_migrations.schema_migrations recorded
    where recorded.version = expected.version
  ) as recorded
from expected
order by expected.version;

-- 2. Objetos principais esperados pelas migrations 20260630*.
select *
from (
  values
    ('table', 'public.ai_usage_events', to_regclass('public.ai_usage_events') is not null),
    ('table', 'public.ai_usage_rate_limits', to_regclass('public.ai_usage_rate_limits') is not null),
    ('table', 'public.platform_user_roles', to_regclass('public.platform_user_roles') is not null),
    ('table', 'public.saas_runtime_settings', to_regclass('public.saas_runtime_settings') is not null),
    ('function', 'public.reserve_ai_usage(uuid,uuid,text,uuid)', to_regprocedure('public.reserve_ai_usage(uuid,uuid,text,uuid)') is not null),
    ('function', 'public.finalize_ai_usage(uuid,text,uuid,text,jsonb)', to_regprocedure('public.finalize_ai_usage(uuid,text,uuid,text,jsonb)') is not null),
    ('function', 'public.enforce_ai_usage_rate_limit()', to_regprocedure('public.enforce_ai_usage_rate_limit()') is not null),
    ('function', 'public.audit_log_trigger_fn()', to_regprocedure('public.audit_log_trigger_fn()') is not null),
    ('function', 'public.is_platform_admin(uuid)', to_regprocedure('public.is_platform_admin(uuid)') is not null),
    ('function', 'public.is_organization_member(uuid,uuid)', to_regprocedure('public.is_organization_member(uuid,uuid)') is not null),
    ('function', 'public.is_organization_admin(uuid,uuid)', to_regprocedure('public.is_organization_admin(uuid,uuid)') is not null),
    ('function', 'public.resolve_contract_org_id(uuid)', to_regprocedure('public.resolve_contract_org_id(uuid)') is not null),
    ('function', 'public.resolve_team_org_id(uuid)', to_regprocedure('public.resolve_team_org_id(uuid)') is not null),
    ('function', 'public.resolve_project_org_id(uuid)', to_regprocedure('public.resolve_project_org_id(uuid)') is not null),
    ('function', 'public.get_my_organizations_v2()', to_regprocedure('public.get_my_organizations_v2()') is not null),
    ('function', 'public.get_accessible_teams_v2(uuid)', to_regprocedure('public.get_accessible_teams_v2(uuid)') is not null),
    ('function', 'public.is_tenancy_enforced()', to_regprocedure('public.is_tenancy_enforced()') is not null),
    ('function', 'public.set_tenancy_enforcement(boolean)', to_regprocedure('public.set_tenancy_enforcement(boolean)') is not null),
    ('function', 'public.can_read_organization(uuid)', to_regprocedure('public.can_read_organization(uuid)') is not null),
    ('function', 'public.can_operate_organization(uuid)', to_regprocedure('public.can_operate_organization(uuid)') is not null),
    ('function', 'public.get_accessible_companies_v2(uuid)', to_regprocedure('public.get_accessible_companies_v2(uuid)') is not null),
    ('function', 'public.get_accessible_contracts_v2(uuid)', to_regprocedure('public.get_accessible_contracts_v2(uuid)') is not null),
    ('function', 'public.get_accessible_projects_v2(uuid,uuid)', to_regprocedure('public.get_accessible_projects_v2(uuid,uuid)') is not null),
    ('function', 'public.get_tenancy_readiness_report()', to_regprocedure('public.get_tenancy_readiness_report()') is not null)
) as object_check(object_type, object_name, present)
order by object_type, object_name;

-- 3. Colunas org_id esperadas na fundação multi-tenant.
select
  expected.table_name,
  exists (
    select 1
    from information_schema.columns column_info
    where column_info.table_schema = 'public'
      and column_info.table_name = expected.table_name
      and column_info.column_name = 'org_id'
  ) as org_id_present
from (values ('companies'), ('contracts'), ('teams'), ('projects')) as expected(table_name)
order by expected.table_name;

-- 4. Estrutura e RLS de contract_teams.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls,
  obj_description(c.oid, 'pg_class') as table_comment
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'contract_teams';

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'contract_teams'
order by indexname;

select policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'contract_teams'
order by policyname;

-- 5. Policies tenant_boundary esperadas na migration 22000.
select
  expected.table_name,
  expected.policy_name,
  exists (
    select 1
    from pg_policies policy
    where policy.schemaname = 'public'
      and policy.tablename = expected.table_name
      and policy.policyname = expected.policy_name
  ) as present
from (
  values
    ('companies', 'companies_tenant_boundary'),
    ('contracts', 'contracts_tenant_boundary'),
    ('teams', 'teams_tenant_boundary'),
    ('projects', 'projects_tenant_boundary'),
    ('contract_teams', 'contract_teams_tenant_boundary'),
    ('contract_room_teams', 'contract_room_teams_tenant_boundary'),
    ('contract_slas', 'contract_slas_tenant_boundary')
) as expected(table_name, policy_name)
order by expected.table_name;

-- 6. Triggers de tenancy e IA.
select
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'trg_ai_usage_rate_limit',
    'trg_company_org_boundary',
    'trg_contract_org_consistency',
    'trg_team_org_consistency',
    'trg_project_org_consistency',
    'trg_contract_team_org_consistency',
    'trg_contract_room_team_org_consistency'
  )
order by trigger_name, event_manipulation;

-- 7. Definições das funções críticas existentes.
select
  p.oid::regprocedure::text as function_signature,
  p.prosecdef as security_definer,
  p.proacl,
  p.proconfig,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'audit_log_trigger_fn',
    'apply_apf_counting_brain_factor',
    'apply_apf_conservative_process_defaults',
    'log_apf_process_learning_decision',
    'resolve_apf_factor_decision',
    'get_apf_process_analysis',
    'materialize_apf_process_analysis',
    'resolve_apf_process_analysis',
    'extract_user_story_external_reference',
    'assign_user_story_identity'
  )
order by p.proname, pg_get_function_identity_arguments(p.oid);

-- 8. Definições de views APF/User Stories.
select
  schemaname,
  viewname,
  pg_get_viewdef(format('%I.%I', schemaname, viewname)::regclass, true) as view_definition
from pg_views
where schemaname = 'public'
  and viewname in ('v_apf_process_learning_accuracy', 'v_user_story_code_duplicates')
order by viewname;

-- 9. Triggers APF/User Stories.
select
  n.nspname as schema_name,
  c.relname as table_name,
  t.tgname as trigger_name,
  pg_get_triggerdef(t.oid, true) as trigger_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where not t.tgisinternal
  and n.nspname = 'public'
  and t.tgname in (
    'trg_apf_counting_brain_factor',
    'trg_apf_conservative_process_defaults',
    'trg_apf_log_process_learning_decision',
    'trg_assign_user_story_identity'
  )
order by t.tgname;

-- 10. Estado cumulativo das migrations APF 28 e 29.
select
  'migration_28_rows_still_pending' as check_name,
  count(*)::bigint as affected_rows
from public.apf_process_analysis_runs
where materialized_at is not null
  and suggested_factor_sigla is not null
  and inferred_factor_sigla is distinct from suggested_factor_sigla
union all
select
  'migration_29_historical_rows_still_pending',
  count(distinct run.id)::bigint
from public.apf_process_analysis_runs run
join public.apf_process_analysis_items item on item.analysis_run_id = run.id
where run.materialized_at is not null
  and item.decision_source in ('legacy', 'legacy_central')
  and (
    run.factor_source is distinct from 'legacy_preserved'
    or run.factor_review_required is distinct from false
    or run.confirmed_factor_sigla is null
  );

-- 11. Integridade final da migration 31.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'user_stories'
  and indexname in ('uq_user_stories_team_code', 'idx_user_stories_team_external_reference')
order by indexname;

select conname, pg_get_constraintdef(oid, true) as constraint_definition
from pg_constraint
where conrelid = to_regclass('public.user_stories')
  and conname = 'ck_user_stories_code_normalized';

select
  'duplicate_team_code' as check_name,
  count(*)::bigint as affected_rows
from (
  select team_id, code
  from public.user_stories
  group by team_id, code
  having count(*) > 1
) duplicate_codes
union all
select
  'non_normalized_code',
  count(*)::bigint
from public.user_stories
where code is distinct from upper(trim(code))
union all
select
  'recognizable_title_without_external_reference',
  count(*)::bigint
from public.user_stories
where external_reference is null
  and upper(trim(coalesce(title, ''))) ~ '^(HU|FUNC)[[:space:]-]*[0-9]+([.][0-9]+)?';

-- 12. Consistência de referências copiadas em itens APF.
select
  'apf_counting_items_hu_ref_mismatch' as check_name,
  count(*)::bigint as affected_rows
from public.apf_counting_items item
join public.user_stories story on story.id = item.story_id
where item.hu_ref is distinct from story.code
union all
select
  'apf_counting_items_hu_refs_mismatch',
  count(*)::bigint
from public.apf_counting_items item
where cardinality(item.story_ids) > 0
  and item.hu_refs is distinct from array(
    select story.code
    from unnest(item.story_ids) with ordinality as reference(story_id, position)
    join public.user_stories story on story.id = reference.story_id
    order by reference.position
  );

-- 13. Contratos sem organização e evidências de vínculo.
select
  contract.id,
  contract.name,
  contract.number,
  contract.company_id,
  company.name as company_name,
  contract.org_id,
  count(distinct contract_team.team_id) as linked_teams,
  count(distinct project.id) as linked_projects,
  count(distinct room_team.id) as linked_rooms,
  count(distinct member.user_id) as linked_members
from public.contracts contract
left join public.companies company on company.id = contract.company_id
left join public.contract_teams contract_team on contract_team.contract_id = contract.id
left join public.projects project on project.contract_id = contract.id
left join public.contract_room_teams room_team on room_team.contract_id = contract.id
left join public.contract_members member on member.contract_id = contract.id
where contract.org_id is null
group by contract.id, company.name
order by contract.name;

select
  organization.id,
  organization.name,
  organization.status,
  count(member.user_id) as membership_count
from public.organizations organization
left join public.organization_members member on member.org_id = organization.id
group by organization.id
order by organization.name;

-- 14. Estado atual do enforcement sem executar função de escrita.
select
  case
    when to_regprocedure('public.is_tenancy_enforced()') is null then 'function_absent'
    else 'function_present'
  end as enforcement_function_state,
  case
    when to_regclass('public.saas_runtime_settings') is null then 'settings_table_absent'
    else 'settings_table_present'
  end as settings_table_state;

-- Declaração: este arquivo contém apenas SELECTs e não altera o banco.
