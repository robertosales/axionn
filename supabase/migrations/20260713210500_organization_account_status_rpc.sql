-- Expõe o status global da conta para a mesma lista tenant-scoped já autorizada.
-- organization_members.is_active continua representando a associação ao tenant;
-- profiles.is_active representa o bloqueio global sincronizado com auth.users.

create or replace function public.get_organization_account_statuses(
  p_org_id uuid
)
returns table (
  user_id uuid,
  is_active boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
     or not coalesce(public.is_organization_admin(p_org_id, auth.uid()), false) then
    raise exception using
      errcode = '42501',
      message = 'organization_members_access_denied';
  end if;

  return query
  select
    member.user_id,
    coalesce(profile.is_active, member.is_active) as is_active
  from public.get_organization_members_v2(p_org_id) member
  left join public.profiles profile
    on profile.user_id = member.user_id;
end;
$$;

revoke all on function public.get_organization_account_statuses(uuid)
  from public, anon;
grant execute on function public.get_organization_account_statuses(uuid)
  to authenticated, service_role;

comment on function public.get_organization_account_statuses(uuid) is
  'Retorna o status global RBAC/Auth das contas visíveis ao administrador da organização.';

select pg_notify('pgrst', 'reload schema');
