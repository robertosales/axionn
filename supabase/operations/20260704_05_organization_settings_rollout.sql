-- Axion SaaS — Fase 2A / Lote 5
-- Executar manualmente no SQL Editor do Lovable Cloud.

begin;

select pg_advisory_xact_lock(
  hashtext('axionn:20260704:05_organization_settings_rollout')
);

do $$
declare
  v_missing text;
begin
  select string_agg(object_name, ', ' order by object_name)
  into v_missing
  from (
    values
      ('public.organizations', to_regclass('public.organizations') is not null),
      ('public.organization_members', to_regclass('public.organization_members') is not null),
      ('public.is_organization_admin(uuid,uuid)', to_regprocedure('public.is_organization_admin(uuid,uuid)') is not null),
      ('public.profiles', to_regclass('public.profiles') is not null)
  ) dependency(object_name, present)
  where not present;

  if v_missing is not null then
    raise exception 'Dependências ausentes para o Lote 5: %', v_missing;
  end if;
end;
$$;

create table if not exists public.organization_settings_audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid,
  action text not null default 'settings_updated',
  changed_fields text[] not null default '{}'::text[],
  before_values jsonb not null default '{}'::jsonb,
  after_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_organization_settings_audit_org_created
  on public.organization_settings_audit_log(org_id, created_at desc);

alter table public.organization_settings_audit_log enable row level security;
revoke all on public.organization_settings_audit_log
  from public, anon, authenticated;
grant select, insert on public.organization_settings_audit_log to service_role;

create or replace function public.get_organization_settings_v2(
  p_org_id uuid
)
returns table (
  organization_id uuid,
  name text,
  slug text,
  logo_url text,
  contact_name text,
  contact_email text,
  status text,
  plan text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
     or not public.is_organization_admin(p_org_id, auth.uid()) then
    raise exception using
      errcode = '42501',
      message = 'organization_settings_access_denied';
  end if;

  return query
  select
    organization.id,
    organization.name,
    organization.slug,
    organization.logo_url,
    organization.contact_name,
    organization.contact_email,
    organization.status::text,
    organization.plan::text,
    organization.updated_at
  from public.organizations organization
  where organization.id = p_org_id;
end;
$$;

create or replace function public.update_organization_settings_v2(
  p_org_id uuid,
  p_name text,
  p_contact_name text default null,
  p_contact_email text default null,
  p_logo_url text default null
)
returns table (
  organization_id uuid,
  name text,
  slug text,
  logo_url text,
  contact_name text,
  contact_email text,
  status text,
  plan text,
  updated_at timestamptz,
  changed_fields text[]
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := auth.uid();
  v_current public.organizations%rowtype;
  v_updated public.organizations%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_contact_name text := nullif(btrim(coalesce(p_contact_name, '')), '');
  v_contact_email text := nullif(lower(btrim(coalesce(p_contact_email, ''))), '');
  v_logo_url text := nullif(btrim(coalesce(p_logo_url, '')), '');
  v_changed_fields text[];
  v_before jsonb;
  v_after jsonb;
begin
  if v_actor_id is null
     or not public.is_organization_admin(p_org_id, v_actor_id) then
    raise exception using
      errcode = '42501',
      message = 'organization_settings_update_denied';
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception using errcode = '22023', message = 'organization_settings_invalid_name';
  end if;

  if v_contact_name is not null and char_length(v_contact_name) > 120 then
    raise exception using errcode = '22023', message = 'organization_settings_invalid_contact_name';
  end if;

  if v_contact_email is not null
     and v_contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'organization_settings_invalid_contact_email';
  end if;

  if v_logo_url is not null
     and v_logo_url !~* '^https://[^[:space:]]+$' then
    raise exception using errcode = '22023', message = 'organization_settings_invalid_logo_url';
  end if;

  select * into v_current
  from public.organizations organization
  where organization.id = p_org_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'organization_not_found';
  end if;

  v_changed_fields := array_remove(array[
    case when v_current.name is distinct from v_name then 'name' end,
    case when v_current.contact_name is distinct from v_contact_name then 'contact_name' end,
    case when v_current.contact_email is distinct from v_contact_email then 'contact_email' end,
    case when v_current.logo_url is distinct from v_logo_url then 'logo_url' end
  ]::text[], null);

  if coalesce(array_length(v_changed_fields, 1), 0) = 0 then
    return query
    select
      v_current.id,
      v_current.name,
      v_current.slug,
      v_current.logo_url,
      v_current.contact_name,
      v_current.contact_email,
      v_current.status::text,
      v_current.plan::text,
      v_current.updated_at,
      '{}'::text[];
    return;
  end if;

  v_before := jsonb_build_object(
    'name', v_current.name,
    'contact_name', v_current.contact_name,
    'contact_email', v_current.contact_email,
    'logo_url', v_current.logo_url
  );

  update public.organizations organization
  set name = v_name,
      contact_name = v_contact_name,
      contact_email = v_contact_email,
      logo_url = v_logo_url,
      updated_at = now()
  where organization.id = p_org_id
  returning * into v_updated;

  v_after := jsonb_build_object(
    'name', v_updated.name,
    'contact_name', v_updated.contact_name,
    'contact_email', v_updated.contact_email,
    'logo_url', v_updated.logo_url
  );

  insert into public.organization_settings_audit_log (
    org_id, actor_id, action, changed_fields, before_values, after_values
  )
  values (
    p_org_id, v_actor_id, 'settings_updated', v_changed_fields, v_before, v_after
  );

  return query
  select
    v_updated.id,
    v_updated.name,
    v_updated.slug,
    v_updated.logo_url,
    v_updated.contact_name,
    v_updated.contact_email,
    v_updated.status::text,
    v_updated.plan::text,
    v_updated.updated_at,
    v_changed_fields;
end;
$$;

create or replace function public.get_organization_settings_audit_v2(
  p_org_id uuid,
  p_limit integer default 50
)
returns table (
  audit_id uuid,
  actor_id uuid,
  actor_name text,
  actor_email text,
  action text,
  changed_fields text[],
  before_values jsonb,
  after_values jsonb,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
     or not public.is_organization_admin(p_org_id, auth.uid()) then
    raise exception using
      errcode = '42501',
      message = 'organization_settings_audit_access_denied';
  end if;

  return query
  select
    audit.id,
    audit.actor_id,
    coalesce(nullif(profile.display_name, ''), user_account.email, 'Usuário'),
    coalesce(profile.email, user_account.email, ''),
    audit.action,
    audit.changed_fields,
    audit.before_values,
    audit.after_values,
    audit.created_at
  from public.organization_settings_audit_log audit
  left join public.profiles profile on profile.user_id = audit.actor_id
  left join auth.users user_account on user_account.id = audit.actor_id
  where audit.org_id = p_org_id
  order by audit.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

revoke all on function public.get_organization_settings_v2(uuid)
  from public, anon;
revoke all on function public.update_organization_settings_v2(uuid,text,text,text,text)
  from public, anon;
revoke all on function public.get_organization_settings_audit_v2(uuid,integer)
  from public, anon;

grant execute on function public.get_organization_settings_v2(uuid)
  to authenticated, service_role;
grant execute on function public.update_organization_settings_v2(uuid,text,text,text,text)
  to authenticated, service_role;
grant execute on function public.get_organization_settings_audit_v2(uuid,integer)
  to authenticated, service_role;

do $$
begin
  if to_regclass('public.organization_settings_audit_log') is null then
    raise exception 'Post-validation failed: tabela de auditoria ausente';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_organization_settings_v2(uuid)',
    'EXECUTE'
  ) then
    raise exception 'Post-validation failed: leitura de configurações indisponível';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.update_organization_settings_v2(uuid,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'Post-validation failed: atualização de configurações indisponível';
  end if;

  if has_function_privilege(
    'anon',
    'public.update_organization_settings_v2(uuid,text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'Post-validation failed: anon pode atualizar configurações';
  end if;
end;
$$;

commit;

select
  to_regclass('public.organization_settings_audit_log') is not null
    as audit_table_ready,
  has_function_privilege(
    'authenticated',
    'public.get_organization_settings_v2(uuid)',
    'EXECUTE'
  ) as settings_read_ready,
  has_function_privilege(
    'authenticated',
    'public.update_organization_settings_v2(uuid,text,text,text,text)',
    'EXECUTE'
  ) as settings_update_ready,
  not has_function_privilege(
    'anon',
    'public.update_organization_settings_v2(uuid,text,text,text,text)',
    'EXECUTE'
  ) as anonymous_update_revoked,
  (
    to_regclass('public.organization_settings_audit_log') is not null
    and has_function_privilege(
      'authenticated',
      'public.get_organization_settings_v2(uuid)',
      'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'public.update_organization_settings_v2(uuid,text,text,text,text)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.update_organization_settings_v2(uuid,text,text,text,text)',
      'EXECUTE'
    )
  ) as organization_settings_rollout_ok;
