-- Axion SaaS - Fase 2B / Lote 0
-- Preflight somente leitura para o console operacional tenant-scoped.

with
dependencies as (
  select *
  from (
    values
      ('public.organizations', to_regclass('public.organizations') is not null),
      ('public.companies', to_regclass('public.companies') is not null),
      ('public.contracts', to_regclass('public.contracts') is not null),
      ('public.projects', to_regclass('public.projects') is not null),
      ('public.teams', to_regclass('public.teams') is not null),
      ('public.contract_teams', to_regclass('public.contract_teams') is not null),
      ('public.organization_members', to_regclass('public.organization_members') is not null),
      ('public.organization_member_modules', to_regclass('public.organization_member_modules') is not null),
      ('public.platform_user_roles', to_regclass('public.platform_user_roles') is not null),
      ('public.saas_runtime_settings', to_regclass('public.saas_runtime_settings') is not null),
      ('public.is_platform_admin(uuid)', to_regprocedure('public.is_platform_admin(uuid)') is not null),
      ('public.is_organization_admin(uuid,uuid)', to_regprocedure('public.is_organization_admin(uuid,uuid)') is not null),
      ('public.can_operate_organization(uuid)', to_regprocedure('public.can_operate_organization(uuid)') is not null),
      ('public.get_accessible_companies_v2(uuid)', to_regprocedure('public.get_accessible_companies_v2(uuid)') is not null),
      ('public.get_accessible_contracts_v2(uuid)', to_regprocedure('public.get_accessible_contracts_v2(uuid)') is not null),
      ('public.get_accessible_projects_v2(uuid,uuid)', to_regprocedure('public.get_accessible_projects_v2(uuid,uuid)') is not null)
  ) dependency(object_name, present)
),
resource_integrity as (
  select
    (select count(*) from public.companies company where company.org_id is null)::bigint as companies_without_org,
    (select count(*) from public.contracts contract where contract.org_id is null)::bigint as contracts_without_org,
    (select count(*) from public.projects project where project.org_id is null)::bigint as projects_without_org,
    (select count(*) from public.teams team where team.org_id is null)::bigint as teams_without_org,
    (
      select count(*)
      from public.contracts contract
      left join public.companies company on company.id = contract.company_id
      where contract.company_id is not null
        and company.id is null
    )::bigint as orphan_contract_company_links,
    (
      select count(*)
      from public.projects project
      left join public.contracts contract on contract.id = project.contract_id
      where project.contract_id is not null
        and contract.id is null
    )::bigint as orphan_project_contract_links,
    (
      select count(*)
      from public.teams team
      left join public.companies company on company.id = team.company_id
      where team.company_id is not null
        and company.id is null
    )::bigint as orphan_team_company_links,
    (
      select count(*)
      from public.contract_teams relation
      left join public.contracts contract on contract.id = relation.contract_id
      left join public.teams team on team.id = relation.team_id
      where contract.id is null or team.id is null
    )::bigint as orphan_contract_team_links,
    (
      select count(*)
      from public.contracts contract
      join public.companies company on company.id = contract.company_id
      where contract.org_id is distinct from company.org_id
    )::bigint as contract_company_org_mismatches,
    (
      select count(*)
      from public.projects project
      join public.contracts contract on contract.id = project.contract_id
      where project.org_id is distinct from contract.org_id
    )::bigint as project_contract_org_mismatches,
    (
      select count(*)
      from public.teams team
      join public.contracts contract on contract.id = team.contract_id
      where team.org_id is distinct from contract.org_id
    )::bigint as team_contract_org_mismatches,
    (
      select count(*)
      from public.contract_teams relation
      join public.contracts contract on contract.id = relation.contract_id
      join public.teams team on team.id = relation.team_id
      where contract.org_id is distinct from team.org_id
    )::bigint as contract_team_org_mismatches
),
permission_integrity as (
  select
    (
      select count(*)
      from public.organization_member_modules module_access
      join public.organization_members member
        on member.org_id = module_access.org_id
       and member.user_id = module_access.user_id
      where not member.is_active
    )::bigint as inactive_memberships_with_module_access,
    (
      select count(*)
      from public.user_roles legacy_role
      where legacy_role.role = 'admin'
        and not exists (
          select 1
          from public.organization_members member
          where member.user_id = legacy_role.user_id
            and member.is_active
        )
        and not exists (
          select 1
          from public.platform_user_roles platform_role
          where platform_role.user_id = legacy_role.user_id
            and platform_role.role = 'platform_admin'
        )
    )::bigint as legacy_admins_without_organization_authority,
    (
      select count(*)
      from public.user_roles legacy_role
      where legacy_role.role = 'admin'
        and not exists (
          select 1
          from public.platform_user_roles platform_role
          where platform_role.user_id = legacy_role.user_id
            and platform_role.role = 'platform_admin'
        )
    )::bigint as users_depending_on_legacy_global_admin,
    (
      select count(*)
      from public.organization_members member
      where member.role::text in ('owner', 'admin')
        and member.is_active
    )::bigint as active_organization_admins,
    (
      select count(*)
      from public.platform_user_roles platform_role
      where platform_role.role = 'platform_admin'
    )::bigint as platform_admins
),
sales_consultoria as (
  select
    (array_agg(organization.id))[1] as sales_org_id,
    (array_agg(organization.name))[1] as sales_name,
    (array_agg(organization.slug))[1] as sales_slug,
    (array_agg(organization.status::text))[1] as sales_status,
    (array_agg(organization.plan::text))[1] as sales_plan,
    (
      select count(*)
      from public.organization_members member
      where member.org_id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
        and member.is_active
    )::bigint as sales_active_members,
    (
      select count(*)
      from public.companies company
      where company.org_id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
    )::bigint as sales_companies,
    (
      select count(*)
      from public.contracts contract
      where contract.org_id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
    )::bigint as sales_contracts,
    (
      select count(*)
      from public.projects project
      where project.org_id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
    )::bigint as sales_projects,
    (
      select count(*)
      from public.teams team
      where team.org_id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
    )::bigint as sales_teams,
    exists (
      select 1
      from public.organization_members member
      where member.org_id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
        and member.user_id = '3c472f37-eabb-4a95-a859-1a1cf89f5d37'::uuid
        and member.is_active
        and member.role::text in ('owner', 'admin')
    ) as roberto_sales_org_admin,
    exists (
      select 1
      from public.platform_user_roles platform_role
      where platform_role.user_id = '3c472f37-eabb-4a95-a859-1a1cf89f5d37'::uuid
        and platform_role.role = 'platform_admin'
    ) as roberto_platform_admin
  from public.organizations organization
  where organization.id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
),
policy_surface as (
  select
    (
      select count(*)
      from pg_policies policy
      where policy.schemaname = 'public'
        and policy.tablename in ('companies', 'contracts', 'projects', 'teams', 'contract_teams')
        and (
          policy.qual ilike '%true%'
          or policy.with_check ilike '%true%'
          or policy.qual ilike '%user_roles%'
          or policy.with_check ilike '%user_roles%'
          or policy.qual ilike '%profiles%'
          or policy.with_check ilike '%profiles%'
        )
    )::bigint as potentially_legacy_or_broad_policies,
    (
      select count(*)
      from information_schema.role_table_grants grant_row
      where grant_row.table_schema = 'public'
        and grant_row.table_name in ('companies', 'contracts', 'projects', 'teams', 'contract_teams', 'ai_providers')
        and grant_row.grantee in ('anon', 'authenticated')
        and grant_row.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
    )::bigint as direct_authenticated_mutation_grants
),
frontend_risks as (
  select
    1::bigint as services_without_backend_mutation_rpc,
    'useCompanies/useContracts/projects.service still contain direct table mutations; rollout must keep RLS/triggers active until RPC mutations replace them.'::text as note
),
summary as (
  select
    (select count(*) from dependencies where not present)::bigint as missing_dependencies,
    resource_integrity.*,
    permission_integrity.*,
    sales_consultoria.*,
    policy_surface.*,
    frontend_risks.services_without_backend_mutation_rpc,
    frontend_risks.note
  from resource_integrity
  cross join permission_integrity
  cross join sales_consultoria
  cross join policy_surface
  cross join frontend_risks
)
select
  *,
  (
    missing_dependencies = 0
    and companies_without_org = 0
    and contracts_without_org = 0
    and projects_without_org = 0
    and teams_without_org = 0
    and orphan_contract_company_links = 0
    and orphan_project_contract_links = 0
    and orphan_team_company_links = 0
    and orphan_contract_team_links = 0
    and contract_company_org_mismatches = 0
    and project_contract_org_mismatches = 0
    and team_contract_org_mismatches = 0
    and contract_team_org_mismatches = 0
    and inactive_memberships_with_module_access = 0
    and legacy_admins_without_organization_authority = 0
    and platform_admins > 0
    and sales_org_id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
    and sales_slug = 'sales-consultoria'
    and sales_status = 'active'
    and sales_plan = 'enterprise'
    and (roberto_sales_org_admin or roberto_platform_admin)
    and potentially_legacy_or_broad_policies = 0
  ) as organization_operational_console_preflight_ok
from summary;
