-- Unifica a edição administrativa de membros após o cutover de tenancy.
-- A mutação permanece tenant-scoped, transacional e auditada.

create or replace function public.manage_organization_member_v1(
  p_org_id uuid,
  p_user_id uuid,
  p_display_name text default null,
  p_role text default null,
  p_is_active boolean default null,
  p_module_keys text[] default null
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
  v_modules text[];
  v_module text;
  v_name text;
begin
  if v_actor is null
     or not coalesce(public.is_organization_admin(p_org_id, v_actor), false) then
    raise exception using errcode = '42501',
      message = 'organization_member_update_forbidden';
  end if;

  select * into v_member
  from public.organization_members member
  where member.org_id = p_org_id and member.user_id = p_user_id
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

  update public.organization_members
  set role = v_next_role,
      is_active = coalesce(p_is_active, is_active),
      updated_by = v_actor
  where org_id = p_org_id and user_id = p_user_id;

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

  if p_module_keys is not null then
    select coalesce(
      array_agg(distinct requested.module_key order by requested.module_key),
      '{}'::text[]
    )
    into v_modules
    from unnest(p_module_keys) requested(module_key)
    where requested.module_key in ('sala_agil', 'sustentacao', 'rdm');

    if cardinality(v_modules) = 0 then
      raise exception using errcode = '22023',
        message = 'organization_member_module_required';
    end if;

    delete from public.organization_member_modules module_access
    where module_access.org_id = p_org_id
      and module_access.user_id = p_user_id;

    foreach v_module in array v_modules
    loop
      insert into public.organization_member_modules (
        org_id, user_id, module_key, role_name, assigned_by
      )
      values (
        p_org_id, p_user_id, v_module,
        case when v_next_role::text = 'admin' then 'admin' else 'member' end,
        v_actor
      );
    end loop;
  end if;

  insert into public.organization_membership_audit_log (
    org_id, actor_id, subject_user_id, action, details
  )
  values (
    p_org_id, v_actor, p_user_id, 'member_managed',
    jsonb_build_object(
      'previous_role', v_member.role::text,
      'role', v_next_role::text,
      'previous_active', v_member.is_active,
      'is_active', coalesce(p_is_active, v_member.is_active),
      'display_name_changed', v_name is not null,
      'module_keys', p_module_keys
    )
  );

  return true;
end;
$$;

revoke all on function public.manage_organization_member_v1(
  uuid, uuid, text, text, boolean, text[]
) from public, anon;
grant execute on function public.manage_organization_member_v1(
  uuid, uuid, text, text, boolean, text[]
) to authenticated, service_role;

comment on function public.manage_organization_member_v1(
  uuid, uuid, text, text, boolean, text[]
) is
  'Edita perfil, papel, status de membership e módulos de um membro no tenant, com RBAC e auditoria.';

select pg_notify('pgrst', 'reload schema');
