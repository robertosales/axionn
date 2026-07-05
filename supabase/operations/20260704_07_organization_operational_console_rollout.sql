-- Axion SaaS - Fase 2B / Lote 8
-- Rollout base do console operacional tenant-scoped.
-- Nao ativa o console e nao desliga o fallback legado.

begin;

select pg_advisory_xact_lock(
  hashtext('axionn:20260704:07_organization_operational_console_rollout')
);

do $$
declare
  v_missing text;
  v_tenancy_enforced_before boolean;
begin
  select public.is_tenancy_enforced() into v_tenancy_enforced_before;
  perform set_config(
    'axionn.lote7.tenancy_enforced_before',
    v_tenancy_enforced_before::text,
    false
  );

  select string_agg(object_name, ', ' order by object_name)
  into v_missing
  from (
    values
      ('public.saas_runtime_settings', to_regclass('public.saas_runtime_settings') is not null),
      ('public.organizations', to_regclass('public.organizations') is not null),
      ('public.companies', to_regclass('public.companies') is not null),
      ('public.contracts', to_regclass('public.contracts') is not null),
      ('public.projects', to_regclass('public.projects') is not null),
      ('public.teams', to_regclass('public.teams') is not null),
      ('public.organization_members', to_regclass('public.organization_members') is not null),
      ('public.organization_member_modules', to_regclass('public.organization_member_modules') is not null),
      ('public.platform_user_roles', to_regclass('public.platform_user_roles') is not null),
      ('public.is_tenancy_enforced()', to_regprocedure('public.is_tenancy_enforced()') is not null),
      ('public.is_platform_admin(uuid)', to_regprocedure('public.is_platform_admin(uuid)') is not null),
      ('public.is_organization_admin(uuid,uuid)', to_regprocedure('public.is_organization_admin(uuid,uuid)') is not null)
  ) dependency(object_name, present)
  where not present;

  if v_missing is not null then
    raise exception 'Dependencias ausentes para o rollout do console operacional: %', v_missing;
  end if;
end;
$$;

insert into public.saas_runtime_settings (key, value)
values
  ('organization_operational_console_enabled', jsonb_build_object('enabled', false)),
  ('legacy_operational_admin_fallback_enabled', jsonb_build_object('enabled', true))
on conflict (key) do nothing;

create table if not exists public.organization_operational_audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  changed_fields text[] not null default '{}'::text[],
  before_values jsonb not null default '{}'::jsonb,
  after_values jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_organization_operational_audit_org_created
  on public.organization_operational_audit_log(org_id, created_at desc);

alter table public.organization_operational_audit_log enable row level security;
revoke all on public.organization_operational_audit_log
  from public, anon, authenticated;
grant select, insert on public.organization_operational_audit_log to service_role;

create or replace function public.is_organization_operational_console_enabled()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select lower(setting.value ->> 'enabled') = 'true'
      from public.saas_runtime_settings setting
      where setting.key = 'organization_operational_console_enabled'
    ),
    false
  );
$$;

create or replace function public.is_legacy_operational_admin_fallback_enabled()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select lower(setting.value ->> 'enabled') = 'true'
      from public.saas_runtime_settings setting
      where setting.key = 'legacy_operational_admin_fallback_enabled'
    ),
    true
  );
$$;

create or replace function public.set_organization_operational_console(
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not coalesce(public.is_platform_admin(), false)
     and not (
       auth.uid() is null
       and nullif(current_setting('request.jwt.claim.role', true), '') is null
       and session_user in ('postgres', 'supabase_admin')
     ) then
    raise exception using
      errcode = '42501',
      message = 'organization_operational_console_toggle_denied';
  end if;

  insert into public.saas_runtime_settings (key, value, updated_at, updated_by)
  values (
    'organization_operational_console_enabled',
    jsonb_build_object('enabled', p_enabled),
    now(),
    auth.uid()
  )
  on conflict (key) do update
    set value = excluded.value,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
end;
$$;

create or replace function public.set_legacy_operational_admin_fallback(
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not coalesce(public.is_platform_admin(), false)
     and not (
       auth.uid() is null
       and nullif(current_setting('request.jwt.claim.role', true), '') is null
       and session_user in ('postgres', 'supabase_admin')
     ) then
    raise exception using
      errcode = '42501',
      message = 'legacy_operational_admin_fallback_toggle_denied';
  end if;

  insert into public.saas_runtime_settings (key, value, updated_at, updated_by)
  values (
    'legacy_operational_admin_fallback_enabled',
    jsonb_build_object('enabled', p_enabled),
    now(),
    auth.uid()
  )
  on conflict (key) do update
    set value = excluded.value,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.is_organization_operational_console_enabled()
  from public, anon;
revoke all on function public.is_legacy_operational_admin_fallback_enabled()
  from public, anon;
revoke all on function public.set_organization_operational_console(boolean)
  from public, anon;
revoke all on function public.set_legacy_operational_admin_fallback(boolean)
  from public, anon;

grant execute on function public.is_organization_operational_console_enabled()
  to authenticated, service_role;
grant execute on function public.is_legacy_operational_admin_fallback_enabled()
  to authenticated, service_role;
grant execute on function public.set_organization_operational_console(boolean)
  to authenticated, service_role;
grant execute on function public.set_legacy_operational_admin_fallback(boolean)
  to authenticated, service_role;

create or replace function public.assert_organization_operational_admin(
  p_org_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_org_id is null then
    raise exception using
      errcode = '42501',
      message = 'organization_context_required';
  end if;

  if not exists (
    select 1
    from public.organizations organization
    where organization.id = p_org_id
      and organization.status in ('active', 'trial')
  ) then
    raise exception using
      errcode = '42501',
      message = 'organization_not_operational';
  end if;

  if coalesce(public.is_platform_admin(), false) then
    return;
  end if;

  if not coalesce(public.is_organization_admin(p_org_id, auth.uid()), false) then
    raise exception using
      errcode = '42501',
      message = 'organization_access_denied';
  end if;
end;
$$;

create or replace function public.log_organization_operational_event(
  p_org_id uuid,
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_changed_fields text[] default '{}'::text[],
  p_before_values jsonb default '{}'::jsonb,
  p_after_values jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.organization_operational_audit_log (
    org_id,
    actor_id,
    action,
    resource_type,
    resource_id,
    changed_fields,
    before_values,
    after_values,
    metadata
  )
  values (
    p_org_id,
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    coalesce(p_changed_fields, '{}'::text[]),
    coalesce(p_before_values, '{}'::jsonb),
    coalesce(p_after_values, '{}'::jsonb),
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.create_organization_company_v2(
  p_org_id uuid,
  p_name text,
  p_cnpj text default null,
  p_email text default null,
  p_phone text default null,
  p_logo_url text default null,
  p_status text default 'active'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company public.companies%rowtype;
  v_cnpj text := nullif(regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g'), '');
begin
  perform public.assert_organization_operational_admin(p_org_id);

  if nullif(btrim(p_name), '') is null then
    raise exception using errcode = '23514', message = 'company_name_required';
  end if;

  if v_cnpj is not null and length(v_cnpj) <> 14 then
    raise exception using errcode = '23514', message = 'company_cnpj_invalid';
  end if;

  if v_cnpj is not null and exists (
    select 1
    from public.companies company
    where company.org_id = p_org_id
      and regexp_replace(coalesce(company.cnpj, ''), '\D', '', 'g') = v_cnpj
  ) then
    raise exception using errcode = '23505', message = 'company_cnpj_duplicate_in_organization';
  end if;

  insert into public.companies (
    org_id,
    name,
    cnpj,
    email,
    phone,
    logo_url,
    status
  )
  values (
    p_org_id,
    btrim(p_name),
    v_cnpj,
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_logo_url, '')), ''),
    coalesce(nullif(btrim(p_status), ''), 'active')
  )
  returning * into v_company;

  perform public.log_organization_operational_event(
    p_org_id,
    'company_created',
    'company',
    v_company.id,
    array['name', 'cnpj', 'email', 'phone', 'logo_url', 'status'],
    '{}'::jsonb,
    to_jsonb(v_company),
    jsonb_build_object('cnpj_unique_scope', 'organization')
  );

  return v_company.id;
end;
$$;

create or replace function public.update_organization_company_v2(
  p_org_id uuid,
  p_company_id uuid,
  p_name text,
  p_cnpj text default null,
  p_email text default null,
  p_phone text default null,
  p_logo_url text default null,
  p_status text default 'active'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.companies%rowtype;
  v_after public.companies%rowtype;
  v_cnpj text := nullif(regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g'), '');
begin
  perform public.assert_organization_operational_admin(p_org_id);

  select *
  into v_before
  from public.companies company
  where company.id = p_company_id
    and company.org_id = p_org_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  if nullif(btrim(p_name), '') is null then
    raise exception using errcode = '23514', message = 'company_name_required';
  end if;

  if v_cnpj is not null and length(v_cnpj) <> 14 then
    raise exception using errcode = '23514', message = 'company_cnpj_invalid';
  end if;

  if v_cnpj is not null and exists (
    select 1
    from public.companies company
    where company.org_id = p_org_id
      and company.id <> p_company_id
      and regexp_replace(coalesce(company.cnpj, ''), '\D', '', 'g') = v_cnpj
  ) then
    raise exception using errcode = '23505', message = 'company_cnpj_duplicate_in_organization';
  end if;

  update public.companies
  set name = btrim(p_name),
      cnpj = v_cnpj,
      email = nullif(btrim(coalesce(p_email, '')), ''),
      phone = nullif(btrim(coalesce(p_phone, '')), ''),
      logo_url = nullif(btrim(coalesce(p_logo_url, '')), ''),
      status = coalesce(nullif(btrim(p_status), ''), 'active')
  where id = p_company_id
    and org_id = p_org_id
  returning * into v_after;

  perform public.log_organization_operational_event(
    p_org_id,
    'company_updated',
    'company',
    p_company_id,
    array['name', 'cnpj', 'email', 'phone', 'logo_url', 'status'],
    to_jsonb(v_before),
    to_jsonb(v_after)
  );

  return p_company_id;
end;
$$;

create or replace function public.archive_organization_company_v2(
  p_org_id uuid,
  p_company_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.companies%rowtype;
  v_after public.companies%rowtype;
begin
  perform public.assert_organization_operational_admin(p_org_id);

  select *
  into v_before
  from public.companies company
  where company.id = p_company_id
    and company.org_id = p_org_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  update public.companies
  set status = 'inactive'
  where id = p_company_id
    and org_id = p_org_id
  returning * into v_after;

  perform public.log_organization_operational_event(
    p_org_id,
    'company_archived',
    'company',
    p_company_id,
    array['status'],
    to_jsonb(v_before),
    to_jsonb(v_after)
  );
end;
$$;

create or replace function public.create_organization_contract_v2(
  p_org_id uuid,
  p_name text,
  p_company_id uuid default null,
  p_status text default 'active',
  p_starts_at date default null,
  p_ends_at date default null,
  p_number text default null,
  p_object text default null,
  p_value_per_pfus numeric default null,
  p_currency text default 'BRL'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contract public.contracts%rowtype;
begin
  perform public.assert_organization_operational_admin(p_org_id);

  if nullif(btrim(p_name), '') is null then
    raise exception using errcode = '23514', message = 'contract_name_required';
  end if;

  if p_company_id is not null and not exists (
    select 1 from public.companies company
    where company.id = p_company_id
      and company.org_id = p_org_id
  ) then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  insert into public.contracts (
    org_id,
    name,
    company_id,
    status,
    starts_at,
    ends_at,
    number,
    object,
    value_per_pfus,
    currency,
    created_by
  )
  values (
    p_org_id,
    btrim(p_name),
    p_company_id,
    coalesce(nullif(btrim(p_status), ''), 'active'),
    p_starts_at,
    p_ends_at,
    nullif(btrim(coalesce(p_number, '')), ''),
    nullif(btrim(coalesce(p_object, '')), ''),
    p_value_per_pfus,
    coalesce(nullif(btrim(p_currency), ''), 'BRL'),
    auth.uid()
  )
  returning * into v_contract;

  perform public.log_organization_operational_event(
    p_org_id,
    'contract_created',
    'contract',
    v_contract.id,
    array['name', 'company_id', 'status', 'starts_at', 'ends_at', 'number', 'object', 'value_per_pfus', 'currency'],
    '{}'::jsonb,
    to_jsonb(v_contract)
  );

  return v_contract.id;
end;
$$;

create or replace function public.archive_organization_contract_v2(
  p_org_id uuid,
  p_contract_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.contracts%rowtype;
  v_after public.contracts%rowtype;
begin
  perform public.assert_organization_operational_admin(p_org_id);

  select *
  into v_before
  from public.contracts contract
  where contract.id = p_contract_id
    and contract.org_id = p_org_id
  for update;

  if not found then
    raise exception using errcode = '42501', message = 'resource_cross_tenant';
  end if;

  update public.contracts
  set status = 'archived'
  where id = p_contract_id
    and org_id = p_org_id
  returning * into v_after;

  perform public.log_organization_operational_event(
    p_org_id,
    'contract_archived',
    'contract',
    p_contract_id,
    array['status'],
    to_jsonb(v_before),
    to_jsonb(v_after)
  );
end;
$$;

revoke all on function public.assert_organization_operational_admin(uuid)
  from public, anon;
revoke all on function public.log_organization_operational_event(uuid, text, text, uuid, text[], jsonb, jsonb, jsonb)
  from public, anon;
revoke all on function public.create_organization_company_v2(uuid, text, text, text, text, text, text)
  from public, anon;
revoke all on function public.update_organization_company_v2(uuid, uuid, text, text, text, text, text, text)
  from public, anon;
revoke all on function public.archive_organization_company_v2(uuid, uuid)
  from public, anon;
revoke all on function public.create_organization_contract_v2(uuid, text, uuid, text, date, date, text, text, numeric, text)
  from public, anon;
revoke all on function public.archive_organization_contract_v2(uuid, uuid)
  from public, anon;

grant execute on function public.create_organization_company_v2(uuid, text, text, text, text, text, text)
  to authenticated, service_role;
grant execute on function public.update_organization_company_v2(uuid, uuid, text, text, text, text, text, text)
  to authenticated, service_role;
grant execute on function public.archive_organization_company_v2(uuid, uuid)
  to authenticated, service_role;
grant execute on function public.create_organization_contract_v2(uuid, text, uuid, text, date, date, text, text, numeric, text)
  to authenticated, service_role;
grant execute on function public.archive_organization_contract_v2(uuid, uuid)
  to authenticated, service_role;

do $$
begin
  if public.is_organization_operational_console_enabled() then
    raise exception 'Post-validation failed: console operacional foi ativado pelo rollout';
  end if;

  if not public.is_legacy_operational_admin_fallback_enabled() then
    raise exception 'Post-validation failed: fallback operacional foi desligado pelo rollout';
  end if;

  if public.is_tenancy_enforced()::text is distinct from
     current_setting('axionn.lote7.tenancy_enforced_before', true) then
    raise exception 'Post-validation failed: tenancy_enforcement foi alterado';
  end if;
end;
$$;

commit;

select
  public.is_organization_operational_console_enabled() = false as console_still_disabled,
  public.is_legacy_operational_admin_fallback_enabled() = true as legacy_fallback_still_enabled,
  to_regclass('public.organization_operational_audit_log') is not null as audit_log_ready,
  public.is_tenancy_enforced()::text =
    current_setting('axionn.lote7.tenancy_enforced_before', true) as tenancy_enforcement_unchanged,
  (
    public.is_organization_operational_console_enabled() = false
    and public.is_legacy_operational_admin_fallback_enabled() = true
    and to_regclass('public.organization_operational_audit_log') is not null
    and public.is_tenancy_enforced()::text =
      current_setting('axionn.lote7.tenancy_enforced_before', true)
  ) as organization_operational_console_rollout_ok;
