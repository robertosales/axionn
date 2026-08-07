-- Reparo aditivo das RPCs de insights RBAC.
-- Necessario para ambientes que aplicaram a governanca antes de as funcoes de
-- historico e simulacao estarem presentes no schema exposto pelo PostgREST.

begin;

create or replace function public.list_rbac_audit_events_v1(
  p_org_id uuid,
  p_limit integer default 100,
  p_profile_key text default null
)
returns table (
  audit_id uuid,
  action text,
  actor_id uuid,
  actor_name text,
  subject_user_id uuid,
  subject_name text,
  profile_key text,
  details jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
     or not coalesce(public.is_organization_admin(p_org_id, auth.uid()), false) then
    raise exception using errcode = '42501', message = 'rbac_audit_access_denied';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception using errcode = '22023', message = 'rbac_audit_limit_invalid';
  end if;

  return query
  select
    event.id,
    event.action,
    event.actor_id,
    coalesce(actor.display_name, 'Sistema'),
    event.subject_user_id,
    subject.display_name,
    nullif(event.details ->> 'profile_key', ''),
    event.details,
    event.created_at
  from public.organization_membership_audit_log event
  left join lateral (
    select profile.display_name
    from public.profiles profile
    where profile.user_id = event.actor_id
    order by profile.updated_at desc
    limit 1
  ) actor on true
  left join lateral (
    select profile.display_name
    from public.profiles profile
    where profile.user_id = event.subject_user_id
    order by profile.updated_at desc
    limit 1
  ) subject on true
  where event.org_id = p_org_id
    and event.action in (
      'rbac_profile_created',
      'rbac_profile_updated',
      'rbac_profile_archived',
      'member_profile_managed',
      'rbac_profile_change_requested',
      'rbac_profile_change_approved',
      'rbac_profile_change_rejected'
    )
    and (
      nullif(btrim(p_profile_key), '') is null
      or event.details ->> 'profile_key' = btrim(p_profile_key)
      or exists (
        select 1
        from jsonb_array_elements(
          case
            when jsonb_typeof(event.details -> 'module_roles') = 'array'
              then event.details -> 'module_roles'
            else '[]'::jsonb
          end
        ) module_role
        where module_role ->> 'role_name' = btrim(p_profile_key)
      )
    )
  order by event.created_at desc, event.id desc
  limit p_limit;
end;
$$;

create or replace function public.simulate_rbac_user_access_v1(
  p_org_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.organization_members%rowtype;
  v_display_name text;
  v_module_profiles jsonb;
begin
  if auth.uid() is null
     or not coalesce(public.is_organization_admin(p_org_id, auth.uid()), false) then
    raise exception using errcode = '42501', message = 'rbac_simulation_access_denied';
  end if;

  select member.*
  into v_member
  from public.organization_members member
  where member.org_id = p_org_id
    and member.user_id = p_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'rbac_simulation_member_not_found';
  end if;

  select profile.display_name
  into v_display_name
  from public.profiles profile
  where profile.user_id = p_user_id
  order by profile.updated_at desc
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'module_key', access.module_key,
        'profile_key', access.role_name,
        'profile_name', coalesce(role.label, access.role_name),
        'is_profile_active', coalesce(role.is_active, false),
        'permissions', coalesce(permission_set.permissions, '[]'::jsonb),
        'permission_count', coalesce(permission_set.permission_count, 0),
        'expires_at', access.expires_at
      )
      order by access.module_key
    ),
    '[]'::jsonb
  )
  into v_module_profiles
  from public.organization_member_modules access
  left join public.app_roles role
    on role.name = access.role_name
   and (role.organization_id is null or role.organization_id = p_org_id)
  left join lateral (
    select
      jsonb_agg(
        jsonb_build_object(
          'permission_key', permission.key,
          'label', permission.label,
          'description', permission.description,
          'group_key', permission.group_key
        )
        order by permission.group_key, permission.label
      ) as permissions,
      count(permission.key)::integer as permission_count
    from public.role_permissions mapping
    join public.app_permissions permission
      on permission.key = mapping.permission_key
    where mapping.role_name = access.role_name
      and public.rbac_permission_module_v1(permission.group_key) = access.module_key
  ) permission_set on true
  where access.org_id = p_org_id
    and access.user_id = p_user_id
    and (access.expires_at is null or access.expires_at > now());

  return jsonb_build_object(
    'user_id', p_user_id,
    'display_name', coalesce(v_display_name, 'Usuario'),
    'membership_role', v_member.role::text,
    'is_active', v_member.is_active,
    'has_administrative_bypass', coalesce(
      public.is_organization_admin(p_org_id, p_user_id),
      false
    ),
    'module_profiles', v_module_profiles,
    'permission_count', coalesce((
      select sum((item ->> 'permission_count')::integer)
      from jsonb_array_elements(v_module_profiles) item
    ), 0)
  );
end;
$$;

revoke all on function public.list_rbac_audit_events_v1(uuid, integer, text)
  from public, anon;
revoke all on function public.simulate_rbac_user_access_v1(uuid, uuid)
  from public, anon;

grant execute on function public.list_rbac_audit_events_v1(uuid, integer, text)
  to authenticated, service_role;
grant execute on function public.simulate_rbac_user_access_v1(uuid, uuid)
  to authenticated, service_role;

comment on function public.list_rbac_audit_events_v1(uuid, integer, text) is
  'Lista eventos RBAC tenant-scoped, incluindo governanca privilegiada.';
comment on function public.simulate_rbac_user_access_v1(uuid, uuid) is
  'Simula acesso RBAC efetivo e ignora atribuicoes temporarias expiradas.';

notify pgrst, 'reload schema';

commit;
