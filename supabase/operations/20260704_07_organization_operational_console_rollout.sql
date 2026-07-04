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
