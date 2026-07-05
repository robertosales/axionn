-- Axion SaaS - Fase 2B / administracao global de provedores de IA.
-- Nenhuma chave e retornada ao frontend. Mutations exigem platform_admin.

create table if not exists public.platform_operational_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  before_values jsonb not null default '{}'::jsonb,
  after_values jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_operational_audit_created
  on public.platform_operational_audit_log(created_at desc);

alter table public.platform_operational_audit_log enable row level security;
revoke all on public.platform_operational_audit_log from public, anon, authenticated;
grant select, insert on public.platform_operational_audit_log to service_role;

create or replace function public.assert_platform_admin_v2()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not coalesce(public.is_platform_admin(auth.uid()), false) then
    raise exception using errcode = '42501', message = 'platform_admin_required';
  end if;
end;
$$;

create or replace function public.list_platform_ai_providers_v2(
  p_only_active boolean default false
)
returns table (
  id uuid,
  name text,
  provider_type text,
  model text,
  api_base_url text,
  request_format text,
  is_recommended boolean,
  is_active boolean,
  has_key boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_platform_admin_v2();

  return query
  select
    provider.id,
    provider.name,
    provider.provider_type,
    provider.model,
    provider.api_base_url,
    provider.request_format,
    provider.is_recommended,
    provider.is_active,
    provider.has_key,
    provider.created_at,
    provider.updated_at
  from public.ai_providers provider
  where not p_only_active or provider.is_active
  order by provider.is_recommended desc, provider.name;
end;
$$;

create or replace function public.create_platform_ai_provider_v2(
  p_name text,
  p_provider_type text,
  p_model text default null,
  p_api_base_url text default null,
  p_request_format text default 'openai_compatible',
  p_is_recommended boolean default false,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_provider public.ai_providers%rowtype;
begin
  perform public.assert_platform_admin_v2();

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception using errcode = '23514', message = 'ai_provider_name_required';
  end if;
  if nullif(btrim(coalesce(p_provider_type, '')), '') is null then
    raise exception using errcode = '23514', message = 'ai_provider_type_required';
  end if;
  if p_request_format not in ('openai_compatible', 'gemini', 'anthropic') then
    raise exception using errcode = '23514', message = 'ai_provider_request_format_invalid';
  end if;
  if p_api_base_url is not null and p_api_base_url !~* '^https://[^[:space:]]+$' then
    raise exception using errcode = '23514', message = 'ai_provider_api_url_invalid';
  end if;

  insert into public.ai_providers (
    name,
    provider_type,
    model,
    api_base_url,
    request_format,
    is_recommended,
    is_active,
    created_by
  )
  values (
    btrim(p_name),
    lower(btrim(p_provider_type)),
    nullif(btrim(coalesce(p_model, '')), ''),
    nullif(btrim(coalesce(p_api_base_url, '')), ''),
    p_request_format,
    p_is_recommended,
    p_is_active,
    auth.uid()
  )
  returning * into v_provider;

  insert into public.platform_operational_audit_log (
    actor_id, action, resource_type, resource_id, after_values
  )
  values (
    auth.uid(),
    'ai_provider_created',
    'ai_provider',
    v_provider.id,
    to_jsonb(v_provider) - 'vault_secret_id'
  );

  return v_provider.id;
end;
$$;

create or replace function public.update_platform_ai_provider_v2(
  p_provider_id uuid,
  p_name text,
  p_provider_type text,
  p_model text default null,
  p_api_base_url text default null,
  p_request_format text default 'openai_compatible',
  p_is_recommended boolean default false,
  p_is_active boolean default true
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.ai_providers%rowtype;
  v_after public.ai_providers%rowtype;
begin
  perform public.assert_platform_admin_v2();

  select * into v_before
  from public.ai_providers provider
  where provider.id = p_provider_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ai_provider_not_found';
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception using errcode = '23514', message = 'ai_provider_name_required';
  end if;
  if nullif(btrim(coalesce(p_provider_type, '')), '') is null then
    raise exception using errcode = '23514', message = 'ai_provider_type_required';
  end if;
  if p_request_format not in ('openai_compatible', 'gemini', 'anthropic') then
    raise exception using errcode = '23514', message = 'ai_provider_request_format_invalid';
  end if;
  if p_api_base_url is not null and p_api_base_url !~* '^https://[^[:space:]]+$' then
    raise exception using errcode = '23514', message = 'ai_provider_api_url_invalid';
  end if;

  update public.ai_providers provider
  set name = btrim(p_name),
      provider_type = lower(btrim(p_provider_type)),
      model = nullif(btrim(coalesce(p_model, '')), ''),
      api_base_url = nullif(btrim(coalesce(p_api_base_url, '')), ''),
      request_format = p_request_format,
      is_recommended = p_is_recommended,
      is_active = p_is_active,
      updated_at = now()
  where provider.id = p_provider_id
  returning * into v_after;

  insert into public.platform_operational_audit_log (
    actor_id, action, resource_type, resource_id, before_values, after_values
  )
  values (
    auth.uid(),
    'ai_provider_updated',
    'ai_provider',
    p_provider_id,
    to_jsonb(v_before) - 'vault_secret_id',
    to_jsonb(v_after) - 'vault_secret_id'
  );
end;
$$;

create or replace function public.archive_platform_ai_provider_v2(
  p_provider_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_before public.ai_providers%rowtype;
  v_after public.ai_providers%rowtype;
begin
  perform public.assert_platform_admin_v2();

  select * into v_before
  from public.ai_providers provider
  where provider.id = p_provider_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ai_provider_not_found';
  end if;

  update public.ai_providers provider
  set is_active = false,
      is_recommended = false,
      updated_at = now()
  where provider.id = p_provider_id
  returning * into v_after;

  insert into public.platform_operational_audit_log (
    actor_id, action, resource_type, resource_id, before_values, after_values
  )
  values (
    auth.uid(),
    'ai_provider_archived',
    'ai_provider',
    p_provider_id,
    to_jsonb(v_before) - 'vault_secret_id',
    to_jsonb(v_after) - 'vault_secret_id'
  );
end;
$$;

create or replace function public.set_platform_ai_provider_key_v2(
  p_provider_id uuid,
  p_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_platform_admin_v2();

  if nullif(btrim(coalesce(p_key, '')), '') is null then
    raise exception using errcode = '23514', message = 'ai_provider_key_required';
  end if;

  if to_regprocedure('public.set_ai_provider_key_v2(uuid,text)') is null then
    raise exception using errcode = '42883', message = 'ai_provider_key_backend_unavailable';
  end if;

  perform public.set_ai_provider_key_v2(p_provider_id, p_key);

  insert into public.platform_operational_audit_log (
    actor_id, action, resource_type, resource_id, metadata
  )
  values (
    auth.uid(),
    'ai_provider_key_updated',
    'ai_provider',
    p_provider_id,
    jsonb_build_object('secret_value_logged', false)
  );
end;
$$;

revoke all on function public.assert_platform_admin_v2() from public, anon;
revoke all on function public.list_platform_ai_providers_v2(boolean) from public, anon;
revoke all on function public.create_platform_ai_provider_v2(text,text,text,text,text,boolean,boolean) from public, anon;
revoke all on function public.update_platform_ai_provider_v2(uuid,text,text,text,text,text,boolean,boolean) from public, anon;
revoke all on function public.archive_platform_ai_provider_v2(uuid) from public, anon;
revoke all on function public.set_platform_ai_provider_key_v2(uuid,text) from public, anon;

grant execute on function public.list_platform_ai_providers_v2(boolean) to authenticated, service_role;
grant execute on function public.create_platform_ai_provider_v2(text,text,text,text,text,boolean,boolean) to authenticated, service_role;
grant execute on function public.update_platform_ai_provider_v2(uuid,text,text,text,text,text,boolean,boolean) to authenticated, service_role;
grant execute on function public.archive_platform_ai_provider_v2(uuid) to authenticated, service_role;
grant execute on function public.set_platform_ai_provider_key_v2(uuid,text) to authenticated, service_role;

comment on function public.list_platform_ai_providers_v2(boolean) is
  'Lista metadados de provedores globais sem retornar vault_secret_id ou valor de chave.';
