-- Axion SaaS - Fase 2B / Hotfix
-- Corrige a consulta de membros do console organizacional.
-- Somente recria RPC e grants; nao altera dados.

begin;

select pg_advisory_xact_lock(
  hashtext('axionn:20260704:07b_fix_organization_members_query')
);

do $$
declare
  v_missing text;
begin
  select string_agg(object_name, ', ' order by object_name)
  into v_missing
  from (
    values
      ('public.organization_members', to_regclass('public.organization_members') is not null),
      ('public.organization_member_modules', to_regclass('public.organization_member_modules') is not null),
      ('public.profiles', to_regclass('public.profiles') is not null),
      ('public.is_platform_admin(uuid)', to_regprocedure('public.is_platform_admin(uuid)') is not null),
      ('public.is_organization_admin(uuid,uuid)', to_regprocedure('public.is_organization_admin(uuid,uuid)') is not null)
  ) dependency(object_name, present)
  where not present;

  if v_missing is not null then
    raise exception 'Dependencias ausentes para corrigir consulta de membros: %', v_missing;
  end if;
end;
$$;

create or replace function public.get_organization_members_v2(
  p_org_id uuid
)
returns table (
  user_id uuid,
  display_name text,
  email text,
  membership_role text,
  is_active boolean,
  joined_at timestamptz,
  module_keys text[]
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_org_id is null then
    raise exception using
      errcode = '42501',
      message = 'organization_context_required';
  end if;

  if not (
    coalesce(public.is_platform_admin(auth.uid()), false)
    or coalesce(public.is_organization_admin(p_org_id, auth.uid()), false)
  ) then
    raise exception using
      errcode = '42501',
      message = 'organization_members_access_denied';
  end if;

  return query
  select
    member.user_id::uuid,
    coalesce(
      nullif(profile.display_name::text, ''),
      nullif(profile.email::text, ''),
      user_account.email::text,
      'Usuario'
    )::text as display_name,
    coalesce(profile.email::text, user_account.email::text, '')::text as email,
    member.role::text as membership_role,
    member.is_active::boolean,
    member.joined_at::timestamptz,
    coalesce(
      array_agg(module_access.module_key::text order by module_access.module_key::text)
        filter (where module_access.module_key is not null),
      '{}'::text[]
    )::text[] as module_keys
  from public.organization_members member
  left join public.profiles profile
    on profile.user_id = member.user_id
  left join auth.users user_account
    on user_account.id = member.user_id
  left join public.organization_member_modules module_access
    on module_access.org_id = member.org_id
   and module_access.user_id = member.user_id
  where member.org_id = p_org_id
  group by
    member.user_id,
    profile.display_name,
    profile.email,
    user_account.email,
    member.role,
    member.is_active,
    member.joined_at
  order by
    member.is_active desc,
    case member.role::text
      when 'owner' then 1
      when 'admin' then 2
      else 3
    end,
    coalesce(
      nullif(profile.display_name::text, ''),
      nullif(profile.email::text, ''),
      user_account.email::text,
      'Usuario'
    )::text;
end;
$$;

revoke all on function public.get_organization_members_v2(uuid)
  from public, anon;
grant execute on function public.get_organization_members_v2(uuid)
  to authenticated, service_role;

do $$
begin
  if to_regprocedure('public.get_organization_members_v2(uuid)') is null then
    raise exception 'Post-validation failed: RPC de membros nao existe';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_organization_members_v2(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Post-validation failed: authenticated sem execute no RPC de membros';
  end if;

  if has_function_privilege(
    'anon',
    'public.get_organization_members_v2(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Post-validation failed: anon pode executar RPC de membros';
  end if;
end;
$$;

commit;

select
  to_regprocedure('public.get_organization_members_v2(uuid)') is not null
    as member_query_present,
  has_function_privilege(
    'authenticated',
    'public.get_organization_members_v2(uuid)',
    'EXECUTE'
  ) as authenticated_access_available,
  not has_function_privilege(
    'anon',
    'public.get_organization_members_v2(uuid)',
    'EXECUTE'
  ) as anonymous_access_revoked,
  (
    to_regprocedure('public.get_organization_members_v2(uuid)') is not null
    and has_function_privilege(
      'authenticated',
      'public.get_organization_members_v2(uuid)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.get_organization_members_v2(uuid)',
      'EXECUTE'
    )
  ) as organization_member_query_hotfix_ok;
