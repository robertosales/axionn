-- Axion SaaS - Fase 2A / Lote 6b
-- Operacao manual: migra usuarios ativos cadastrados para SALES CONSULTORIA.
-- Executar no SQL Editor do Lovable Cloud depois do cutover do Lote 6.

begin;

select pg_advisory_xact_lock(
  hashtext('axionn:20260704:06b_migrate_active_users_to_sales_consultoria')
);

do $$
declare
  v_org_id uuid := 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid;
  v_missing text;
begin
  select string_agg(object_name, ', ' order by object_name)
  into v_missing
  from (
    values
      ('public.organizations', to_regclass('public.organizations') is not null),
      ('public.profiles', to_regclass('public.profiles') is not null),
      ('public.user_roles', to_regclass('public.user_roles') is not null),
      ('public.user_module_roles', to_regclass('public.user_module_roles') is not null),
      ('public.organization_members', to_regclass('public.organization_members') is not null),
      ('public.organization_member_modules', to_regclass('public.organization_member_modules') is not null),
      ('public.get_organization_members_v2(uuid)', to_regprocedure('public.get_organization_members_v2(uuid)') is not null),
      ('public.is_organization_legacy_permission_fallback_enabled()', to_regprocedure('public.is_organization_legacy_permission_fallback_enabled()') is not null)
  ) dependency(object_name, present)
  where not present;

  if v_missing is not null then
    raise exception 'Dependencias ausentes para migracao SALES CONSULTORIA: %', v_missing;
  end if;

  if not exists (
    select 1
    from public.organizations organization
    where organization.id = v_org_id
      and lower(btrim(organization.slug)) = 'sales-consultoria'
      and upper(btrim(organization.name)) = 'SALES CONSULTORIA'
  ) then
    raise exception 'Identidade exata do tenant SALES CONSULTORIA nao confirmada';
  end if;
end;
$$;

with target_users as (
  select distinct profile.user_id
  from public.profiles profile
  where profile.user_id is not null
    and coalesce(profile.is_active, true)
)
insert into public.organization_members (
  org_id,
  user_id,
  role,
  is_active
)
select
  'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid,
  target.user_id,
  'member'::public.org_member_role,
  true
from target_users target
on conflict (org_id, user_id) do update
  set is_active = true;

with sales_members as (
  select member.org_id, member.user_id
  from public.organization_members member
  where member.org_id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
    and member.is_active
),
legacy_admins as (
  select distinct role.user_id
  from public.user_roles role
  where role.role = 'admin'
)
insert into public.organization_member_modules (
  org_id,
  user_id,
  module_key,
  role_name,
  assigned_by
)
select
  member.org_id,
  member.user_id,
  module_key,
  'admin',
  null
from sales_members member
join legacy_admins legacy_admin on legacy_admin.user_id = member.user_id
cross join unnest(array['sala_agil', 'sustentacao', 'rdm']::text[]) module_key
on conflict (org_id, user_id, module_key) do update
  set role_name = case
        when organization_member_modules.role_name = 'admin' then 'admin'
        else excluded.role_name
      end;

with sales_members as (
  select member.org_id, member.user_id
  from public.organization_members member
  where member.org_id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
    and member.is_active
)
insert into public.organization_member_modules (
  org_id,
  user_id,
  module_key,
  role_name,
  assigned_by
)
select
  member.org_id,
  member.user_id,
  module_role.module,
  module_role.role_name,
  null
from sales_members member
join public.user_module_roles module_role
  on module_role.user_id = member.user_id
where module_role.module in ('sala_agil', 'sustentacao', 'rdm')
on conflict (org_id, user_id, module_key) do nothing;

with sales_members as (
  select member.org_id, member.user_id, member.role
  from public.organization_members member
  where member.org_id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
    and member.is_active
),
eligible_profiles as (
  select
    member.org_id,
    member.user_id,
    member.role,
    profile.module_access
  from sales_members member
  join public.profiles profile on profile.user_id = member.user_id
  where coalesce(profile.is_active, true)
    and not exists (
      select 1
      from public.organization_member_modules existing
      where existing.org_id = member.org_id
        and existing.user_id = member.user_id
    )
)
insert into public.organization_member_modules (
  org_id,
  user_id,
  module_key,
  role_name,
  assigned_by
)
select
  profile.org_id,
  profile.user_id,
  module_key,
  case
    when profile.role::text in ('owner', 'admin') then 'admin'
    else 'member'
  end,
  null
from eligible_profiles profile
cross join lateral unnest(
  case
    when profile.module_access = 'admin'
      then array['sala_agil', 'sustentacao', 'rdm']::text[]
    when profile.module_access in ('sala_agil', 'sustentacao', 'rdm')
      then array[profile.module_access]::text[]
    else array['sala_agil']::text[]
  end
) module_key
on conflict (org_id, user_id, module_key) do nothing;

do $$
declare
  v_org_id uuid := 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid;
  v_active_profiles_without_sales_membership bigint;
  v_sales_active_members_without_modules bigint;
begin
  select count(*)
  into v_active_profiles_without_sales_membership
  from public.profiles profile
  where profile.user_id is not null
    and coalesce(profile.is_active, true)
    and not exists (
      select 1
      from public.organization_members member
      where member.org_id = v_org_id
        and member.user_id = profile.user_id
        and member.is_active
    );

  select count(*)
  into v_sales_active_members_without_modules
  from public.organization_members member
  where member.org_id = v_org_id
    and member.is_active
    and not exists (
      select 1
      from public.organization_member_modules module_access
      where module_access.org_id = member.org_id
        and module_access.user_id = member.user_id
    );

  if v_active_profiles_without_sales_membership <> 0 then
    raise exception
      'Post-validation failed: % perfis ativos sem membership SALES CONSULTORIA',
      v_active_profiles_without_sales_membership;
  end if;

  if v_sales_active_members_without_modules <> 0 then
    raise exception
      'Post-validation failed: % membros ativos SALES CONSULTORIA sem modulos',
      v_sales_active_members_without_modules;
  end if;
end;
$$;

commit;

with summary as (
  select
    'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid as org_id,
    (
      select count(*)
      from public.profiles profile
      where profile.user_id is not null
        and coalesce(profile.is_active, true)
    )::bigint as active_profiles,
    (
      select count(*)
      from public.organization_members member
      where member.org_id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
        and member.is_active
    )::bigint as sales_active_members,
    (
      select count(*)
      from public.profiles profile
      where profile.user_id is not null
        and coalesce(profile.is_active, true)
        and not exists (
          select 1
          from public.organization_members member
          where member.org_id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
            and member.user_id = profile.user_id
            and member.is_active
        )
    )::bigint as active_profiles_without_sales_membership,
    (
      select count(*)
      from public.organization_members member
      where member.org_id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'::uuid
        and member.is_active
        and not exists (
          select 1
          from public.organization_member_modules module_access
          where module_access.org_id = member.org_id
            and module_access.user_id = member.user_id
        )
    )::bigint as sales_active_members_without_modules,
    public.is_organization_legacy_permission_fallback_enabled() = false
      as fallback_still_disabled
)
select
  *,
  (
    active_profiles_without_sales_membership = 0
    and sales_active_members_without_modules = 0
    and fallback_still_disabled
  ) as sales_consultoria_user_migration_ok
from summary;
