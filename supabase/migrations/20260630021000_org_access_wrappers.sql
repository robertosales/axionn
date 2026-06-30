-- Axion SaaS — Fase 1
-- Wrappers públicos limitados ao usuário autenticado.
-- As variantes internas perdem parâmetros default para evitar ambiguidade no PostgREST.

create or replace function public.is_platform_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.platform_user_roles role
    where role.user_id = p_user_id
      and role.role = 'platform_admin'
  );
$$;

create or replace function public.is_organization_member(
  p_org_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin(p_user_id)
    or exists (
      select 1
      from public.organization_members member
      where member.org_id = p_org_id
        and member.user_id = p_user_id
    );
$$;

create or replace function public.is_organization_admin(
  p_org_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin(p_user_id)
    or exists (
      select 1
      from public.organization_members member
      where member.org_id = p_org_id
        and member.user_id = p_user_id
        and member.role in ('owner', 'admin')
    );
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin(auth.uid());
$$;

create or replace function public.is_organization_member(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_organization_member(p_org_id, auth.uid());
$$;

create or replace function public.is_organization_admin(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_organization_admin(p_org_id, auth.uid());
$$;

revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.is_organization_member(uuid) from public, anon;
revoke all on function public.is_organization_admin(uuid) from public, anon;

grant execute on function public.is_platform_admin() to authenticated, service_role;
grant execute on function public.is_organization_member(uuid) to authenticated, service_role;
grant execute on function public.is_organization_admin(uuid) to authenticated, service_role;

-- As variantes com user_id explícito são internas e não devem ser usadas pelo frontend.
revoke all on function public.is_platform_admin(uuid) from public, anon, authenticated;
revoke all on function public.is_organization_member(uuid, uuid) from public, anon, authenticated;
revoke all on function public.is_organization_admin(uuid, uuid) from public, anon, authenticated;

grant execute on function public.is_platform_admin(uuid) to service_role;
grant execute on function public.is_organization_member(uuid, uuid) to service_role;
grant execute on function public.is_organization_admin(uuid, uuid) to service_role;
