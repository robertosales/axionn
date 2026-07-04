-- Axion SaaS - Fase 2A / Lote 6
-- Preflight somente leitura para retirada controlada das permissoes legadas.

with active_memberships as (
  select member.org_id, member.user_id, member.role
  from public.organization_members member
  where member.is_active
),
membership_counts as (
  select user_id, count(*) as active_org_count
  from active_memberships
  group by user_id
),
legacy_user_modules as (
  select distinct user_id
  from public.user_module_roles
  where module in ('sala_agil', 'sustentacao', 'rdm')
),
legacy_profile_modules as (
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
),
single_org_only_user_module_roles as (
  select member.org_id, member.user_id
  from active_memberships member
  join membership_counts counts
    on counts.user_id = member.user_id
   and counts.active_org_count = 1
  join legacy_user_modules legacy on legacy.user_id = member.user_id
  where not exists (
    select 1
    from public.organization_member_modules module_access
    where module_access.org_id = member.org_id
      and module_access.user_id = member.user_id
  )
),
single_org_only_profile_module_access as (
  select member.org_id, member.user_id
  from active_memberships member
  join membership_counts counts
    on counts.user_id = member.user_id
   and counts.active_org_count = 1
  join legacy_profile_modules legacy on legacy.user_id = member.user_id
  where not exists (
    select 1 from public.user_module_roles role where role.user_id = member.user_id
  )
    and not exists (
      select 1
      from public.organization_member_modules module_access
      where module_access.org_id = member.org_id
        and module_access.user_id = member.user_id
    )
),
multi_org_legacy_incomplete as (
  select member.user_id
  from active_memberships member
  join membership_counts counts
    on counts.user_id = member.user_id
   and counts.active_org_count > 1
  where exists (
    select 1 from legacy_user_modules legacy where legacy.user_id = member.user_id
    union
    select 1 from legacy_profile_modules legacy where legacy.user_id = member.user_id
  )
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
orphan_modules as (
  select module_access.org_id, module_access.user_id, module_access.module_key
  from public.organization_member_modules module_access
  left join public.organization_members member
    on member.org_id = module_access.org_id
   and member.user_id = module_access.user_id
  where member.user_id is null
),
inactive_membership_modules as (
  select module_access.org_id, module_access.user_id, module_access.module_key
  from public.organization_member_modules module_access
  join public.organization_members member
    on member.org_id = module_access.org_id
   and member.user_id = module_access.user_id
  where not member.is_active
),
invalid_modules as (
  select org_id, user_id, module_key
  from public.organization_member_modules
  where module_key not in ('sala_agil', 'sustentacao', 'rdm')
),
legacy_admins_missing_platform_role as (
  select role.user_id
  from public.user_roles role
  where role.role = 'admin'
    and not exists (
      select 1
      from public.platform_user_roles platform_role
      where platform_role.user_id = role.user_id
        and platform_role.role = 'platform_admin'
    )
),
platform_admins as (
  select user_id
  from public.platform_user_roles
  where role = 'platform_admin'
),
active_users_without_organization as (
  select profile.user_id
  from public.profiles profile
  where coalesce(profile.is_active, true)
    and not exists (
      select 1
      from active_memberships member
      where member.user_id = profile.user_id
    )
),
users_losing_all_modules as (
  select member.user_id
  from active_memberships member
  where not exists (
    select 1
    from public.organization_member_modules module_access
    where module_access.org_id = member.org_id
      and module_access.user_id = member.user_id
  )
    and not exists (
      select 1
      from platform_admins platform_admin
      where platform_admin.user_id = member.user_id
    )
  group by member.user_id
),
sales_consultoria_gaps as (
  select member.org_id, member.user_id
  from active_memberships member
  where member.org_id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
    and not exists (
      select 1
      from public.organization_member_modules module_access
      where module_access.org_id = member.org_id
        and module_access.user_id = member.user_id
    )
),
blocker_summary as (
  select
    (select count(*) from multi_org_legacy_incomplete) as multi_org_legacy_incomplete_count,
    (select count(*) from orphan_modules) as orphan_modules_count,
    (select count(*) from inactive_membership_modules) as inactive_membership_modules_count,
    (select count(*) from invalid_modules) as invalid_modules_count,
    (select count(*) from legacy_admins_missing_platform_role) as legacy_admins_missing_platform_role_count,
    (select count(*) from users_losing_all_modules) as users_losing_all_modules_count,
    (select count(*) from sales_consultoria_gaps) as sales_consultoria_gap_count
)
select 'active_memberships_without_modules' as check_name, count(*)::bigint as affected_rows
from active_memberships_without_modules
union all
select 'single_org_only_user_module_roles', count(*)::bigint from single_org_only_user_module_roles
union all
select 'single_org_only_profile_module_access', count(*)::bigint from single_org_only_profile_module_access
union all
select 'multi_org_legacy_incomplete', count(*)::bigint from multi_org_legacy_incomplete
union all
select 'orphan_modules', count(*)::bigint from orphan_modules
union all
select 'inactive_membership_modules', count(*)::bigint from inactive_membership_modules
union all
select 'invalid_modules', count(*)::bigint from invalid_modules
union all
select 'legacy_admins_missing_platform_role', count(*)::bigint from legacy_admins_missing_platform_role
union all
select 'platform_admins', count(*)::bigint from platform_admins
union all
select 'active_users_without_organization', count(*)::bigint from active_users_without_organization
union all
select 'users_losing_all_modules', count(*)::bigint from users_losing_all_modules
union all
select 'sales_consultoria_gaps', count(*)::bigint from sales_consultoria_gaps;

with active_memberships as (
  select member.org_id, member.user_id
  from public.organization_members member
  where member.is_active
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
invalid_modules as (
  select org_id, user_id
  from public.organization_member_modules
  where module_key not in ('sala_agil', 'sustentacao', 'rdm')
),
legacy_admins_missing_platform_role as (
  select role.user_id
  from public.user_roles role
  where role.role = 'admin'
    and not exists (
      select 1
      from public.platform_user_roles platform_role
      where platform_role.user_id = role.user_id
        and platform_role.role = 'platform_admin'
    )
),
platform_admins as (
  select user_id
  from public.platform_user_roles
  where role = 'platform_admin'
),
users_losing_all_modules as (
  select member.user_id
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
  group by member.user_id
),
sales_consultoria_gaps as (
  select member.org_id, member.user_id
  from active_memberships member
  where member.org_id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
    and not exists (
      select 1
      from public.organization_member_modules module_access
      where module_access.org_id = member.org_id
        and module_access.user_id = member.user_id
    )
)
select
  not exists (select 1 from multi_org_legacy_incomplete)
  and not exists (select 1 from orphan_modules)
  and not exists (select 1 from inactive_membership_modules)
  and not exists (select 1 from invalid_modules)
  and not exists (select 1 from legacy_admins_missing_platform_role)
  and not exists (select 1 from users_losing_all_modules)
  and not exists (select 1 from sales_consultoria_gaps)
    as legacy_permission_retirement_preflight_ok;
