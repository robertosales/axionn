-- Inclui membros dos contratos vinculados à organização na visão administrativa
-- de usuários. Compatibilidade para contratos legados cujos usuários ainda não
-- foram materializados em organization_members.

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
  if auth.uid() is null
     or not coalesce(public.is_organization_admin(p_org_id, auth.uid()), false) then
    raise exception using
      errcode = '42501',
      message = 'organization_members_access_denied';
  end if;

  return query
  with organization_scope as (
    select
      member.user_id,
      member.role::text as membership_role,
      member.is_active,
      member.created_at as joined_at,
      0 as source_priority
    from public.organization_members member
    where member.org_id = p_org_id

    union all

    select
      contract_member.user_id,
      case
        when contract_member.role::text = 'admin' then 'admin'
        else 'member'
      end as membership_role,
      coalesce(profile.is_active, true) as is_active,
      contract_member.created_at as joined_at,
      1 as source_priority
    from public.contract_members contract_member
    join public.contracts contract
      on contract.id = contract_member.contract_id
    left join public.companies company
      on company.id = contract.company_id
    left join public.profiles profile
      on profile.user_id = contract_member.user_id
    where coalesce(contract.org_id, company.org_id) = p_org_id
  ),
  effective_members as (
    select distinct on (scope.user_id)
      scope.user_id,
      scope.membership_role,
      scope.is_active,
      scope.joined_at
    from organization_scope scope
    order by scope.user_id, scope.source_priority, scope.joined_at
  ),
  explicit_modules as (
    select
      module_access.user_id,
      array_agg(
        distinct module_access.module_key::text
        order by module_access.module_key::text
      )::text[] as module_keys
    from public.organization_member_modules module_access
    where module_access.org_id = p_org_id
    group by module_access.user_id
  ),
  legacy_modules as (
    select
      role.user_id,
      array_agg(
        distinct role.module::text
        order by role.module::text
      ) filter (
        where role.module::text in ('sala_agil', 'sustentacao', 'rdm')
      )::text[] as module_keys
    from public.user_module_roles role
    group by role.user_id
  )
  select
    member.user_id::uuid,
    coalesce(
      nullif(profile.display_name::text, ''),
      user_account.email::text,
      'Usuário'::text
    )::text as resolved_display_name,
    coalesce(
      nullif(profile.email::text, ''),
      user_account.email::text,
      ''::text
    )::text as resolved_email,
    member.membership_role::text,
    member.is_active::boolean,
    member.joined_at::timestamptz,
    coalesce(
      explicit_modules.module_keys,
      legacy_modules.module_keys,
      case
        when profile.module_access::text = 'admin'
          then array['sala_agil', 'sustentacao', 'rdm']::text[]
        when profile.module_access::text in ('sala_agil', 'sustentacao', 'rdm')
          then array[profile.module_access::text]::text[]
        else '{}'::text[]
      end
    )::text[] as resolved_module_keys
  from effective_members member
  left join public.profiles profile
    on profile.user_id = member.user_id
  left join auth.users user_account
    on user_account.id = member.user_id
  left join explicit_modules
    on explicit_modules.user_id = member.user_id
  left join legacy_modules
    on legacy_modules.user_id = member.user_id
  order by
    member.is_active desc,
    case member.membership_role
      when 'owner' then 0
      when 'admin' then 1
      else 2
    end,
    lower(
      coalesce(
        nullif(profile.display_name::text, ''),
        user_account.email::text,
        'Usuário'::text
      )
    );
end;
$$;

revoke all on function public.get_organization_members_v2(uuid)
  from public, anon;
grant execute on function public.get_organization_members_v2(uuid)
  to authenticated, service_role;

comment on function public.get_organization_members_v2(uuid) is
  'Lista membros diretos da organização e membros dos contratos vinculados, restrito a administradores da organização.';

select pg_notify('pgrst', 'reload schema');
