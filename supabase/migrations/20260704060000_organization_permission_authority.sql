-- Axion SaaS - Fase 2A / Lote 6
-- Autoridade organizacional para retirada controlada das permissoes legadas.

insert into public.saas_runtime_settings (key, value)
values (
  'organization_legacy_permission_fallback_enabled',
  jsonb_build_object('enabled', true)
)
on conflict (key) do nothing;

create or replace function public.is_organization_legacy_permission_fallback_enabled()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select lower(setting.value ->> 'enabled') = 'true'
      from public.saas_runtime_settings setting
      where setting.key = 'organization_legacy_permission_fallback_enabled'
    ),
    true
  );
$$;

create or replace function public.set_organization_legacy_permission_fallback(
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.is_platform_admin(auth.uid()) then
    raise exception using
      errcode = '42501',
      message = 'organization_legacy_permission_fallback_toggle_denied';
  end if;

  insert into public.saas_runtime_settings (key, value, updated_at, updated_by)
  values (
    'organization_legacy_permission_fallback_enabled',
    jsonb_build_object('enabled', p_enabled),
    now(),
    auth.uid()
  )
  on conflict (key) do update
    set value = excluded.value,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
end;
$$;

with active_membership_counts as (
  select member.user_id, count(*) as membership_count
  from public.organization_members member
  where member.is_active
  group by member.user_id
),
eligible_members as (
  select member.org_id, member.user_id
  from public.organization_members member
  join active_membership_counts membership_count
    on membership_count.user_id = member.user_id
   and membership_count.membership_count = 1
  where member.is_active
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
  member.org_id,
  member.user_id,
  module_role.module,
  module_role.role_name,
  null
from eligible_members member
join public.user_module_roles module_role
  on module_role.user_id = member.user_id
where module_role.module in ('sala_agil', 'sustentacao', 'rdm')
on conflict (org_id, user_id, module_key) do nothing;

with active_membership_counts as (
  select member.user_id, count(*) as membership_count
  from public.organization_members member
  where member.is_active
  group by member.user_id
),
eligible_members as (
  select member.org_id, member.user_id, member.role
  from public.organization_members member
  join active_membership_counts membership_count
    on membership_count.user_id = member.user_id
   and membership_count.membership_count = 1
  where member.is_active
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
  member.org_id,
  member.user_id,
  module_key,
  case
    when member.role::text in ('owner', 'admin') then 'admin'
    else 'member'
  end,
  null
from eligible_members member
join public.profiles profile on profile.user_id = member.user_id
cross join lateral unnest(
  case
    when profile.module_access = 'admin'
      then array['sala_agil', 'sustentacao', 'rdm']::text[]
    when profile.module_access in ('sala_agil', 'sustentacao', 'rdm')
      then array[profile.module_access]::text[]
    else '{}'::text[]
  end
) module_key
on conflict (org_id, user_id, module_key) do nothing;

revoke all on function public.is_organization_legacy_permission_fallback_enabled()
  from public, anon;
revoke all on function public.set_organization_legacy_permission_fallback(boolean)
  from public, anon;

grant execute on function public.is_organization_legacy_permission_fallback_enabled()
  to authenticated, service_role;
grant execute on function public.set_organization_legacy_permission_fallback(boolean)
  to authenticated, service_role;

comment on function public.is_organization_legacy_permission_fallback_enabled() is
  'Le a chave operacional que permite rollback temporario para permissoes legadas organizacionais.';
comment on function public.set_organization_legacy_permission_fallback(boolean) is
  'Ativa ou desativa o fallback legado organizacional. Permitido a service_role ou platform_admin.';
