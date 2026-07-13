-- Axionn — Fase 4C: preflight de seguranca de provedores de identidade.
-- SOMENTE LEITURA. Execute antes da migration de hardening.

select
  to_regclass('public.identity_providers') is not null as identity_providers_exists,
  to_regclass('public.keycloak_user_mappings') is not null as keycloak_mappings_exists,
  to_regclass('public.auth_audit_events') is not null as auth_audit_exists,
  to_regprocedure('public.get_default_identity_provider(uuid)') is not null as legacy_provider_rpc_exists,
  to_regprocedure('public.sync_keycloak_user(uuid,text,text,text,text,uuid)') is not null as legacy_sync_rpc_exists;

select
  count(*) as total_providers,
  count(*) filter (where is_active) as active_providers,
  count(*) filter (where is_active and is_default) as active_default_providers,
  count(*) filter (
    where is_active
      and (
        nullif(trim(issuer_url), '') is null
        or nullif(trim(client_id), '') is null
      )
  ) as active_providers_missing_required_config,
  count(*) filter (
    where provider_type = 'keycloak'
      and is_active
  ) as active_keycloak_providers
from public.identity_providers;

select organization_id, count(*) as active_default_count
from public.identity_providers
where is_active and is_default
group by organization_id
having count(*) > 1
order by organization_id;

select
  count(*) filter (where mapping.id is null) as active_providers_without_mapping,
  count(*) filter (where mapping.sync_status = 'error') as mappings_with_error,
  count(*) filter (where mapping.sync_status = 'pending') as mappings_pending
from public.identity_providers provider
left join public.keycloak_user_mappings mapping
  on mapping.identity_provider_id = provider.id
where provider.is_active;

select
  has_function_privilege('authenticated', 'public.get_default_identity_provider(uuid)', 'EXECUTE')
    as authenticated_can_execute_legacy_provider_rpc,
  has_function_privilege(
    'authenticated',
    'public.sync_keycloak_user(uuid,text,text,text,text,uuid)',
    'EXECUTE'
  ) as authenticated_can_execute_legacy_sync_rpc,
  has_function_privilege(
    'authenticated',
    'public.log_auth_audit_event(text,text,uuid,uuid,uuid,text,inet,text,uuid,text,jsonb)',
    'EXECUTE'
  ) as authenticated_can_execute_legacy_audit_rpc,
  has_table_privilege('authenticated', 'public.identity_providers', 'SELECT')
    as authenticated_can_select_provider_table,
  has_table_privilege('authenticated', 'public.auth_audit_events', 'INSERT')
    as authenticated_can_insert_auth_audit_table;
