-- Persistência tenant-scoped de perfis por módulo.
--
-- O fluxo anterior recebia apenas module_keys e recriava cada vínculo com
-- role_name = member. O novo contrato recebe pares {module_key, role_name},
-- valida as combinações aceitas e mantém o papel organizacional independente.

begin;

create or replace function public.get_organization_member_module_roles_v1(
  p_org_id uuid
)
returns table (
  user_id uuid,
  module_key text,
  role_name text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
     or not coalesce(public.is_organization_admin(p_org_id, auth.uid()), false) then
    raise exception using errcode = '42501',
      message = 'organization_member_module_roles_access_denied';
  end if;

  return query
  select
    module_access.user_id,
    module_access.module_key::text,
    case
      when module_access.role_name = 'qa' then 'qa_analyst'
      else module_access.role_name
    end::text
  from public.organization_member_modules module_access
  where module_access.org_id = p_org_id
  order by module_access.user_id, module_access.module_key;
end;
$$;

create or replace function public.manage_organization_member_profile_v2(
  p_org_id uuid,
  p_user_id uuid,
  p_display_name text default null,
  p_role text default null,
  p_is_active boolean default null,
  p_module_roles jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_member public.organization_members%rowtype;
  v_next_role public.org_member_role;
  v_name text;
begin
  if v_actor is null
     or not coalesce(public.is_organization_admin(p_org_id, v_actor), false) then
    raise exception using errcode = '42501',
      message = 'organization_member_update_forbidden';
  end if;

  select * into v_member
  from public.organization_members member
  where member.org_id = p_org_id
    and member.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002',
      message = 'organization_member_not_found';
  end if;

  if p_user_id = v_actor and p_is_active = false then
    raise exception using errcode = '22023',
      message = 'organization_member_self_deactivation_forbidden';
  end if;

  if p_role is not null and p_role not in ('admin', 'member') then
    raise exception using errcode = '22023',
      message = 'organization_member_invalid_role';
  end if;

  if v_member.role::text = 'owner'
     and ((p_role is not null and p_role <> 'owner') or p_is_active = false) then
    raise exception using errcode = '22023',
      message = 'organization_owner_requires_transfer';
  end if;

  v_next_role := coalesce(p_role::public.org_member_role, v_member.role);
  v_name := nullif(btrim(p_display_name), '');

  if p_display_name is not null and v_name is null then
    raise exception using errcode = '22023',
      message = 'organization_member_display_name_required';
  end if;

  if v_name is not null and (
    select count(*)
    from public.organization_members membership
    where membership.user_id = p_user_id
      and membership.is_active
  ) > 1 then
    raise exception using errcode = '22023',
      message = 'organization_member_shared_profile_name_forbidden';
  end if;

  if p_module_roles is not null then
    if jsonb_typeof(p_module_roles) <> 'array'
       or jsonb_array_length(p_module_roles) = 0 then
      raise exception using errcode = '22023',
        message = 'organization_member_module_role_required';
    end if;

    if exists (
      with requested as (
        select
          nullif(btrim(item ->> 'module_key'), '') as module_key,
          case
            when nullif(btrim(item ->> 'role_name'), '') = 'qa'
              then 'qa_analyst'
            else nullif(btrim(item ->> 'role_name'), '')
          end as role_name
        from jsonb_array_elements(p_module_roles) item
      )
      select 1
      from requested
      where module_key is null
         or role_name is null
         or not (
           (module_key = 'sala_agil' and role_name in (
             'admin', 'scrum_master', 'product_owner', 'developer',
             'analyst', 'architect', 'qa_analyst', 'member'
           ))
           or (module_key = 'sustentacao' and role_name in (
             'admin', 'developer', 'analyst', 'architect',
             'qa_analyst', 'member'
           ))
           or (module_key = 'rdm' and role_name in (
             'admin', 'change_manager', 'rdm_approver',
             'rdm_executor', 'member'
           ))
         )
    ) then
      raise exception using errcode = '22023',
        message = 'organization_member_module_role_invalid';
    end if;

    if (
      select count(*) <> count(distinct btrim(item ->> 'module_key'))
      from jsonb_array_elements(p_module_roles) item
    ) then
      raise exception using errcode = '22023',
        message = 'organization_member_module_role_duplicate';
    end if;
  end if;

  update public.organization_members
  set role = v_next_role,
      is_active = coalesce(p_is_active, is_active),
      updated_by = v_actor
  where org_id = p_org_id
    and user_id = p_user_id;

  if v_name is not null then
    update public.profiles
    set display_name = v_name,
        updated_at = now()
    where user_id = p_user_id;

    if not found then
      raise exception using errcode = 'P0002',
        message = 'organization_member_profile_not_found';
    end if;
  end if;

  if p_module_roles is not null then
    delete from public.organization_member_modules module_access
    where module_access.org_id = p_org_id
      and module_access.user_id = p_user_id;

    insert into public.organization_member_modules (
      org_id,
      user_id,
      module_key,
      role_name,
      assigned_by
    )
    select
      p_org_id,
      p_user_id,
      btrim(item ->> 'module_key'),
      case
        when btrim(item ->> 'role_name') = 'qa' then 'qa_analyst'
        else btrim(item ->> 'role_name')
      end,
      v_actor
    from jsonb_array_elements(p_module_roles) item;
  end if;

  insert into public.organization_membership_audit_log (
    org_id,
    actor_id,
    subject_user_id,
    action,
    details
  )
  values (
    p_org_id,
    v_actor,
    p_user_id,
    'member_profile_managed',
    jsonb_build_object(
      'previous_role', v_member.role::text,
      'role', v_next_role::text,
      'previous_active', v_member.is_active,
      'is_active', coalesce(p_is_active, v_member.is_active),
      'display_name_changed', v_name is not null,
      'module_roles', p_module_roles
    )
  );

  return true;
end;
$$;

revoke all on function public.get_organization_member_module_roles_v1(uuid)
  from public, anon;
revoke all on function public.manage_organization_member_profile_v2(
  uuid, uuid, text, text, boolean, jsonb
) from public, anon;

grant execute on function public.get_organization_member_module_roles_v1(uuid)
  to authenticated, service_role;
grant execute on function public.manage_organization_member_profile_v2(
  uuid, uuid, text, text, boolean, jsonb
) to authenticated, service_role;

comment on function public.get_organization_member_module_roles_v1(uuid) is
  'Lista perfis por módulo no tenant para a administração organizacional.';
comment on function public.manage_organization_member_profile_v2(
  uuid, uuid, text, text, boolean, jsonb
) is
  'Persiste perfil, status, papel organizacional e perfis por módulo no tenant.';

notify pgrst, 'reload schema';

commit;
