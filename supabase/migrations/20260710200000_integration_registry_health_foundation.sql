-- Axionn — Fase 3: registry e health comuns para integracoes.
-- Migration aditiva: nao altera configuracoes, credenciais ou eventos existentes.

begin;

do $$
declare
  required_table text;
begin
  foreach required_table in array array[
    'organizations',
    'organization_members',
    'git_integrations',
    'teams_integrations',
    'redmine_integrations',
    'oracle_integrations',
    'apex_integrations'
  ] loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'integration_registry_missing_prerequisite: public.%', required_table;
    end if;
  end loop;

  if to_regprocedure('public.is_platform_admin(uuid)') is null then
    raise exception 'integration_registry_missing_prerequisite: public.is_platform_admin(uuid)';
  end if;
end;
$$;

create table if not exists public.integration_health_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  provider text not null check (provider in ('git', 'teams', 'redmine', 'oracle', 'apex')),
  integration_id uuid not null,
  check_type text not null default 'connection'
    check (check_type in ('connection', 'authentication', 'webhook', 'sync', 'dependency')),
  status text not null check (status in ('healthy', 'degraded', 'unhealthy', 'unknown')),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  error_code text,
  error_message text,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now(),
  correlation_id text,
  created_at timestamptz not null default now()
);

comment on table public.integration_health_events is
  'Historico append-only de health checks normalizados. As tabelas especificas continuam como fonte de configuracao.';
comment on column public.integration_health_events.integration_id is
  'ID logico da tabela especifica indicada por provider; validado pelo produtor do evento.';
comment on column public.integration_health_events.details is
  'Metadados operacionais sem segredos, tokens, senhas ou payloads sensiveis.';

create index if not exists idx_integration_health_org_checked
  on public.integration_health_events (organization_id, checked_at desc);
create index if not exists idx_integration_health_lookup
  on public.integration_health_events (provider, integration_id, checked_at desc);
create index if not exists idx_integration_health_unhealthy
  on public.integration_health_events (organization_id, status, checked_at desc)
  where status in ('degraded', 'unhealthy');

alter table public.integration_health_events enable row level security;

drop policy if exists integration_health_select_org_admin
  on public.integration_health_events;
create policy integration_health_select_org_admin
  on public.integration_health_events
  for select
  to authenticated
  using (
    public.is_platform_admin(auth.uid())
    or exists (
      select 1
      from public.organization_members membership
      where membership.org_id = integration_health_events.organization_id
        and membership.user_id = auth.uid()
        and membership.is_active
        and membership.role::text in ('owner', 'admin')
    )
  );

-- Health events sao produzidos pelo backend. Clientes autenticados nao escrevem.
revoke all on table public.integration_health_events from public, anon, authenticated;
grant select on table public.integration_health_events to authenticated;
grant select, insert, update, delete on table public.integration_health_events to service_role;

create or replace function public.get_integration_registry(
  p_org_id uuid
)
returns table (
  provider text,
  integration_id uuid,
  project_id uuid,
  name text,
  is_active boolean,
  operational_status text,
  last_activity_at timestamptz,
  last_health_status text,
  last_health_at timestamptz,
  last_health_latency_ms integer,
  last_error text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'integration_registry_authentication_required';
  end if;

  if not public.is_platform_admin(auth.uid())
     and not exists (
       select 1
       from public.organization_members membership
       where membership.org_id = p_org_id
         and membership.user_id = auth.uid()
         and membership.is_active
         and membership.role::text in ('owner', 'admin')
     ) then
    raise exception using errcode = '42501', message = 'integration_registry_access_denied';
  end if;

  return query
  with registry as (
    select
      'git'::text as provider,
      integration.id as integration_id,
      integration.project_id,
      integration.name,
      coalesce(integration.is_active, false) as is_active,
      case
        when not coalesce(integration.is_active, false) then 'inactive'
        when integration.sync_status = 'error' then 'error'
        when integration.sync_status = 'completed' then 'healthy'
        else coalesce(integration.sync_status, 'pending')
      end::text as operational_status,
      integration.last_sync_at as last_activity_at,
      integration.sync_error as source_error
    from public.git_integrations integration
    where integration.organization_id = p_org_id

    union all

    select 'teams', integration.id, integration.project_id, integration.name,
      coalesce(integration.is_active, false),
      case
        when not coalesce(integration.is_active, false) then 'inactive'
        when integration.last_activity_at is not null then 'healthy'
        else 'pending'
      end,
      integration.last_activity_at,
      null::text
    from public.teams_integrations integration
    where integration.organization_id = p_org_id

    union all

    select 'redmine', integration.id, integration.project_id, integration.name,
      coalesce(integration.is_active, false),
      case
        when not coalesce(integration.is_active, false) then 'inactive'
        when integration.last_sync_status = 'failed' then 'error'
        when integration.last_sync_status = 'partial' then 'degraded'
        when integration.last_sync_status = 'success' then 'healthy'
        else 'pending'
      end,
      integration.last_sync_at,
      integration.last_sync_error
    from public.redmine_integrations integration
    where integration.organization_id = p_org_id

    union all

    select 'oracle', integration.id, integration.project_id, integration.name,
      coalesce(integration.is_active, false),
      case
        when not coalesce(integration.is_active, false) then 'inactive'
        when integration.connection_test_status = 'failed' then 'error'
        when integration.connection_test_status = 'success' then 'healthy'
        else 'pending'
      end,
      integration.last_connection_test,
      integration.connection_test_error
    from public.oracle_integrations integration
    where integration.organization_id = p_org_id

    union all

    select 'apex', integration.id, integration.project_id, integration.name,
      coalesce(integration.is_active, false),
      case
        when not coalesce(integration.is_active, false) then 'inactive'
        when integration.connection_test_status = 'failed' then 'error'
        when integration.connection_test_status = 'success' then 'healthy'
        else 'pending'
      end,
      integration.last_connection_test,
      null::text
    from public.apex_integrations integration
    where integration.organization_id = p_org_id
  )
  select
    registry.provider,
    registry.integration_id,
    registry.project_id,
    registry.name,
    registry.is_active,
    registry.operational_status,
    registry.last_activity_at,
    health.status as last_health_status,
    health.checked_at as last_health_at,
    health.latency_ms as last_health_latency_ms,
    coalesce(health.error_message, registry.source_error) as last_error
  from registry
  left join lateral (
    select event.status, event.checked_at, event.latency_ms, event.error_message
    from public.integration_health_events event
    where event.provider = registry.provider
      and event.integration_id = registry.integration_id
      and event.organization_id = p_org_id
    order by event.checked_at desc
    limit 1
  ) health on true
  order by registry.provider, registry.name, registry.integration_id;
end;
$$;

revoke all on function public.get_integration_registry(uuid)
  from public, anon;
grant execute on function public.get_integration_registry(uuid)
  to authenticated, service_role;

comment on function public.get_integration_registry(uuid) is
  'Catalogo seguro e normalizado das integracoes de uma organizacao, sem retornar credenciais.';

commit;

-- Pos-validacao (deve retornar true):
select
  to_regclass('public.integration_health_events') is not null
  and to_regprocedure('public.get_integration_registry(uuid)') is not null
  and has_function_privilege('authenticated', 'public.get_integration_registry(uuid)', 'EXECUTE')
  and not has_table_privilege('authenticated', 'public.integration_health_events', 'INSERT')
    as integration_registry_health_foundation_ok;
