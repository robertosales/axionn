-- Axionn Briefing — Teams MVP: OAuth PKCE e credenciais no Vault.

begin;

alter table public.ai_briefings
  drop constraint if exists ai_briefings_source_type_check;
alter table public.ai_briefings
  add constraint ai_briefings_source_type_check check (source_type in (
    'pasted_text', 'manual_notes', 'text_file', 'markdown_file', 'meeting_transcript'
  ));

create table public.meeting_oauth_states (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider = 'microsoft_teams'),
  state_hash text not null unique check (state_hash ~ '^[a-f0-9]{64}$'),
  verifier_secret_id uuid not null,
  redirect_uri text not null check (char_length(redirect_uri) between 10 and 2048),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index idx_meeting_oauth_states_expiry
  on public.meeting_oauth_states(expires_at) where consumed_at is null;

alter table public.meeting_oauth_states enable row level security;
revoke all on public.meeting_oauth_states from public, anon, authenticated;
grant select, insert, update, delete on public.meeting_oauth_states to service_role;

create or replace function public.store_meeting_oauth_state_v1(
  p_org_id uuid,
  p_user_id uuid,
  p_state_hash text,
  p_code_verifier text,
  p_redirect_uri text
)
returns uuid
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_secret_id uuid;
  v_state_id uuid;
begin
  if p_state_hash !~ '^[a-f0-9]{64}$'
     or char_length(p_code_verifier) not between 43 and 128
     or not public.can_briefing_meeting_permission_v1(p_org_id, 'briefing.connections.manage')
     or not public.has_organization_entitlement(p_org_id, 'briefing.integrations.enabled')
     or not public.has_organization_entitlement(p_org_id, 'briefing.integrations.teams') then
    raise exception using errcode = '42501', message = 'meeting_oauth_state_forbidden';
  end if;
  if p_user_id is distinct from auth.uid() then
    raise exception using errcode = '42501', message = 'meeting_oauth_user_mismatch';
  end if;

  select vault.create_secret(
    p_code_verifier,
    'meeting-oauth-verifier-' || gen_random_uuid()::text,
    'PKCE efêmero do conector Teams'
  ) into v_secret_id;

  insert into public.meeting_oauth_states(
    org_id, user_id, provider, state_hash, verifier_secret_id, redirect_uri, expires_at
  ) values (
    p_org_id, p_user_id, 'microsoft_teams', lower(p_state_hash),
    v_secret_id, p_redirect_uri, now() + interval '10 minutes'
  ) returning id into v_state_id;

  return v_state_id;
end;
$$;

create or replace function public.consume_meeting_oauth_state_v1(
  p_state_hash text,
  p_user_id uuid
)
returns table(org_id uuid, code_verifier text, redirect_uri text)
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_state public.meeting_oauth_states%rowtype;
  v_verifier text;
begin
  select * into v_state
  from public.meeting_oauth_states state
  where state.state_hash = lower(p_state_hash)
    and state.user_id = p_user_id
  for update;

  if not found or v_state.consumed_at is not null or v_state.expires_at <= now() then
    raise exception using errcode = '22023', message = 'meeting_oauth_state_invalid';
  end if;

  select secret.decrypted_secret into v_verifier
  from vault.decrypted_secrets secret where secret.id = v_state.verifier_secret_id;
  if v_verifier is null then
    raise exception using errcode = '55000', message = 'meeting_oauth_verifier_missing';
  end if;

  update public.meeting_oauth_states set consumed_at = now() where id = v_state.id;
  delete from vault.secrets where id = v_state.verifier_secret_id;

  return query select v_state.org_id, v_verifier, v_state.redirect_uri;
end;
$$;

create or replace function public.upsert_teams_meeting_connection_v1(
  p_org_id uuid,
  p_user_id uuid,
  p_external_tenant_id text,
  p_external_account_id text,
  p_display_name text,
  p_granted_scopes text[],
  p_token_payload text
)
returns uuid
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_connection public.meeting_connections%rowtype;
  v_secret_id uuid;
  v_payload jsonb;
begin
  if not public.is_organization_admin(p_org_id, p_user_id) then
    raise exception using errcode = '42501', message = 'meeting_connection_manage_forbidden';
  end if;
  v_payload := p_token_payload::jsonb;
  if jsonb_typeof(v_payload) <> 'object'
     or nullif(v_payload ->> 'access_token', '') is null
     or nullif(v_payload ->> 'refresh_token', '') is null then
    raise exception using errcode = '22023', message = 'meeting_token_payload_invalid';
  end if;

  select * into v_connection from public.meeting_connections connection
  where connection.org_id = p_org_id
    and connection.provider = 'microsoft_teams'
    and connection.external_account_id = p_external_account_id
  for update;

  if found then
    v_secret_id := v_connection.secret_ref::uuid;
    perform vault.update_secret(v_secret_id, p_token_payload);
    update public.meeting_connections set
      external_tenant_id = p_external_tenant_id,
      display_name = btrim(p_display_name),
      granted_scopes = p_granted_scopes,
      status = 'healthy', safe_error_code = null, safe_error_message = null,
      health_checked_at = now(), updated_at = now()
    where id = v_connection.id;
    return v_connection.id;
  end if;

  select vault.create_secret(
    p_token_payload,
    'meeting-teams-token-' || gen_random_uuid()::text,
    'Tokens OAuth do conector Teams'
  ) into v_secret_id;

  insert into public.meeting_connections(
    org_id, provider, connection_mode, external_tenant_id, external_account_id,
    display_name, secret_ref, granted_scopes, status, created_by
  ) values (
    p_org_id, 'microsoft_teams', 'delegated', p_external_tenant_id,
    p_external_account_id, btrim(p_display_name), v_secret_id::text,
    p_granted_scopes, 'healthy', p_user_id
  ) returning id into v_connection.id;
  return v_connection.id;
end;
$$;

create or replace function public.get_meeting_connection_secret_v1(p_connection_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_secret text;
begin
  select secret.decrypted_secret into v_secret
  from public.meeting_connections connection
  join vault.decrypted_secrets secret on secret.id = connection.secret_ref::uuid
  where connection.id = p_connection_id and connection.status <> 'disabled';
  if v_secret is null then
    raise exception using errcode = 'P0002', message = 'meeting_connection_secret_missing';
  end if;
  return v_secret;
end;
$$;

create or replace function public.update_meeting_connection_secret_v1(
  p_connection_id uuid,
  p_token_payload text,
  p_granted_scopes text[]
)
returns void
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $$
declare
  v_secret_id uuid;
  v_payload jsonb;
begin
  v_payload := p_token_payload::jsonb;
  if jsonb_typeof(v_payload) <> 'object'
     or nullif(v_payload ->> 'access_token', '') is null
     or nullif(v_payload ->> 'refresh_token', '') is null then
    raise exception using errcode = '22023', message = 'meeting_token_payload_invalid';
  end if;
  select secret_ref::uuid into v_secret_id from public.meeting_connections
  where id = p_connection_id for update;
  if v_secret_id is null then
    raise exception using errcode = 'P0002', message = 'meeting_connection_not_found';
  end if;
  perform vault.update_secret(v_secret_id, p_token_payload);
  update public.meeting_connections set granted_scopes = p_granted_scopes,
    status = 'healthy', safe_error_code = null, safe_error_message = null,
    health_checked_at = now(), updated_at = now()
  where id = p_connection_id;
end;
$$;

revoke all on function public.store_meeting_oauth_state_v1(uuid,uuid,text,text,text) from public, anon;
revoke all on function public.consume_meeting_oauth_state_v1(text,uuid) from public, anon, authenticated;
revoke all on function public.upsert_teams_meeting_connection_v1(uuid,uuid,text,text,text,text[],text) from public, anon, authenticated;
revoke all on function public.get_meeting_connection_secret_v1(uuid) from public, anon, authenticated;
revoke all on function public.update_meeting_connection_secret_v1(uuid,text,text[]) from public, anon, authenticated;
grant execute on function public.store_meeting_oauth_state_v1(uuid,uuid,text,text,text) to authenticated, service_role;
grant execute on function public.consume_meeting_oauth_state_v1(text,uuid) to service_role;
grant execute on function public.upsert_teams_meeting_connection_v1(uuid,uuid,text,text,text,text[],text) to service_role;
grant execute on function public.get_meeting_connection_secret_v1(uuid) to service_role;
grant execute on function public.update_meeting_connection_secret_v1(uuid,text,text[]) to service_role;

commit;
