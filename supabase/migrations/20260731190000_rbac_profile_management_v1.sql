-- Catálogo RBAC tenant-scoped e fluxo de criação de perfis.
-- Perfis nativos permanecem globais e imutáveis; perfis personalizados
-- pertencem a uma organização e compartilham o catálogo canônico de permissões.

begin;

alter table public.app_permissions
  add column if not exists description text;

alter table public.app_roles
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists description text,
  add column if not exists category text not null default 'custom',
  add column if not exists color_token text not null default 'violet',
  add column if not exists icon_name text not null default 'shield-check',
  add column if not exists module_keys text[] not null default array['sala_agil']::text[],
  add column if not exists is_system boolean not null default false,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.app_roles
set is_system = true,
    is_active = true,
    category = case
      when name in ('admin', 'scrum_master', 'product_owner', 'change_manager') then 'governance'
      when name in ('qa', 'qa_analyst') then 'quality'
      when name in ('rdm_approver', 'rdm_executor') then 'support'
      else 'delivery'
    end,
    color_token = case
      when name = 'admin' then 'violet'
      when name in ('qa', 'qa_analyst') then 'emerald'
      when name in ('change_manager', 'rdm_approver', 'rdm_executor') then 'blue'
      else 'cyan'
    end,
    icon_name = case
      when name = 'admin' then 'crown'
      when name in ('qa', 'qa_analyst') then 'bug'
      when name in ('developer', 'architect') then 'code'
      when name in ('change_manager', 'rdm_approver', 'rdm_executor') then 'workflow'
      else 'shield-check'
    end,
    module_keys = case
      when name in ('change_manager', 'rdm_approver', 'rdm_executor')
        then array['rdm']::text[]
      when name in ('scrum_master', 'product_owner')
        then array['sala_agil']::text[]
      when name in ('developer', 'analyst', 'architect', 'qa', 'qa_analyst')
        then array['sala_agil', 'sustentacao']::text[]
      else array['sala_agil', 'sustentacao', 'rdm']::text[]
    end,
    description = coalesce(nullif(description, ''), case name
      when 'admin' then 'Acesso administrativo aos módulos e configurações disponíveis.'
      when 'scrum_master' then 'Facilita o fluxo ágil, sprints, cerimônias e impedimentos.'
      when 'product_owner' then 'Prioriza valor, objetivos, backlog e entregas do produto.'
      when 'developer' then 'Executa e acompanha o trabalho técnico da equipe.'
      when 'analyst' then 'Analisa requisitos, regras e critérios de aceite.'
      when 'architect' then 'Orienta decisões técnicas, integrações e arquitetura.'
      when 'qa' then 'Planeja e executa a estratégia de qualidade.'
      when 'qa_analyst' then 'Planeja e executa a estratégia de qualidade.'
      when 'change_manager' then 'Governa o ciclo de mudanças e suas decisões.'
      when 'rdm_approver' then 'Avalia riscos e aprova mudanças atribuídas.'
      when 'rdm_executor' then 'Executa mudanças aprovadas e registra evidências.'
      else 'Acesso operacional padrão aos recursos autorizados.'
    end),
    updated_at = coalesce(updated_at, now())
where organization_id is null;

alter table public.app_roles
  drop constraint if exists app_roles_category_check,
  drop constraint if exists app_roles_color_token_check,
  drop constraint if exists app_roles_module_keys_check,
  add constraint app_roles_category_check
    check (category in ('governance', 'delivery', 'quality', 'support', 'custom')),
  add constraint app_roles_color_token_check
    check (color_token in ('violet', 'blue', 'cyan', 'emerald', 'amber', 'rose')),
  add constraint app_roles_module_keys_check
    check (
      cardinality(module_keys) > 0
      and module_keys <@ array['sala_agil', 'sustentacao', 'rdm']::text[]
    );

create unique index if not exists uq_app_roles_org_active_label
  on public.app_roles(organization_id, lower(label))
  where organization_id is not null and is_active;
create index if not exists idx_app_roles_org_active
  on public.app_roles(organization_id, is_active, sort_order, label);
create index if not exists idx_organization_member_modules_role
  on public.organization_member_modules(org_id, role_name);

create or replace function public.rbac_permission_module_v1(p_group_key text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_group_key = 'rdm' then 'rdm'
    when p_group_key = 'sustentacao' then 'sustentacao'
    else 'sala_agil'
  end
$$;

create or replace function public.is_rbac_profile_available_v1(
  p_org_id uuid,
  p_module_key text,
  p_profile_key text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.app_roles profile
    where profile.name = p_profile_key
      and profile.is_active
      and p_module_key = any(profile.module_keys)
      and (profile.organization_id is null or profile.organization_id = p_org_id)
  )
$$;

create or replace function public.list_rbac_permissions_v1(p_org_id uuid)
returns table (
  permission_key text,
  label text,
  description text,
  group_key text,
  module_key text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
     or not coalesce(public.is_organization_admin(p_org_id, auth.uid()), false) then
    raise exception using errcode = '42501', message = 'rbac_catalog_access_denied';
  end if;

  return query
  select
    permission.key,
    permission.label,
    permission.description,
    permission.group_key,
    public.rbac_permission_module_v1(permission.group_key)
  from public.app_permissions permission
  order by
    public.rbac_permission_module_v1(permission.group_key),
    permission.group_key,
    permission.label;
end;
$$;

create or replace function public.list_rbac_profiles_v1(p_org_id uuid)
returns table (
  profile_key text,
  display_name text,
  description text,
  category text,
  color_token text,
  icon_name text,
  module_keys text[],
  permission_keys text[],
  permission_count bigint,
  user_count bigint,
  is_system boolean,
  is_active boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
     or not coalesce(public.is_organization_admin(p_org_id, auth.uid()), false) then
    raise exception using errcode = '42501', message = 'rbac_catalog_access_denied';
  end if;

  return query
  select
    profile.name,
    profile.label,
    coalesce(profile.description, ''),
    profile.category,
    profile.color_token,
    profile.icon_name,
    profile.module_keys,
    coalesce(permissions.permission_keys, array[]::text[]),
    coalesce(permissions.permission_count, 0::bigint),
    coalesce(assignments.user_count, 0::bigint),
    profile.is_system,
    profile.is_active,
    profile.updated_at
  from public.app_roles profile
  left join lateral (
    select
      array_agg(mapping.permission_key order by mapping.permission_key) as permission_keys,
      count(*)::bigint as permission_count
    from public.role_permissions mapping
    where mapping.role_name = profile.name
  ) permissions on true
  left join lateral (
    select count(distinct access.user_id)::bigint as user_count
    from public.organization_member_modules access
    join public.organization_members member
      on member.org_id = access.org_id
     and member.user_id = access.user_id
     and member.is_active
    where access.org_id = p_org_id
      and access.role_name = profile.name
  ) assignments on true
  where profile.is_active
    and (profile.organization_id is null or profile.organization_id = p_org_id)
  order by profile.is_system desc, profile.sort_order, profile.label;
end;
$$;

create or replace function public.save_rbac_profile_v1(
  p_org_id uuid,
  p_profile_key text default null,
  p_display_name text default null,
  p_description text default null,
  p_category text default 'custom',
  p_color_token text default 'violet',
  p_icon_name text default 'shield-check',
  p_module_keys text[] default null,
  p_permission_keys text[] default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_profile_key text := nullif(btrim(p_profile_key), '');
  v_display_name text := nullif(btrim(p_display_name), '');
  v_description text := nullif(btrim(p_description), '');
  v_existing public.app_roles%rowtype;
  v_slug text;
begin
  if v_actor is null
     or not coalesce(public.is_organization_admin(p_org_id, v_actor), false) then
    raise exception using errcode = '42501', message = 'rbac_profile_write_denied';
  end if;

  if v_display_name is null or length(v_display_name) < 3 or length(v_display_name) > 80 then
    raise exception using errcode = '22023', message = 'rbac_profile_name_invalid';
  end if;
  if v_description is null or length(v_description) < 10 or length(v_description) > 280 then
    raise exception using errcode = '22023', message = 'rbac_profile_description_invalid';
  end if;
  if p_category not in ('governance', 'delivery', 'quality', 'support', 'custom') then
    raise exception using errcode = '22023', message = 'rbac_profile_category_invalid';
  end if;
  if p_color_token not in ('violet', 'blue', 'cyan', 'emerald', 'amber', 'rose') then
    raise exception using errcode = '22023', message = 'rbac_profile_color_invalid';
  end if;
  if p_icon_name is null or length(btrim(p_icon_name)) = 0 then
    raise exception using errcode = '22023', message = 'rbac_profile_icon_invalid';
  end if;
  if p_module_keys is null
     or cardinality(p_module_keys) = 0
     or not (p_module_keys <@ array['sala_agil', 'sustentacao', 'rdm']::text[])
     or cardinality(p_module_keys) <> cardinality(array(select distinct unnest(p_module_keys))) then
    raise exception using errcode = '22023', message = 'rbac_profile_modules_invalid';
  end if;
  if p_permission_keys is null
     or cardinality(p_permission_keys) = 0
     or cardinality(p_permission_keys) <> cardinality(array(select distinct unnest(p_permission_keys))) then
    raise exception using errcode = '22023', message = 'rbac_profile_permissions_invalid';
  end if;
  if exists (
    select 1
    from unnest(p_permission_keys) requested(permission_key)
    left join public.app_permissions permission on permission.key = requested.permission_key
    where permission.key is null
       or not (public.rbac_permission_module_v1(permission.group_key) = any(p_module_keys))
  ) then
    raise exception using errcode = '22023', message = 'rbac_profile_permission_scope_invalid';
  end if;

  if v_profile_key is not null then
    select * into v_existing
    from public.app_roles profile
    where profile.name = v_profile_key
    for update;

    if not found or v_existing.organization_id is distinct from p_org_id then
      raise exception using errcode = 'P0002', message = 'rbac_profile_not_found';
    end if;
    if v_existing.is_system then
      raise exception using errcode = '22023', message = 'rbac_system_profile_immutable';
    end if;
  else
    v_slug := trim(both '-' from regexp_replace(lower(v_display_name), '[^a-z0-9]+', '-', 'g'));
    if v_slug = '' then v_slug := 'perfil'; end if;
    v_profile_key := 'org_' || replace(p_org_id::text, '-', '') || '_' || left(v_slug, 32) || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  end if;

  if exists (
    select 1
    from public.app_roles profile
    where profile.organization_id = p_org_id
      and profile.is_active
      and lower(profile.label) = lower(v_display_name)
      and profile.name <> v_profile_key
  ) then
    raise exception using errcode = '23505', message = 'rbac_profile_name_already_exists';
  end if;

  insert into public.app_roles (
    name, label, sort_order, organization_id, description, category,
    color_token, icon_name, module_keys, is_system, is_active,
    created_by, created_at, updated_at
  ) values (
    v_profile_key, v_display_name, 1000, p_org_id, v_description, p_category,
    p_color_token, btrim(p_icon_name), p_module_keys, false, true,
    v_actor, now(), now()
  )
  on conflict (name) do update set
    label = excluded.label,
    description = excluded.description,
    category = excluded.category,
    color_token = excluded.color_token,
    icon_name = excluded.icon_name,
    module_keys = excluded.module_keys,
    is_active = true,
    updated_at = now();

  delete from public.role_permissions mapping
  where mapping.role_name = v_profile_key;

  insert into public.role_permissions(role_name, permission_key)
  select v_profile_key, permission_key
  from unnest(p_permission_keys) requested(permission_key);

  insert into public.organization_membership_audit_log (
    org_id, actor_id, action, details
  ) values (
    p_org_id,
    v_actor,
    case when p_profile_key is null then 'rbac_profile_created' else 'rbac_profile_updated' end,
    jsonb_build_object(
      'profile_key', v_profile_key,
      'display_name', v_display_name,
      'module_keys', p_module_keys,
      'permission_count', cardinality(p_permission_keys)
    )
  );

  return v_profile_key;
end;
$$;

create or replace function public.archive_rbac_profile_v1(
  p_org_id uuid,
  p_profile_key text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_profile public.app_roles%rowtype;
begin
  if v_actor is null
     or not coalesce(public.is_organization_admin(p_org_id, v_actor), false) then
    raise exception using errcode = '42501', message = 'rbac_profile_write_denied';
  end if;

  select * into v_profile
  from public.app_roles profile
  where profile.name = p_profile_key
  for update;

  if not found or v_profile.organization_id is distinct from p_org_id then
    raise exception using errcode = 'P0002', message = 'rbac_profile_not_found';
  end if;
  if v_profile.is_system then
    raise exception using errcode = '22023', message = 'rbac_system_profile_immutable';
  end if;
  if exists (
    select 1
    from public.organization_member_modules access
    where access.org_id = p_org_id
      and access.role_name = p_profile_key
  ) then
    raise exception using errcode = '23503', message = 'rbac_profile_in_use';
  end if;

  update public.app_roles
  set is_active = false, updated_at = now()
  where name = p_profile_key;

  insert into public.organization_membership_audit_log (
    org_id, actor_id, action, details
  ) values (
    p_org_id, v_actor, 'rbac_profile_archived',
    jsonb_build_object('profile_key', p_profile_key, 'display_name', v_profile.label)
  );

  return true;
end;
$$;

-- O gerenciador de membros passa a aceitar também perfis personalizados da
-- própria organização, sem ampliar o papel organizacional do usuário.
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
    raise exception using errcode = '42501', message = 'organization_member_update_forbidden';
  end if;

  select * into v_member
  from public.organization_members member
  where member.org_id = p_org_id and member.user_id = p_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'organization_member_not_found';
  end if;
  if p_user_id = v_actor and p_is_active = false then
    raise exception using errcode = '22023', message = 'organization_member_self_deactivation_forbidden';
  end if;
  if p_role is not null and p_role not in ('admin', 'member') then
    raise exception using errcode = '22023', message = 'organization_member_invalid_role';
  end if;
  if v_member.role::text = 'owner'
     and ((p_role is not null and p_role <> 'owner') or p_is_active = false) then
    raise exception using errcode = '22023', message = 'organization_owner_requires_transfer';
  end if;

  v_next_role := coalesce(p_role::public.org_member_role, v_member.role);
  v_name := nullif(btrim(p_display_name), '');
  if p_display_name is not null and v_name is null then
    raise exception using errcode = '22023', message = 'organization_member_display_name_required';
  end if;
  if v_name is not null and (
    select count(*) from public.organization_members membership
    where membership.user_id = p_user_id and membership.is_active
  ) > 1 then
    raise exception using errcode = '22023', message = 'organization_member_shared_profile_name_forbidden';
  end if;

  if p_module_roles is not null then
    if jsonb_typeof(p_module_roles) <> 'array' or jsonb_array_length(p_module_roles) = 0 then
      raise exception using errcode = '22023', message = 'organization_member_module_role_required';
    end if;
    if exists (
      with requested as (
        select
          nullif(btrim(item ->> 'module_key'), '') as module_key,
          case when nullif(btrim(item ->> 'role_name'), '') = 'qa'
            then 'qa_analyst' else nullif(btrim(item ->> 'role_name'), '') end as role_name
        from jsonb_array_elements(p_module_roles) item
      )
      select 1 from requested
      where module_key is null
         or role_name is null
         or not public.is_rbac_profile_available_v1(p_org_id, module_key, role_name)
    ) then
      raise exception using errcode = '22023', message = 'organization_member_module_role_invalid';
    end if;
    if (
      select count(*) <> count(distinct btrim(item ->> 'module_key'))
      from jsonb_array_elements(p_module_roles) item
    ) then
      raise exception using errcode = '22023', message = 'organization_member_module_role_duplicate';
    end if;
  end if;

  update public.organization_members
  set role = v_next_role,
      is_active = coalesce(p_is_active, is_active),
      updated_by = v_actor
  where org_id = p_org_id and user_id = p_user_id;

  if v_name is not null then
    update public.profiles set display_name = v_name, updated_at = now()
    where user_id = p_user_id;
    if not found then
      raise exception using errcode = 'P0002', message = 'organization_member_profile_not_found';
    end if;
  end if;

  if p_module_roles is not null then
    delete from public.organization_member_modules access
    where access.org_id = p_org_id and access.user_id = p_user_id;
    insert into public.organization_member_modules (
      org_id, user_id, module_key, role_name, assigned_by
    )
    select
      p_org_id,
      p_user_id,
      btrim(item ->> 'module_key'),
      case when btrim(item ->> 'role_name') = 'qa'
        then 'qa_analyst' else btrim(item ->> 'role_name') end,
      v_actor
    from jsonb_array_elements(p_module_roles) item;
  end if;

  insert into public.organization_membership_audit_log (
    org_id, actor_id, subject_user_id, action, details
  ) values (
    p_org_id, v_actor, p_user_id, 'member_profile_managed',
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

alter table public.app_roles enable row level security;
alter table public.app_permissions enable row level security;
alter table public.role_permissions enable row level security;

drop policy if exists app_roles_auth_select on public.app_roles;
drop policy if exists app_roles_admin_insert on public.app_roles;
drop policy if exists app_roles_admin_update on public.app_roles;
drop policy if exists app_roles_admin_delete on public.app_roles;
drop policy if exists app_roles_tenant_select on public.app_roles;
create policy app_roles_tenant_select on public.app_roles
for select to authenticated
using (
  organization_id is null
  or public.is_organization_member(organization_id, auth.uid())
);

drop policy if exists role_permissions_auth_select on public.role_permissions;
drop policy if exists role_permissions_admin_insert on public.role_permissions;
drop policy if exists role_permissions_admin_update on public.role_permissions;
drop policy if exists role_permissions_admin_delete on public.role_permissions;
drop policy if exists role_permissions_tenant_select on public.role_permissions;
create policy role_permissions_tenant_select on public.role_permissions
for select to authenticated
using (
  exists (
    select 1 from public.app_roles profile
    where profile.name = role_permissions.role_name
      and (
        profile.organization_id is null
        or public.is_organization_member(profile.organization_id, auth.uid())
      )
  )
);

revoke all on function public.rbac_permission_module_v1(text) from public, anon;
revoke all on function public.is_rbac_profile_available_v1(uuid, text, text) from public, anon;
revoke all on function public.list_rbac_permissions_v1(uuid) from public, anon;
revoke all on function public.list_rbac_profiles_v1(uuid) from public, anon;
revoke all on function public.save_rbac_profile_v1(uuid, text, text, text, text, text, text, text[], text[]) from public, anon;
revoke all on function public.archive_rbac_profile_v1(uuid, text) from public, anon;
revoke all on function public.manage_organization_member_profile_v2(uuid, uuid, text, text, boolean, jsonb) from public, anon;

grant execute on function public.rbac_permission_module_v1(text) to authenticated, service_role;
grant execute on function public.is_rbac_profile_available_v1(uuid, text, text) to service_role;
grant execute on function public.list_rbac_permissions_v1(uuid) to authenticated, service_role;
grant execute on function public.list_rbac_profiles_v1(uuid) to authenticated, service_role;
grant execute on function public.save_rbac_profile_v1(uuid, text, text, text, text, text, text, text[], text[]) to authenticated, service_role;
grant execute on function public.archive_rbac_profile_v1(uuid, text) to authenticated, service_role;
grant execute on function public.manage_organization_member_profile_v2(uuid, uuid, text, text, boolean, jsonb) to authenticated, service_role;

comment on function public.list_rbac_profiles_v1(uuid) is
  'Lista perfis nativos e personalizados disponíveis para uma organização.';
comment on function public.save_rbac_profile_v1(uuid, text, text, text, text, text, text, text[], text[]) is
  'Cria ou atualiza de forma transacional um perfil RBAC tenant-scoped.';
comment on function public.archive_rbac_profile_v1(uuid, text) is
  'Arquiva perfil personalizado sem vínculos ativos.';

notify pgrst, 'reload schema';

commit;
