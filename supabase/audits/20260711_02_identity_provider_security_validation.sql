-- Axionn — Fase 4C: validacao somente leitura apos hardening.

select
  to_regprocedure('public.get_identity_provider_public_config(uuid)') is not null
    as public_config_rpc_exists,
  to_regprocedure('public.get_identity_provider_readiness(uuid)') is not null
    as readiness_rpc_exists,
  has_function_privilege(
    'authenticated',
    'public.get_identity_provider_public_config(uuid)',
    'EXECUTE'
  ) as authenticated_can_execute_safe_config_rpc,
  has_function_privilege(
    'authenticated',
    'public.get_identity_provider_readiness(uuid)',
    'EXECUTE'
  ) as authenticated_can_execute_readiness_rpc,
  not has_function_privilege(
    'authenticated',
    'public.get_default_identity_provider(uuid)',
    'EXECUTE'
  ) as authenticated_cannot_execute_legacy_provider_rpc,
  not has_function_privilege(
    'authenticated',
    'public.sync_keycloak_user(uuid,text,text,text,text,uuid)',
    'EXECUTE'
  ) as authenticated_cannot_execute_legacy_sync_rpc,
  not has_function_privilege(
    'authenticated',
    'public.log_auth_audit_event(text,text,uuid,uuid,uuid,text,inet,text,uuid,text,jsonb)',
    'EXECUTE'
  ) as authenticated_cannot_execute_legacy_audit_rpc,
  not has_table_privilege('authenticated', 'public.identity_providers', 'SELECT')
    as authenticated_cannot_select_provider_secrets,
  not has_table_privilege('authenticated', 'public.auth_audit_events', 'INSERT')
    as authenticated_cannot_spoof_auth_audit;

select
  organization_id,
  count(*) as provider_count,
  count(*) filter (where is_active) as active_provider_count,
  count(*) filter (where is_active and is_default) as default_provider_count
from public.identity_providers
group by organization_id
order by organization_id;
