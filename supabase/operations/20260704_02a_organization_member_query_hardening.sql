-- Axion SaaS — Fase 2A / Lote 2A
-- Executar depois de 20260704_02_organization_member_invitations_rollout.sql
-- e antes de 20260704_02b_organization_module_access_runtime.sql.

begin;

select pg_advisory_xact_lock(
  hashtext('axionn:20260704:02a_organization_member_query_hardening')
);

do $$
begin
  if to_regclass('public.organization_members') is null
     or to_regprocedure('public.is_organization_admin(uuid,uuid)') is null then
    raise exception 'Dependências ausentes para o hardening da consulta de membros';
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
  if not public.is_organization_admin(p_org_id, auth.uid()) then
    raise exception using
      errcode = '42501',
      message = 'organization_members_access_denied';
  end if;

  return query
  select
    member.user_id,
    coalesce(nullif(profile.display_name, ''), user_account.email, 'Usuário')
      as resolved_display_name,
    coalesce(profile.email, user_account.email, '') as resolved_email,
    member.role::text,
    member.is_active,
    member.joined_at,
    coalesce(
      array_agg(module_access.module_key order by module_access.module_key)
        filter (where module_access.module_key is not null),
      '{}'::text[]
    )
  from public.organization_members member
  left join public.profiles profile on profile.user_id = member.user_id
  left join auth.users user_account on user_account.id = member.user_id
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
    member.role::text,
    coalesce(nullif(profile.display_name, ''), user_account.email, 'Usuário');
end;
$$;

revoke all on function public.get_organization_members_v2(uuid)
  from public, anon;
grant execute on function public.get_organization_members_v2(uuid)
  to authenticated, service_role;

do $$
begin
  if not has_function_privilege(
    'authenticated',
    'public.get_organization_members_v2(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Post-validation failed: RPC de membros indisponível';
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
  ) as organization_member_query_hardening_ok;
