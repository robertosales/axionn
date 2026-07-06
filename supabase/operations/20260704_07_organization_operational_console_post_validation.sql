-- Axion SaaS - Fase 2B / Lote 8
-- Validacao pos-cutover do console operacional. Somente leitura.

with
resource_integrity as (
  select
    (select count(*) from public.companies where org_id is null)::bigint as companies_without_org,
    (select count(*) from public.contracts where org_id is null)::bigint as contracts_without_org,
    (select count(*) from public.projects where org_id is null)::bigint as projects_without_org,
    (select count(*) from public.teams where org_id is null)::bigint as teams_without_org,
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
      from public.contract_teams relation
      join public.contracts contract on contract.id = relation.contract_id
      join public.teams team on team.id = relation.team_id
      where contract.org_id is distinct from team.org_id
    )::bigint as contract_team_org_mismatches
),
sales as (
  select
    exists (
      select 1
      from public.organizations organization
      where organization.id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
        and upper(btrim(organization.name)) = 'SALES CONSULTORIA'
        and lower(btrim(organization.slug)) = 'sales-consultoria'
        and organization.status::text = 'active'
        and organization.plan::text = 'enterprise'
    ) as sales_consultoria_preserved,
    (
      exists (
        select 1
        from public.organization_members member
        where member.org_id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
          and member.user_id = '3c472f37-eabb-4a95-a859-1a1cf89f5d37'::uuid
          and member.is_active
          and member.role::text in ('owner', 'admin')
      )
      or exists (
        select 1
        from public.platform_user_roles platform_role
        where platform_role.user_id = '3c472f37-eabb-4a95-a859-1a1cf89f5d37'::uuid
          and platform_role.role = 'platform_admin'
      )
    ) as roberto_has_operational_access
),
runtime as (
  select
    public.is_organization_operational_console_enabled() as console_enabled,
    public.is_legacy_operational_admin_fallback_enabled() as legacy_fallback_enabled,
    public.is_tenancy_enforced() as tenancy_enforcement_current,
    to_regprocedure('public.is_platform_admin(uuid)') is not null as platform_admin_function_available,
    has_function_privilege('authenticated', 'public.is_platform_admin(uuid)', 'EXECUTE') as platform_admin_authenticated_execute,
    not has_function_privilege('anon', 'public.is_platform_admin(uuid)', 'EXECUTE') as platform_admin_anon_revoked,
    to_regprocedure('public.is_organization_operational_console_enabled()') is not null as console_read_function_available,
    to_regprocedure('public.set_organization_operational_console(boolean)') is not null as console_toggle_function_available,
    to_regprocedure('public.is_legacy_operational_admin_fallback_enabled()') is not null as fallback_read_function_available,
    to_regprocedure('public.set_legacy_operational_admin_fallback(boolean)') is not null as fallback_toggle_function_available,
    to_regprocedure('public.get_organization_members_v2(uuid)') is not null as member_query_function_available,
    to_regprocedure('public.create_organization_company_v2(uuid,text,text,text,text,text,text)') is not null as company_create_function_available,
    to_regprocedure('public.update_organization_company_v2(uuid,uuid,text,text,text,text,text,text)') is not null as company_update_function_available,
    to_regprocedure('public.archive_organization_company_v2(uuid,uuid)') is not null as company_archive_function_available,
    to_regprocedure('public.create_organization_contract_v2(uuid,text,uuid,text,date,date,text,text,numeric,text)') is not null as contract_create_function_available,
    to_regprocedure('public.archive_organization_contract_v2(uuid,uuid)') is not null as contract_archive_function_available,
    to_regclass('public.organization_operational_audit_log') is not null as audit_log_available
),
limits as (
  select
    exists (
      select 1
      from public.get_effective_organization_entitlements(
        'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
      ) entitlement
      where entitlement.feature_key = 'contracts.max'
        and entitlement.enabled
    ) as contracts_max_preserved,
    exists (
      select 1
      from public.get_effective_organization_entitlements(
        'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
      ) entitlement
      where entitlement.feature_key = 'projects.max'
        and entitlement.enabled
    ) as projects_max_preserved
)
select
  *,
  (
    console_enabled
    and platform_admin_function_available
    and platform_admin_authenticated_execute
    and platform_admin_anon_revoked
    and console_read_function_available
    and console_toggle_function_available
    and fallback_read_function_available
    and fallback_toggle_function_available
    and member_query_function_available
    and company_create_function_available
    and company_update_function_available
    and company_archive_function_available
    and contract_create_function_available
    and contract_archive_function_available
    and audit_log_available
    and companies_without_org = 0
    and contracts_without_org = 0
    and projects_without_org = 0
    and teams_without_org = 0
    and contract_company_org_mismatches = 0
    and project_contract_org_mismatches = 0
    and contract_team_org_mismatches = 0
    and contracts_max_preserved
    and projects_max_preserved
    and sales_consultoria_preserved
    and roberto_has_operational_access
  ) as organization_operational_console_post_validation_ok
from runtime
cross join resource_integrity
cross join sales
cross join limits;
