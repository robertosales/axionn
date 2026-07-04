-- Axion SaaS - Fase 2A / Lote 6
-- Validacao pos-cutover. Somente leitura.

with active_memberships as (
  select org_id, user_id
  from public.organization_members
  where is_active
),
platform_admins as (
  select user_id
  from public.platform_user_roles
  where role = 'platform_admin'
),
membership_counts as (
  select user_id, count(*) as active_org_count
  from active_memberships
  group by user_id
),
legacy_users as (
  select distinct user_id
  from public.user_module_roles
  where module in ('sala_agil', 'sustentacao', 'rdm')
  union
  select user_id
  from public.profiles
  where module_access in ('admin', 'sala_agil', 'sustentacao', 'rdm')
),
active_memberships_without_modules as (
  select member.org_id, member.user_id
  from active_memberships member
  where not exists (
    select 1
    from public.organization_member_modules module_access
    where module_access.org_id = member.org_id
      and module_access.user_id = member.user_id
  )
    and not exists (
      select 1 from platform_admins platform_admin where platform_admin.user_id = member.user_id
    )
),
orphan_modules as (
  select module_access.org_id, module_access.user_id
  from public.organization_member_modules module_access
  left join public.organization_members member
    on member.org_id = module_access.org_id
   and member.user_id = module_access.user_id
  where member.user_id is null
),
inactive_membership_modules as (
  select module_access.org_id, module_access.user_id
  from public.organization_member_modules module_access
  join public.organization_members member
    on member.org_id = module_access.org_id
   and member.user_id = module_access.user_id
  where not member.is_active
),
multi_org_legacy_incomplete as (
  select member.user_id
  from active_memberships member
  join membership_counts counts
    on counts.user_id = member.user_id
   and counts.active_org_count > 1
  join legacy_users legacy on legacy.user_id = member.user_id
  group by member.user_id
  having count(*) filter (
    where exists (
      select 1
      from public.organization_member_modules module_access
      where module_access.org_id = member.org_id
        and module_access.user_id = member.user_id
    )
  ) < count(*)
),
summary as (
  select
    public.is_organization_legacy_permission_fallback_enabled() = false as fallback_disabled,
    to_regprocedure('public.is_organization_legacy_permission_fallback_enabled()') is not null as read_function_available,
    to_regprocedure('public.set_organization_legacy_permission_fallback(boolean)') is not null as toggle_function_available,
    (select count(*) from active_memberships_without_modules)::bigint as active_memberships_without_modules,
    (select count(*) from orphan_modules)::bigint as orphan_modules,
    (select count(*) from inactive_membership_modules)::bigint as inactive_membership_modules,
    (select count(*) from multi_org_legacy_incomplete)::bigint as multi_org_legacy_incomplete,
    (select count(*) from platform_admins)::bigint as platform_admins,
    public.is_tenancy_enforced() as tenancy_enforcement_current
)
select
  *,
  (
    fallback_disabled
    and read_function_available
    and toggle_function_available
    and active_memberships_without_modules = 0
    and orphan_modules = 0
    and inactive_membership_modules = 0
    and multi_org_legacy_incomplete = 0
    and platform_admins > 0
  ) as legacy_permission_post_cutover_ok
from summary;
