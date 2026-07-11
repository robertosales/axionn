-- Axionn — Fase 4C: hardening aditivo da fundacao Keycloak/OIDC.
-- Preserva dados e Supabase Auth. Nao ativa SSO nem altera o login atual.

begin;

do $$
begin
  if to_regclass('public.identity_providers') is null
     or to_regclass('public.keycloak_user_mappings') is null
     or to_regclass('public.auth_audit_events') is null then
    raise exception 'identity_provider_hardening_missing_prerequisite';
  end if;

  if to_regprocedure('public.is_platform_admin(uuid)') is null then
    raise exception 'identity_provider_hardening_missing_is_platform_admin';
  end if;
end;
$$;

-- RPCs legadas retornam/alteram estruturas sensiveis e ficam restritas ao backend.
revoke all on function public.get_default_identity_provider(uuid)
  from public, anon, authenticated;
grant execute on function public.get_default_identity_provider(uuid)
  to service_role;

revoke all on function public.sync_keycloak_user(uuid, text, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.sync_keycloak_user(uuid, text, text, text, text, uuid)
  to service_role;

revoke all on function public.log_auth_audit_event(
  text, text, uuid, uuid, uuid, text, inet, text, uuid, text, jsonb
) from public, anon, authenticated;
grant execute on function public.log_auth_audit_event(
  text, text, uuid, uuid, uuid, text, inet, text, uuid, text, jsonb
) to service_role;

-- Tabelas com secrets e mappings nao sao interfaces diretas do frontend.
revoke all on table public.identity_providers
  from public, anon, authenticated;
revoke all on table public.keycloak_user_mappings
  from public, anon, authenticated;
revoke all on table public.auth_audit_events
  from public, anon, authenticated;

grant select, insert, update, delete on table public.identity_providers
  to service_role;
grant select, insert, update, delete on table public.keycloak_user_mappings
  to service_role;
grant select, insert, update, delete on table public.auth_audit_events
  to service_role;

-- Remove a escrita autenticada generica. service_role ignora RLS.
drop policy if exists "auth_audit_events_insert_service"
  on public.auth_audit_events;

create or replace function public.get_identity_provider_public_config(
  p_organization_id uuid
)
returns table (
  id uuid,
  organization_id uuid,
  name text,
  provider_type text,
  issuer_url text,
  client_id text,
  jwks_url text,
  authorization_endpoint text,
  token_endpoint text,
  userinfo_endpoint text,
  scopes text[],
  claim_mapping jsonb,
  is_default boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'identity_provider_authentication_required';
  end if;

  if not public.is_platform_admin(auth.uid())
     and not exists (
       select 1
       from public.organization_members membership
       where membership.org_id = p_organization_id
         and membership.user_id = auth.uid()
         and membership.is_active
     ) then
    raise exception using
      errcode = '42501',
      message = 'identity_provider_access_denied';
  end if;

  return query
  select
    provider.id,
    provider.organization_id,
    provider.name,
    provider.provider_type,
    provider.issuer_url,
    provider.client_id,
    provider.jwks_url,
    provider.authorization_endpoint,
    provider.token_endpoint,
    provider.userinfo_endpoint,
    provider.scopes,
    provider.claim_mapping,
    provider.is_default
  from public.identity_providers provider
  where provider.organization_id = p_organization_id
    and provider.is_active
  order by provider.is_default desc, provider.created_at, provider.id;
end;
$$;

revoke all on function public.get_identity_provider_public_config(uuid)
  from public, anon;
grant execute on function public.get_identity_provider_public_config(uuid)
  to authenticated, service_role;

comment on function public.get_identity_provider_public_config(uuid) is
  'Retorna configuracao OIDC sanitizada para membros da organizacao. Nunca retorna client_secret_encrypted ou config_json.';

create or replace function public.get_identity_provider_readiness(
  p_organization_id uuid
)
returns table (
  provider_count bigint,
  active_provider_count bigint,
  default_provider_count bigint,
  providers_missing_required_config bigint,
  mapping_count bigint,
  mapping_error_count bigint,
  readiness_ok boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'identity_provider_authentication_required';
  end if;

  if not public.is_platform_admin(auth.uid())
     and not exists (
       select 1
       from public.organization_members membership
       where membership.org_id = p_organization_id
         and membership.user_id = auth.uid()
         and membership.is_active
         and membership.role::text in ('owner', 'admin')
     ) then
    raise exception using
      errcode = '42501',
      message = 'identity_provider_admin_access_denied';
  end if;

  return query
  with provider_stats as (
    select
      count(*) as provider_count,
      count(*) filter (where provider.is_active) as active_provider_count,
      count(*) filter (where provider.is_active and provider.is_default) as default_provider_count,
      count(*) filter (
        where provider.is_active
          and (
            nullif(trim(provider.issuer_url), '') is null
            or nullif(trim(provider.client_id), '') is null
          )
      ) as providers_missing_required_config
    from public.identity_providers provider
    where provider.organization_id = p_organization_id
  ),
  mapping_stats as (
    select
      count(*) as mapping_count,
      count(*) filter (where mapping.sync_status = 'error') as mapping_error_count
    from public.keycloak_user_mappings mapping
    where mapping.organization_id = p_organization_id
  )
  select
    provider_stats.provider_count,
    provider_stats.active_provider_count,
    provider_stats.default_provider_count,
    provider_stats.providers_missing_required_config,
    mapping_stats.mapping_count,
    mapping_stats.mapping_error_count,
    (
      provider_stats.active_provider_count > 0
      and provider_stats.default_provider_count = 1
      and provider_stats.providers_missing_required_config = 0
      and mapping_stats.mapping_error_count = 0
    ) as readiness_ok
  from provider_stats
  cross join mapping_stats;
end;
$$;

revoke all on function public.get_identity_provider_readiness(uuid)
  from public, anon;
grant execute on function public.get_identity_provider_readiness(uuid)
  to authenticated, service_role;

comment on function public.get_identity_provider_readiness(uuid) is
  'Readiness sanitizado de OIDC/Keycloak para admin da organizacao ou platform_admin.';

commit;

select
  to_regprocedure('public.get_identity_provider_public_config(uuid)') is not null
  and to_regprocedure('public.get_identity_provider_readiness(uuid)') is not null
  and has_function_privilege(
    'authenticated',
    'public.get_identity_provider_public_config(uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.get_default_identity_provider(uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.sync_keycloak_user(uuid,text,text,text,text,uuid)',
    'EXECUTE'
  )
  and not has_table_privilege('authenticated', 'public.identity_providers', 'SELECT')
  and not has_table_privilege('authenticated', 'public.auth_audit_events', 'INSERT')
    as identity_provider_security_hardening_ok;
