-- Axionn — Fase 2 / Diagnostico da autoridade enterprise de permissoes.
-- SOMENTE LEITURA: nao cria, altera ou remove objetos e dados.
-- Execute no SQL Editor do Lovable e preserve os dois result sets.

with
active_memberships as (
  select org_id, user_id, role::text as role
  from public.organization_members
  where is_active
),
module_assignments as (
  select org_id, user_id, module_key, role_name
  from public.organization_member_modules
),
orphan_modules as (
  select module.org_id, module.user_id, module.module_key
  from module_assignments module
  left join active_memberships membership
    on membership.org_id = module.org_id
   and membership.user_id = module.user_id
  where membership.user_id is null
),
members_without_modules as (
  select membership.org_id, membership.user_id
  from active_memberships membership
  where membership.role not in ('owner', 'admin')
    and not exists (
      select 1
      from module_assignments module
      where module.org_id = membership.org_id
        and module.user_id = membership.user_id
    )
),
admin_members_without_modules as (
  select membership.org_id, membership.user_id
  from active_memberships membership
  where membership.role in ('owner', 'admin')
    and not exists (
      select 1
      from module_assignments module
      where module.org_id = membership.org_id
        and module.user_id = membership.user_id
    )
),
invalid_module_roles as (
  select org_id, user_id, module_key, role_name
  from module_assignments
  where module_key not in ('sala_agil', 'sustentacao', 'rdm')
     or role_name not in ('admin', 'member')
),
multi_org_users as (
  select user_id, count(*) as organization_count
  from active_memberships
  group by user_id
  having count(*) > 1
),
multi_org_without_explicit_modules as (
  select membership.org_id, membership.user_id
  from active_memberships membership
  join multi_org_users multi_org on multi_org.user_id = membership.user_id
  where not exists (
    select 1
    from module_assignments module
    where module.org_id = membership.org_id
      and module.user_id = membership.user_id
  )
),
legacy_admins_without_platform_role as (
  select distinct legacy.user_id
  from public.user_roles legacy
  where legacy.role::text = 'admin'
    and not exists (
      select 1
      from public.platform_user_roles platform
      where platform.user_id = legacy.user_id
        and platform.role = 'platform_admin'
    )
),
platform_admins as (
  select distinct user_id
  from public.platform_user_roles
  where role = 'platform_admin'
),
organizations_without_active_admin as (
  select organization.id
  from public.organizations organization
  where not exists (
    select 1
    from active_memberships membership
    where membership.org_id = organization.id
      and membership.role in ('owner', 'admin')
  )
),
runtime as (
  select
    public.is_tenancy_enforced() as tenancy_enforced,
    public.is_organization_legacy_permission_fallback_enabled() as legacy_fallback_enabled
)
select 'tenancy_enforced' as check_name,
       case when runtime.tenancy_enforced then 1 else 0 end::bigint as affected_rows,
       'informativo: 1=ativo, 0=inativo' as severity
from runtime
union all
select 'legacy_fallback_enabled',
       case when runtime.legacy_fallback_enabled then 1 else 0 end::bigint,
       'informativo: 1=ativo, 0=inativo'
from runtime
union all
select 'platform_admins', count(*)::bigint, 'informativo: deve existir ao menos 1'
from platform_admins
union all
select 'orphan_modules', count(*)::bigint, 'bloqueador: esperado 0'
from orphan_modules
union all
select 'members_without_modules', count(*)::bigint, 'revisao: membro pode ficar sem modulo intencionalmente'
from members_without_modules
union all
select 'admin_members_without_modules', count(*)::bigint, 'revisao: admin pode administrar sem modulo operacional'
from admin_members_without_modules
union all
select 'invalid_module_roles', count(*)::bigint, 'bloqueador: esperado 0'
from invalid_module_roles
union all
select 'multi_org_without_explicit_modules', count(*)::bigint, 'bloqueador para retirar fallback: esperado 0'
from multi_org_without_explicit_modules
union all
select 'legacy_admins_without_platform_role', count(*)::bigint, 'bloqueador para retirar fallback: esperado 0'
from legacy_admins_without_platform_role
union all
select 'organizations_without_active_admin', count(*)::bigint, 'bloqueador: esperado 0'
from organizations_without_active_admin
order by check_name;

with
active_memberships as (
  select org_id, user_id, role::text as role
  from public.organization_members
  where is_active
),
orphan_modules as (
  select module.org_id, module.user_id
  from public.organization_member_modules module
  left join active_memberships membership
    on membership.org_id = module.org_id
   and membership.user_id = module.user_id
  where membership.user_id is null
),
invalid_module_roles as (
  select 1
  from public.organization_member_modules
  where module_key not in ('sala_agil', 'sustentacao', 'rdm')
     or role_name not in ('admin', 'member')
),
organizations_without_active_admin as (
  select organization.id
  from public.organizations organization
  where not exists (
    select 1
    from active_memberships membership
    where membership.org_id = organization.id
      and membership.role in ('owner', 'admin')
  )
)
select
  to_regclass('public.organization_members') is not null
  and to_regclass('public.organization_member_modules') is not null
  and to_regclass('public.platform_user_roles') is not null
  and to_regprocedure('public.is_platform_admin(uuid)') is not null
  and to_regprocedure('public.get_my_organization_module_roles(uuid)') is not null
  and to_regprocedure('public.is_organization_legacy_permission_fallback_enabled()') is not null
  and exists (
    select 1 from public.platform_user_roles where role = 'platform_admin'
  )
  and not exists (select 1 from orphan_modules)
  and not exists (select 1 from invalid_module_roles)
  and not exists (select 1 from organizations_without_active_admin)
    as enterprise_permission_authority_health_ok;
