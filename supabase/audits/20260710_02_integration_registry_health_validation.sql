-- Axionn — Fase 3: validacao somente leitura apos a migration do registry.

select
  to_regclass('public.integration_health_events') is not null as health_table_exists,
  to_regprocedure('public.get_integration_registry(uuid)') is not null as registry_rpc_exists,
  has_function_privilege('authenticated', 'public.get_integration_registry(uuid)', 'EXECUTE') as authenticated_can_read_registry,
  not has_table_privilege('authenticated', 'public.integration_health_events', 'INSERT') as authenticated_cannot_write_health,
  has_table_privilege('service_role', 'public.integration_health_events', 'INSERT') as service_can_write_health,
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.integration_health_events'::regclass
  ) as health_rls_enabled;

select provider, count(*) as integrations
from (
  select 'git'::text provider from public.git_integrations
  union all select 'teams' from public.teams_integrations
  union all select 'redmine' from public.redmine_integrations
  union all select 'oracle' from public.oracle_integrations
  union all select 'apex' from public.apex_integrations
) inventory
group by provider
order by provider;
