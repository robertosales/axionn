-- Axion SaaS — Fase 2A / Lote 2B
-- Executar depois de 20260704_02_organization_member_invitations_rollout.sql.

begin;

select pg_advisory_xact_lock(
  hashtext('axionn:20260704:02b_organization_module_access_runtime')
);

create temporary table organization_module_runtime_snapshot (
  enforcement_enabled boolean not null
) on commit preserve rows;

do $$
declare
  v_missing text;
begin
  select string_agg(object_name, ', ' order by object_name)
  into v_missing
  from (
    values
      ('organization_members', to_regclass('public.organization_members') is not null),
      ('organization_member_modules', to_regclass('public.organization_member_modules') is not null),
      ('user_module_roles', to_regclass('public.user_module_roles') is not null),
      ('profiles', to_regclass('public.profiles') is not null),
      ('is_organization_member', to_regprocedure('public.is_organization_member(uuid,uuid)') is not null),
      ('is_tenancy_enforced', to_regprocedure('public.is_tenancy_enforced()') is not null)
  ) dependency(object_name, present)
  where not present;

  if v_missing is not null then
    raise exception 'Dependências ausentes para o runtime de módulos: %', v_missing;
  end if;

  insert into pg_temp.organization_module_runtime_snapshot
  select public.is_tenancy_enforced();
end;
$$;

-- O legado não registra a organização de origem. Para impedir vazamento de
-- permissões entre tenants, o backfill automático só atende usuários com um
-- único membership ativo. Usuários multi-organização ficam para revisão.
with active_membership_counts as (
  select member.user_id, count(*) as membership_count
  from public.organization_members member
  where member.is_active
  group by member.user_id
)
insert into public.organization_member_modules (
  org_id, user_id, module_key, role_name, assigned_by
)
select
  member.org_id,
  member.user_id,
  module_role.module,
  module_role.role_name,
  null
from public.organization_members member
join active_membership_counts membership_count
  on membership_count.user_id = member.user_id
 and membership_count.membership_count = 1
join public.user_module_roles module_role on module_role.user_id = member.user_id
where member.is_active
  and module_role.module in ('sala_agil', 'sustentacao', 'rdm')
on conflict (org_id, user_id, module_key) do nothing;

with active_membership_counts as (
  select member.user_id, count(*) as membership_count
  from public.organization_members member
  where member.is_active
  group by member.user_id
)
insert into public.organization_member_modules (
  org_id, user_id, module_key, role_name, assigned_by
)
select
  member.org_id,
  member.user_id,
  module_key,
  case
    when profile.module_access = 'admin' then 'admin'
    when member.role::text in ('owner', 'admin') then 'admin'
    else 'member'
  end,
  null
from public.organization_members member
join active_membership_counts membership_count
  on membership_count.user_id = member.user_id
 and membership_count.membership_count = 1
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
where member.is_active
  and not exists (
    select 1
    from public.organization_member_modules existing
    where existing.org_id = member.org_id
      and existing.user_id = member.user_id
  )
on conflict (org_id, user_id, module_key) do nothing;

create or replace function public.get_my_organization_module_roles(
  p_org_id uuid
)
returns table (module text, role_name text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
     or not public.is_organization_member(p_org_id, auth.uid()) then
    raise exception using
      errcode = '42501',
      message = 'organization_module_access_denied';
  end if;

  if public.is_platform_admin(auth.uid()) then
    return query
    select module_key, 'admin'::text
    from unnest(array['rdm', 'sala_agil', 'sustentacao']::text[]) module_key
    order by module_key;
    return;
  end if;

  return query
  select module_access.module_key, module_access.role_name
  from public.organization_member_modules module_access
  join public.organization_members member
    on member.org_id = module_access.org_id
   and member.user_id = module_access.user_id
  where module_access.org_id = p_org_id
    and module_access.user_id = auth.uid()
    and member.is_active
  order by module_access.module_key;
end;
$$;

revoke all on function public.get_my_organization_module_roles(uuid)
  from public, anon;
grant execute on function public.get_my_organization_module_roles(uuid)
  to authenticated, service_role;

do $$
begin
  if public.is_tenancy_enforced() is distinct from (
    select enforcement_enabled
    from pg_temp.organization_module_runtime_snapshot
  ) then
    raise exception 'Post-validation failed: tenancy enforcement foi alterado';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_my_organization_module_roles(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Post-validation failed: RPC de módulos indisponível';
  end if;

  if has_function_privilege(
    'anon',
    'public.get_my_organization_module_roles(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Post-validation failed: acesso anônimo indevido';
  end if;

  if exists (
    select 1
    from public.organization_member_modules module_access
    left join public.organization_members member
      on member.org_id = module_access.org_id
     and member.user_id = module_access.user_id
    where member.user_id is null
  ) then
    raise exception 'Post-validation failed: módulo sem membership correspondente';
  end if;
end;
$$;

commit;

with multi_org_users as (
  select member.user_id
  from public.organization_members member
  where member.is_active
    and not public.is_platform_admin(member.user_id)
  group by member.user_id
  having count(*) > 1
),
state as (
  select
    (select count(*) from public.organization_member_modules)::bigint
      as organization_module_assignments,
    (select count(distinct (org_id, user_id))
      from public.organization_member_modules)::bigint
      as members_with_module_access,
    (select count(*) from multi_org_users)::bigint
      as multi_org_users_requiring_review,
    has_function_privilege(
      'authenticated',
      'public.get_my_organization_module_roles(uuid)',
      'EXECUTE'
    ) as tenant_module_rpc_available,
    not has_function_privilege(
      'anon',
      'public.get_my_organization_module_roles(uuid)',
      'EXECUTE'
    ) as anonymous_access_revoked,
    not exists (
      select 1
      from public.organization_member_modules module_access
      left join public.organization_members member
        on member.org_id = module_access.org_id
       and member.user_id = module_access.user_id
      where member.user_id is null
    ) as assignments_consistent
)
select
  state.organization_module_assignments,
  state.members_with_module_access,
  state.multi_org_users_requiring_review,
  state.tenant_module_rpc_available,
  state.anonymous_access_revoked,
  state.assignments_consistent,
  (
    to_regprocedure('public.get_my_organization_module_roles(uuid)') is not null
    and state.tenant_module_rpc_available
    and state.anonymous_access_revoked
    and state.assignments_consistent
  ) as organization_module_access_runtime_ok
from state;
