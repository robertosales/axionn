-- RBAC governance v1
-- - dupla aprovacao para alteracoes que concedem permissoes privilegiadas
-- - atribuicoes temporarias com expiracao aplicada no runtime
-- - recomendacoes de menor privilegio baseadas em sinais reais de atividade

begin;

alter table public.organization_member_modules
  add column if not exists expires_at timestamptz,
  add column if not exists assignment_justification text;

alter table public.organization_member_modules
  drop constraint if exists organization_member_modules_expiry_justification_check;
alter table public.organization_member_modules
  add constraint organization_member_modules_expiry_justification_check
  check (
    expires_at is null
    or length(btrim(coalesce(assignment_justification, ''))) between 10 and 280
  );

create index if not exists idx_org_member_modules_active_expiry
  on public.organization_member_modules(org_id, expires_at)
  where expires_at is not null;

create table if not exists public.rbac_privileged_permissions (
  permission_key text primary key references public.app_permissions(key) on delete cascade,
  risk_level text not null check (risk_level in ('high', 'critical')),
  reason text not null,
  created_at timestamptz not null default now()
);

insert into public.rbac_privileged_permissions(permission_key, risk_level, reason)
select seed.permission_key, seed.risk_level, seed.reason
from (values
  ('rdm.approve', 'high', 'Permite aprovar mudancas com impacto operacional.'),
  ('rdm.admin', 'critical', 'Concede administracao completa do modulo de mudancas.'),
  ('okr.archive', 'high', 'Permite retirar objetivos do fluxo ativo.'),
  ('okr.export', 'high', 'Permite exportar dados organizacionais.'),
  ('okr.cycle_management', 'critical', 'Permite alterar o ciclo de vida organizacional dos OKRs.'),
  ('okr.automatic_metrics', 'high', 'Permite configurar fontes automaticas de medicao.')
) as seed(permission_key, risk_level, reason)
join public.app_permissions permission on permission.key = seed.permission_key
on conflict (permission_key) do update set
  risk_level = excluded.risk_level,
  reason = excluded.reason;

create table if not exists public.rbac_profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  profile_key text not null,
  change_type text not null check (change_type in ('create', 'update')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  risk_level text not null check (risk_level in ('high', 'critical')),
  risk_reasons text[] not null default '{}'::text[],
  current_snapshot jsonb,
  proposed_snapshot jsonb not null,
  requested_by uuid not null,
  reviewed_by uuid,
  review_note text,
  reviewed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reviewed_by is null or reviewed_by <> requested_by)
);

create unique index if not exists idx_rbac_profile_change_pending
  on public.rbac_profile_change_requests(org_id, profile_key)
  where status = 'pending';
create index if not exists idx_rbac_profile_change_org_created
  on public.rbac_profile_change_requests(org_id, created_at desc);

alter table public.rbac_privileged_permissions enable row level security;
alter table public.rbac_profile_change_requests enable row level security;
revoke all on table public.rbac_privileged_permissions from public, anon, authenticated;
revoke all on table public.rbac_profile_change_requests from public, anon, authenticated;
grant select, insert, update, delete on table public.rbac_privileged_permissions to service_role;
grant select, insert, update, delete on table public.rbac_profile_change_requests to service_role;

create or replace function public.list_rbac_privileged_permissions_v1(p_org_id uuid)
returns table(permission_key text, risk_level text, reason text)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
     or not coalesce(public.is_organization_admin(p_org_id, auth.uid()), false) then
    raise exception using errcode = '42501', message = 'rbac_governance_access_denied';
  end if;

  return query
  select catalog.permission_key, catalog.risk_level, catalog.reason
  from public.rbac_privileged_permissions catalog
  order by case catalog.risk_level when 'critical' then 0 else 1 end, catalog.permission_key;
end;
$$;

create or replace function public.submit_rbac_profile_change_v1(
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
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_profile_key text := nullif(btrim(p_profile_key), '');
  v_display_name text := nullif(btrim(p_display_name), '');
  v_existing public.app_roles%rowtype;
  v_current jsonb;
  v_proposed jsonb;
  v_request_id uuid;
  v_risk_level text;
  v_risk_reasons text[];
  v_slug text;
begin
  if v_actor is null
     or not coalesce(public.is_organization_admin(p_org_id, v_actor), false) then
    raise exception using errcode = '42501', message = 'rbac_profile_write_denied';
  end if;
  if v_display_name is null or length(v_display_name) < 3 or length(v_display_name) > 80 then
    raise exception using errcode = '22023', message = 'rbac_profile_name_invalid';
  end if;
  if p_description is null or length(btrim(p_description)) < 10 or length(btrim(p_description)) > 280 then
    raise exception using errcode = '22023', message = 'rbac_profile_description_invalid';
  end if;
  if p_category not in ('governance', 'delivery', 'quality', 'support', 'custom')
     or p_color_token not in ('violet', 'blue', 'cyan', 'emerald', 'amber', 'rose') then
    raise exception using errcode = '22023', message = 'rbac_profile_identity_invalid';
  end if;
  if p_module_keys is null or cardinality(p_module_keys) = 0
     or not (p_module_keys <@ array['sala_agil', 'sustentacao', 'rdm']::text[])
     or cardinality(p_module_keys) <> cardinality(array(select distinct unnest(p_module_keys))) then
    raise exception using errcode = '22023', message = 'rbac_profile_modules_invalid';
  end if;
  if p_permission_keys is null or cardinality(p_permission_keys) = 0
     or cardinality(p_permission_keys) <> cardinality(array(select distinct unnest(p_permission_keys))) then
    raise exception using errcode = '22023', message = 'rbac_profile_permissions_invalid';
  end if;
  if exists (
    select 1 from unnest(p_permission_keys) requested(permission_key)
    left join public.app_permissions permission on permission.key = requested.permission_key
    where permission.key is null
       or public.rbac_permission_module_v1(permission.group_key) <> all(p_module_keys)
  ) then
    raise exception using errcode = '22023', message = 'rbac_profile_permission_scope_invalid';
  end if;

  select
    case when bool_or(privileged.risk_level = 'critical') then 'critical' else 'high' end,
    array_agg(distinct privileged.reason order by privileged.reason)
  into v_risk_level, v_risk_reasons
  from unnest(p_permission_keys) requested(permission_key)
  join public.rbac_privileged_permissions privileged using(permission_key);
  if v_risk_level is null then
    raise exception using errcode = '22023', message = 'rbac_profile_change_not_privileged';
  end if;

  if v_profile_key is not null then
    select * into v_existing from public.app_roles profile
    where profile.name = v_profile_key for update;
    if not found or v_existing.organization_id is distinct from p_org_id then
      raise exception using errcode = 'P0002', message = 'rbac_profile_not_found';
    end if;
    if v_existing.is_system then
      raise exception using errcode = '22023', message = 'rbac_system_profile_immutable';
    end if;
    v_current := jsonb_build_object(
      'profile_key', v_existing.name, 'display_name', v_existing.label,
      'description', v_existing.description, 'category', v_existing.category,
      'color_token', v_existing.color_token, 'icon_name', v_existing.icon_name,
      'module_keys', v_existing.module_keys,
      'permission_keys', coalesce((select jsonb_agg(permission_key order by permission_key)
        from public.role_permissions where role_name = v_existing.name), '[]'::jsonb),
      'updated_at', v_existing.updated_at
    );
  else
    v_slug := trim(both '-' from regexp_replace(lower(v_display_name), '[^a-z0-9]+', '-', 'g'));
    if v_slug = '' then v_slug := 'perfil'; end if;
    v_profile_key := 'org_' || replace(p_org_id::text, '-', '') || '_' || left(v_slug, 32)
      || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  end if;

  if exists (select 1 from public.app_roles profile
    where profile.organization_id = p_org_id and profile.is_active
      and lower(profile.label) = lower(v_display_name) and profile.name <> v_profile_key) then
    raise exception using errcode = '23505', message = 'rbac_profile_name_already_exists';
  end if;

  v_proposed := jsonb_build_object(
    'profile_key', v_profile_key, 'display_name', v_display_name,
    'description', btrim(p_description), 'category', p_category,
    'color_token', p_color_token, 'icon_name', btrim(p_icon_name),
    'module_keys', to_jsonb(p_module_keys), 'permission_keys', to_jsonb(p_permission_keys)
  );

  insert into public.rbac_profile_change_requests(
    org_id, profile_key, change_type, risk_level, risk_reasons,
    current_snapshot, proposed_snapshot, requested_by
  ) values (
    p_org_id, v_profile_key, case when p_profile_key is null then 'create' else 'update' end,
    v_risk_level, coalesce(v_risk_reasons, '{}'::text[]), v_current, v_proposed, v_actor
  ) returning id into v_request_id;

  insert into public.organization_membership_audit_log(org_id, actor_id, action, details)
  values (p_org_id, v_actor, 'rbac_profile_change_requested',
    jsonb_build_object('request_id', v_request_id, 'profile_key', v_profile_key,
      'display_name', v_display_name, 'risk_level', v_risk_level));

  return jsonb_build_object('request_id', v_request_id, 'profile_key', v_profile_key,
    'status', 'pending', 'risk_level', v_risk_level);
end;
$$;

create or replace function public.review_rbac_profile_change_v1(
  p_org_id uuid,
  p_request_id uuid,
  p_decision text,
  p_note text default null
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_request public.rbac_profile_change_requests%rowtype;
  v_snapshot jsonb;
  v_action text;
begin
  if v_actor is null
     or not coalesce(public.is_organization_admin(p_org_id, v_actor), false) then
    raise exception using errcode = '42501', message = 'rbac_governance_access_denied';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception using errcode = '22023', message = 'rbac_review_decision_invalid';
  end if;
  if p_decision = 'reject' and length(btrim(coalesce(p_note, ''))) < 10 then
    raise exception using errcode = '22023', message = 'rbac_review_note_required';
  end if;

  select * into v_request from public.rbac_profile_change_requests request
  where request.id = p_request_id and request.org_id = p_org_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'rbac_change_request_not_found';
  end if;
  if v_request.status <> 'pending' or v_request.expires_at <= now() then
    if v_request.status = 'pending' then
      update public.rbac_profile_change_requests set status = 'expired', updated_at = now()
      where id = v_request.id;
    end if;
    raise exception using errcode = '22023', message = 'rbac_change_request_not_pending';
  end if;
  if v_request.requested_by = v_actor then
    raise exception using errcode = '42501', message = 'rbac_four_eyes_reviewer_required';
  end if;

  if p_decision = 'approve' then
    v_snapshot := v_request.proposed_snapshot;
    if v_request.change_type = 'update' and exists (
      select 1 from public.app_roles profile
      where profile.name = v_request.profile_key
        and profile.updated_at is distinct from (v_request.current_snapshot ->> 'updated_at')::timestamptz
    ) then
      raise exception using errcode = '40001', message = 'rbac_change_request_stale';
    end if;

    -- Flag local a esta transacao e definida somente depois de validar o
    -- revisor distinto e a solicitacao pendente bloqueada por FOR UPDATE.
    perform set_config('axionn.rbac_approved_request', v_request.id::text, true);

    insert into public.app_roles(
      name, label, sort_order, organization_id, description, category, color_token,
      icon_name, module_keys, is_system, is_active, created_by, created_at, updated_at
    ) values (
      v_request.profile_key, v_snapshot ->> 'display_name', 1000, p_org_id,
      v_snapshot ->> 'description', v_snapshot ->> 'category', v_snapshot ->> 'color_token',
      v_snapshot ->> 'icon_name', array(select jsonb_array_elements_text(v_snapshot -> 'module_keys')),
      false, true, v_request.requested_by, now(), now()
    ) on conflict(name) do update set
      label = excluded.label, description = excluded.description, category = excluded.category,
      color_token = excluded.color_token, icon_name = excluded.icon_name,
      module_keys = excluded.module_keys, is_active = true, updated_at = now();

    delete from public.role_permissions where role_name = v_request.profile_key;
    insert into public.role_permissions(role_name, permission_key)
    select v_request.profile_key, jsonb_array_elements_text(v_snapshot -> 'permission_keys');
    v_action := 'rbac_profile_change_approved';
  else
    v_action := 'rbac_profile_change_rejected';
  end if;

  update public.rbac_profile_change_requests set
    status = case p_decision when 'approve' then 'approved' else 'rejected' end,
    reviewed_by = v_actor, review_note = nullif(btrim(p_note), ''),
    reviewed_at = now(), updated_at = now()
  where id = v_request.id;

  insert into public.organization_membership_audit_log(org_id, actor_id, action, details)
  values (p_org_id, v_actor, v_action,
    jsonb_build_object('request_id', v_request.id, 'profile_key', v_request.profile_key,
      'display_name', v_snapshot ->> 'display_name', 'note', nullif(btrim(p_note), '')));

  return jsonb_build_object('request_id', v_request.id, 'status',
    case p_decision when 'approve' then 'approved' else 'rejected' end);
end;
$$;

-- Mudancas privilegiadas nao podem contornar o fluxo de dupla aprovacao.
create or replace function public.rbac_profile_requires_approval_v1(
  p_profile_key text,
  p_permission_keys text[]
)
returns boolean language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.rbac_privileged_permissions privileged
    where privileged.permission_key = any(coalesce(p_permission_keys, '{}'::text[]))
       or exists (select 1 from public.role_permissions current_mapping
                  where current_mapping.role_name = p_profile_key
                    and current_mapping.permission_key = privileged.permission_key)
  )
$$;

create or replace function public.block_privileged_profile_update_v1()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if old.organization_id is not null and new.is_active and exists (
    select 1 from public.role_permissions mapping
    join public.rbac_privileged_permissions privileged
      on privileged.permission_key = mapping.permission_key
    where mapping.role_name = old.name
  ) and not exists (
    select 1 from public.rbac_profile_change_requests request
    where request.id::text = current_setting('axionn.rbac_approved_request', true)
      and request.profile_key = old.name and request.status = 'pending'
  ) then
    raise exception using errcode = '42501', message = 'rbac_privileged_profile_requires_approval';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_privileged_profile_update on public.app_roles;
create trigger trg_block_privileged_profile_update
before update on public.app_roles
for each row execute function public.block_privileged_profile_update_v1();

create or replace function public.block_privileged_profile_direct_write_v1()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.app_roles role where role.name = new.role_name and role.organization_id is not null)
     and exists (select 1 from public.rbac_privileged_permissions p where p.permission_key = new.permission_key)
     and not exists (select 1 from public.rbac_profile_change_requests request
       where request.id::text = current_setting('axionn.rbac_approved_request', true)
         and request.profile_key = new.role_name and request.status = 'pending') then
    raise exception using errcode = '42501', message = 'rbac_privileged_profile_requires_approval';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_privileged_profile_direct_write on public.role_permissions;
create trigger trg_block_privileged_profile_direct_write
before insert or update on public.role_permissions
for each row execute function public.block_privileged_profile_direct_write_v1();

-- Atribuicoes temporarias: contrato estendido, validado e auditado.
drop function if exists public.get_organization_member_module_roles_v1(uuid);
create function public.get_organization_member_module_roles_v1(p_org_id uuid)
returns table(user_id uuid, module_key text, role_name text,
  expires_at timestamptz, assignment_justification text)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
     or not coalesce(public.is_organization_admin(p_org_id, auth.uid()), false) then
    raise exception using errcode = '42501', message = 'organization_member_module_roles_access_denied';
  end if;
  return query select access.user_id, access.module_key::text,
    case when access.role_name = 'qa' then 'qa_analyst' else access.role_name end::text,
    access.expires_at, access.assignment_justification
  from public.organization_member_modules access
  where access.org_id = p_org_id
  order by access.user_id, access.module_key;
end;
$$;

create or replace function public.manage_organization_member_profile_v2(
  p_org_id uuid, p_user_id uuid, p_display_name text default null,
  p_role text default null, p_is_active boolean default null,
  p_module_roles jsonb default null
)
returns boolean language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_member public.organization_members%rowtype;
  v_next_role public.org_member_role;
  v_name text;
begin
  if v_actor is null or not coalesce(public.is_organization_admin(p_org_id, v_actor), false) then
    raise exception using errcode = '42501', message = 'organization_member_update_forbidden';
  end if;
  select * into v_member from public.organization_members member
  where member.org_id = p_org_id and member.user_id = p_user_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'organization_member_not_found'; end if;
  if p_user_id = v_actor and p_is_active = false then
    raise exception using errcode = '22023', message = 'organization_member_self_deactivation_forbidden';
  end if;
  if p_role is not null and p_role not in ('admin', 'member') then
    raise exception using errcode = '22023', message = 'organization_member_invalid_role';
  end if;
  if v_member.role::text = 'owner' and ((p_role is not null and p_role <> 'owner') or p_is_active = false) then
    raise exception using errcode = '22023', message = 'organization_owner_requires_transfer';
  end if;
  v_next_role := coalesce(p_role::public.org_member_role, v_member.role);
  v_name := nullif(btrim(p_display_name), '');
  if p_display_name is not null and v_name is null then
    raise exception using errcode = '22023', message = 'organization_member_display_name_required';
  end if;
  if v_name is not null and (select count(*) from public.organization_members membership
    where membership.user_id = p_user_id and membership.is_active) > 1 then
    raise exception using errcode = '22023', message = 'organization_member_shared_profile_name_forbidden';
  end if;
  if p_module_roles is not null then
    if jsonb_typeof(p_module_roles) <> 'array' or jsonb_array_length(p_module_roles) = 0 then
      raise exception using errcode = '22023', message = 'organization_member_module_role_required';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_module_roles) item
      where nullif(btrim(item ->> 'module_key'), '') is null
         or nullif(btrim(item ->> 'role_name'), '') is null
         or not public.is_rbac_profile_available_v1(p_org_id, btrim(item ->> 'module_key'),
           case when btrim(item ->> 'role_name') = 'qa' then 'qa_analyst' else btrim(item ->> 'role_name') end)
         or ((item ? 'expires_at') and nullif(item ->> 'expires_at', '') is not null and (
           (item ->> 'expires_at')::timestamptz <= now() + interval '5 minutes'
           or (item ->> 'expires_at')::timestamptz > now() + interval '365 days'
           or length(btrim(coalesce(item ->> 'justification', ''))) not between 10 and 280
         ))
    ) then raise exception using errcode = '22023', message = 'organization_member_module_role_invalid'; end if;
    if (select count(*) <> count(distinct btrim(item ->> 'module_key'))
      from jsonb_array_elements(p_module_roles) item) then
      raise exception using errcode = '22023', message = 'organization_member_module_role_duplicate';
    end if;
  end if;

  update public.organization_members set role = v_next_role,
    is_active = coalesce(p_is_active, is_active), updated_by = v_actor
  where org_id = p_org_id and user_id = p_user_id;
  if v_name is not null then
    update public.profiles set display_name = v_name, updated_at = now() where user_id = p_user_id;
    if not found then raise exception using errcode = 'P0002', message = 'organization_member_profile_not_found'; end if;
  end if;
  if p_module_roles is not null then
    delete from public.organization_member_modules access where access.org_id = p_org_id and access.user_id = p_user_id;
    insert into public.organization_member_modules(
      org_id, user_id, module_key, role_name, assigned_by, expires_at, assignment_justification
    ) select p_org_id, p_user_id, btrim(item ->> 'module_key'),
      case when btrim(item ->> 'role_name') = 'qa' then 'qa_analyst' else btrim(item ->> 'role_name') end,
      v_actor, nullif(item ->> 'expires_at', '')::timestamptz,
      nullif(btrim(item ->> 'justification'), '')
    from jsonb_array_elements(p_module_roles) item;
  end if;
  insert into public.organization_membership_audit_log(org_id, actor_id, subject_user_id, action, details)
  values (p_org_id, v_actor, p_user_id, 'member_profile_managed', jsonb_build_object(
    'previous_role', v_member.role::text, 'role', v_next_role::text,
    'previous_active', v_member.is_active, 'is_active', coalesce(p_is_active, v_member.is_active),
    'display_name_changed', v_name is not null, 'module_roles', p_module_roles));
  return true;
end;
$$;

create or replace function public.list_rbac_governance_v1(p_org_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_organization_admin(p_org_id, auth.uid()), false) then
    raise exception using errcode = '42501', message = 'rbac_governance_access_denied';
  end if;
  with activity as (
    select event.user_id, max(event.created_at) last_activity_at,
      count(*) filter (where event.created_at >= now() - interval '90 days') events_90d
    from public.user_usage_events event where event.tenant_id = p_org_id group by event.user_id
  ), assignments as (
    select access.*, member.is_active, coalesce(profile.display_name, 'Usuario') display_name,
      coalesce(role.label, access.role_name) profile_name,
      activity.last_activity_at, coalesce(activity.events_90d, 0) events_90d
    from public.organization_member_modules access
    join public.organization_members member using(org_id, user_id)
    left join public.profiles profile on profile.user_id = access.user_id
    left join public.app_roles role on role.name = access.role_name
    left join activity on activity.user_id = access.user_id
    where access.org_id = p_org_id
  ), pending as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', request.id, 'profile_key', request.profile_key, 'change_type', request.change_type,
      'risk_level', request.risk_level, 'risk_reasons', request.risk_reasons,
      'proposed_snapshot', request.proposed_snapshot, 'requested_by', request.requested_by,
      'requester_name', coalesce(requester.display_name, 'Administrador'),
      'created_at', request.created_at, 'expires_at', request.expires_at,
      'can_review', request.requested_by <> auth.uid()
    ) order by request.created_at desc), '[]'::jsonb) value
    from public.rbac_profile_change_requests request
    left join public.profiles requester on requester.user_id = request.requested_by
    where request.org_id = p_org_id and request.status = 'pending' and request.expires_at > now()
  ), temporary as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'user_id', a.user_id, 'display_name', a.display_name, 'module_key', a.module_key,
      'profile_key', a.role_name, 'profile_name', a.profile_name,
      'expires_at', a.expires_at, 'justification', a.assignment_justification,
      'is_expired', a.expires_at <= now()
    ) order by a.expires_at), '[]'::jsonb) value
    from assignments a where a.expires_at is not null
  ), recommendations as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.user_id::text || ':' || a.module_key,
      'user_id', a.user_id, 'display_name', a.display_name, 'module_key', a.module_key,
      'profile_key', a.role_name, 'profile_name', a.profile_name,
      'severity', case when a.expires_at <= now() or not a.is_active then 'high' else 'medium' end,
      'kind', case when a.expires_at <= now() then 'expired_access'
        when not a.is_active then 'inactive_member_access' else 'low_activity' end,
      'last_activity_at', a.last_activity_at, 'events_90d', a.events_90d,
      'evidence', case when a.expires_at <= now() then 'O prazo deste acesso terminou.'
        when not a.is_active then 'O membro esta inativo, mas ainda possui atribuicao.'
        when a.last_activity_at is null then 'Nenhum evento de uso foi registrado para este membro.'
        else 'Nenhuma atividade foi registrada nos ultimos 90 dias.' end
    ) order by case when a.expires_at <= now() or not a.is_active then 0 else 1 end,
      a.display_name), '[]'::jsonb) value
    from assignments a
    where a.expires_at <= now() or not a.is_active or a.events_90d = 0
  )
  select jsonb_build_object(
    'pending_requests', pending.value,
    'temporary_assignments', temporary.value,
    'recommendations', recommendations.value,
    'generated_at', now(),
    'activity_window_days', 90
  ) into v_result from pending, temporary, recommendations;
  return v_result;
end;
$$;

-- Runtime: atribuicoes vencidas continuam auditaveis, mas deixam de autorizar acesso.
create or replace function public.get_my_organization_module_roles(p_org_id uuid)
returns table(module text, role_name text)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_organization_member(p_org_id, auth.uid()) then
    raise exception using errcode = '42501', message = 'organization_module_access_denied';
  end if;
  if public.is_platform_admin(auth.uid()) then
    return query select module_key, 'admin'::text
    from unnest(array['rdm', 'sala_agil', 'sustentacao']::text[]) module_key order by module_key;
    return;
  end if;
  return query select access.module_key, access.role_name
  from public.organization_member_modules access
  join public.organization_members member using(org_id, user_id)
  where access.org_id = p_org_id and access.user_id = auth.uid() and member.is_active
    and (access.expires_at is null or access.expires_at > now())
  order by access.module_key;
end;
$$;

create or replace function public.can_quality_permission_v1(p_org_id uuid, p_permission text)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select coalesce(public.is_platform_admin(auth.uid()), false)
  or coalesce(public.is_organization_admin(p_org_id, auth.uid()), false)
  or exists (
    select 1 from public.organization_member_modules access
    join public.organization_members member using(org_id, user_id)
    join public.role_permissions mapping on mapping.role_name = access.role_name
    where access.org_id = p_org_id and access.user_id = auth.uid()
      and access.module_key = 'sala_agil' and member.is_active
      and (access.expires_at is null or access.expires_at > now())
      and mapping.permission_key = p_permission
  )
$$;

create or replace function public.list_rbac_audit_events_v1(
  p_org_id uuid, p_limit integer default 100, p_profile_key text default null
)
returns table(audit_id uuid, action text, actor_id uuid, actor_name text,
  subject_user_id uuid, subject_name text, profile_key text, details jsonb,
  created_at timestamptz)
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not coalesce(public.is_organization_admin(p_org_id, auth.uid()), false) then
    raise exception using errcode = '42501', message = 'rbac_audit_access_denied';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 500 then
    raise exception using errcode = '22023', message = 'rbac_audit_limit_invalid';
  end if;
  return query select event.id, event.action, event.actor_id,
    coalesce(actor.display_name, 'Sistema'), event.subject_user_id,
    subject.display_name, nullif(event.details ->> 'profile_key', ''),
    event.details, event.created_at
  from public.organization_membership_audit_log event
  left join lateral (select profile.display_name from public.profiles profile
    where profile.user_id = event.actor_id order by profile.updated_at desc limit 1) actor on true
  left join lateral (select profile.display_name from public.profiles profile
    where profile.user_id = event.subject_user_id order by profile.updated_at desc limit 1) subject on true
  where event.org_id = p_org_id and event.action in (
    'rbac_profile_created','rbac_profile_updated','rbac_profile_archived',
    'member_profile_managed','rbac_profile_change_requested',
    'rbac_profile_change_approved','rbac_profile_change_rejected'
  ) and (nullif(btrim(p_profile_key), '') is null
    or event.details ->> 'profile_key' = btrim(p_profile_key)
    or exists (select 1 from jsonb_array_elements(case
      when jsonb_typeof(event.details -> 'module_roles') = 'array'
        then event.details -> 'module_roles' else '[]'::jsonb end) module_role
      where module_role ->> 'role_name' = btrim(p_profile_key)))
  order by event.created_at desc, event.id desc limit p_limit;
end;
$$;

create or replace function public.simulate_rbac_user_access_v1(p_org_id uuid, p_user_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_member public.organization_members%rowtype;
  v_display_name text;
  v_module_profiles jsonb;
begin
  if auth.uid() is null or not coalesce(public.is_organization_admin(p_org_id, auth.uid()), false) then
    raise exception using errcode = '42501', message = 'rbac_simulation_access_denied';
  end if;
  select member.* into v_member from public.organization_members member
  where member.org_id = p_org_id and member.user_id = p_user_id;
  if not found then raise exception using errcode = 'P0002', message = 'rbac_simulation_member_not_found'; end if;
  select profile.display_name into v_display_name from public.profiles profile
  where profile.user_id = p_user_id order by profile.updated_at desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object(
    'module_key', access.module_key, 'profile_key', access.role_name,
    'profile_name', coalesce(role.label, access.role_name),
    'is_profile_active', coalesce(role.is_active, false),
    'permissions', coalesce(permission_set.permissions, '[]'::jsonb),
    'permission_count', coalesce(permission_set.permission_count, 0),
    'expires_at', access.expires_at
  ) order by access.module_key), '[]'::jsonb) into v_module_profiles
  from public.organization_member_modules access
  left join public.app_roles role on role.name = access.role_name
    and (role.organization_id is null or role.organization_id = p_org_id)
  left join lateral (select jsonb_agg(jsonb_build_object(
      'permission_key', permission.key, 'label', permission.label,
      'description', permission.description, 'group_key', permission.group_key
    ) order by permission.group_key, permission.label) permissions,
    count(permission.key)::integer permission_count
    from public.role_permissions mapping join public.app_permissions permission
      on permission.key = mapping.permission_key
    where mapping.role_name = access.role_name
      and public.rbac_permission_module_v1(permission.group_key) = access.module_key
  ) permission_set on true
  where access.org_id = p_org_id and access.user_id = p_user_id
    and (access.expires_at is null or access.expires_at > now());
  return jsonb_build_object('user_id', p_user_id,
    'display_name', coalesce(v_display_name, 'Usuario'),
    'membership_role', v_member.role::text, 'is_active', v_member.is_active,
    'has_administrative_bypass', coalesce(public.is_organization_admin(p_org_id, p_user_id), false),
    'module_profiles', v_module_profiles, 'permission_count', coalesce((
      select sum((item ->> 'permission_count')::integer)
      from jsonb_array_elements(v_module_profiles) item), 0));
end;
$$;

revoke all on function public.list_rbac_privileged_permissions_v1(uuid) from public, anon;
revoke all on function public.submit_rbac_profile_change_v1(uuid,text,text,text,text,text,text,text[],text[]) from public, anon;
revoke all on function public.review_rbac_profile_change_v1(uuid,uuid,text,text) from public, anon;
revoke all on function public.list_rbac_governance_v1(uuid) from public, anon;
revoke all on function public.get_organization_member_module_roles_v1(uuid) from public, anon;
revoke all on function public.manage_organization_member_profile_v2(uuid,uuid,text,text,boolean,jsonb) from public, anon;
revoke all on function public.list_rbac_audit_events_v1(uuid,integer,text) from public, anon;
revoke all on function public.simulate_rbac_user_access_v1(uuid,uuid) from public, anon;

grant execute on function public.list_rbac_privileged_permissions_v1(uuid) to authenticated, service_role;
grant execute on function public.submit_rbac_profile_change_v1(uuid,text,text,text,text,text,text,text[],text[]) to authenticated, service_role;
grant execute on function public.review_rbac_profile_change_v1(uuid,uuid,text,text) to authenticated, service_role;
grant execute on function public.list_rbac_governance_v1(uuid) to authenticated, service_role;
grant execute on function public.get_organization_member_module_roles_v1(uuid) to authenticated, service_role;
grant execute on function public.manage_organization_member_profile_v2(uuid,uuid,text,text,boolean,jsonb) to authenticated, service_role;
grant execute on function public.list_rbac_audit_events_v1(uuid,integer,text) to authenticated, service_role;
grant execute on function public.simulate_rbac_user_access_v1(uuid,uuid) to authenticated, service_role;

comment on function public.list_rbac_governance_v1(uuid) is
  'Central tenant-scoped de aprovacoes, acessos temporarios e sinais de menor privilegio.';
comment on column public.organization_member_modules.expires_at is
  'Fim opcional do acesso; verificadores de runtime ignoram vinculos expirados.';

notify pgrst, 'reload schema';
commit;
