-- Axion SaaS — Fase 2A / Lote 2
-- Adapta o runtime de módulos ao membership organizacional sem remover o legado.

-- Papéis globais legados não identificam a organização de origem. Para evitar
-- propagação cruzada, o backfill automático só ocorre quando o usuário possui
-- exatamente um membership organizacional ativo. Usuários multi-organização
-- devem receber módulos explicitamente por organização.
with active_membership_counts as (
  select member.user_id, count(*) as membership_count
  from public.organization_members member
  where member.is_active
  group by member.user_id
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
from public.organization_members member
join active_membership_counts membership_count
  on membership_count.user_id = member.user_id
 and membership_count.membership_count = 1
join public.user_module_roles module_role on module_role.user_id = member.user_id
where member.is_active
  and module_role.module in ('sala_agil', 'sustentacao', 'rdm')
on conflict (org_id, user_id, module_key) do nothing;

-- Usuários de organização única que ainda dependem de profiles.module_access
-- recebem compatibilidade apenas quando não possuem papéis organizacionais.
with active_membership_counts as (
  select member.user_id, count(*) as membership_count
  from public.organization_members member
  where member.is_active
  group by member.user_id
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
returns table (
  module text,
  role_name text
)
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

comment on function public.get_my_organization_module_roles(uuid) is
  'Retorna papéis de módulo do usuário autenticado dentro da organização selecionada.';
