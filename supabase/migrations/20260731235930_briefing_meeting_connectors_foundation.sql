-- Axionn Briefing — fundação dos conectores de reuniões.
-- Aditiva, desabilitada comercialmente por padrão e sem credenciais em claro.

begin;

insert into public.app_permissions (key, label, description, group_key) values
  ('briefing.connections.view', 'Visualizar conexões de reuniões', 'Visualiza health e configuração sanitizada dos conectores.', 'briefing'),
  ('briefing.connections.manage', 'Gerenciar conexões de reuniões', 'Autoriza conexão, reautorização, configuração e revogação.', 'briefing'),
  ('briefing.meetings.list', 'Visualizar reuniões externas', 'Lista reuniões externas acessíveis no tenant.', 'briefing'),
  ('briefing.meetings.import', 'Importar reuniões externas', 'Solicita importação manual de uma reunião.', 'briefing'),
  ('briefing.process', 'Processar briefings', 'Solicita processamento de uma fonte importada.', 'briefing'),
  ('briefing.review', 'Revisar briefings', 'Aprova, edita ou rejeita sugestões.', 'briefing'),
  ('briefing.apply', 'Aplicar sugestões de briefings', 'Transforma sugestões aprovadas em objetos Axionn.', 'briefing'),
  ('briefing.export', 'Exportar briefings', 'Exporta relatório e evidências autorizadas.', 'briefing'),
  ('briefing.retention.manage', 'Gerenciar retenção de briefings', 'Configura retenção e exclusão do domínio.', 'briefing')
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  group_key = excluded.group_key;

insert into public.role_permissions (role_name, permission_key) values
  ('product_owner', 'briefing.meetings.list'),
  ('product_owner', 'briefing.meetings.import'),
  ('product_owner', 'briefing.process'),
  ('product_owner', 'briefing.review'),
  ('product_owner', 'briefing.apply'),
  ('product_owner', 'briefing.export'),
  ('scrum_master', 'briefing.meetings.list'),
  ('scrum_master', 'briefing.meetings.import'),
  ('scrum_master', 'briefing.process'),
  ('scrum_master', 'briefing.review'),
  ('scrum_master', 'briefing.apply'),
  ('scrum_master', 'briefing.export'),
  ('architect', 'briefing.meetings.list'),
  ('architect', 'briefing.meetings.import'),
  ('architect', 'briefing.process'),
  ('architect', 'briefing.review'),
  ('developer', 'briefing.meetings.list'),
  ('developer', 'briefing.meetings.import'),
  ('developer', 'briefing.process'),
  ('member', 'briefing.meetings.list')
on conflict (role_name, permission_key) do nothing;

with entitlement_seed(plan_code, feature_key, enabled, limit_value) as (
  select plan.code, feature.feature_key, false, feature.limit_value
  from public.saas_plans plan
  cross join (values
    ('briefing.integrations.enabled'::text, null::bigint),
    ('briefing.integrations.teams'::text, null::bigint),
    ('briefing.integrations.meet'::text, null::bigint),
    ('briefing.integrations.auto_sync'::text, null::bigint),
    ('briefing.recording_access'::text, null::bigint),
    ('briefing.cross_meeting_insights'::text, null::bigint),
    ('briefing.integrations.meetings_monthly'::text, 0::bigint),
    ('briefing.integrations.minutes_monthly'::text, 0::bigint),
    ('briefing.integrations.connections_max'::text, 0::bigint),
    ('briefing.integrations.retention_days_max'::text, 0::bigint)
  ) feature(feature_key, limit_value)
)
insert into public.saas_plan_entitlements(plan_id, feature_key, enabled, limit_value)
select plan.id, seed.feature_key, seed.enabled, seed.limit_value
from entitlement_seed seed
join public.saas_plans plan on plan.code = seed.plan_code
on conflict (plan_id, feature_key) do nothing;

create table public.meeting_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('microsoft_teams', 'google_meet')),
  connection_mode text not null default 'delegated'
    check (connection_mode in ('delegated', 'application')),
  external_tenant_id text,
  external_account_id text not null,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 240),
  secret_ref text not null check (char_length(btrim(secret_ref)) between 1 and 500),
  granted_scopes text[] not null default '{}',
  status text not null default 'disabled' check (status in (
    'connecting', 'healthy', 'syncing', 'attention_required',
    'insufficient_permission', 'token_expired', 'access_revoked', 'disabled'
  )),
  sync_policy text not null default 'manual' check (sync_policy in ('manual', 'automatic')),
  initial_days_back integer not null default 30 check (initial_days_back between 1 and 365),
  retention_days integer not null default 90 check (retention_days between 1 and 3650),
  health_checked_at timestamptz,
  last_synced_at timestamptz,
  safe_error_code text,
  safe_error_message text check (safe_error_message is null or char_length(safe_error_message) <= 1000),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider, external_account_id)
);

comment on column public.meeting_connections.secret_ref is
  'Referência opaca a segredo no Vault; nunca armazena access ou refresh token.';

create table public.meeting_sync_cursors (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.meeting_connections(id) on delete cascade,
  cursor_type text not null check (cursor_type in ('initial', 'incremental', 'reconciliation')),
  cursor_value text,
  window_start timestamptz,
  window_end timestamptz,
  updated_at timestamptz not null default now(),
  unique (connection_id, cursor_type),
  check (window_end is null or window_start is null or window_end > window_start)
);

create table public.meeting_webhook_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.meeting_connections(id) on delete cascade,
  provider_event_id text not null,
  event_type text not null,
  payload_ref text,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  state text not null default 'received'
    check (state in ('received', 'processing', 'processed', 'retry', 'dead_letter')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  correlation_id uuid not null default gen_random_uuid(),
  safe_error_code text,
  safe_error_message text,
  unique (connection_id, provider_event_id)
);

create table public.external_meetings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.meeting_connections(id) on delete cascade,
  external_meeting_id text not null,
  external_tenant_id text,
  subject text not null check (char_length(btrim(subject)) between 1 and 500),
  organizer_external_id text,
  organizer_display_name text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  state text not null default 'discovered' check (state in (
    'discovered', 'artifacts_pending', 'ready', 'importing', 'normalizing',
    'processing', 'needs_review', 'verified', 'applied', 'archived',
    'recoverable_failure', 'terminal_failure'
  )),
  source_version text not null,
  has_recording boolean not null default false,
  has_transcript boolean not null default false,
  team_id uuid references public.teams(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  sprint_id uuid references public.sprints(id) on delete set null,
  discovered_at timestamptz not null default now(),
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, external_meeting_id),
  check (ends_at is null or ends_at > starts_at)
);

create table public.meeting_participants (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id uuid not null references public.external_meetings(id) on delete cascade,
  external_participant_id text not null,
  display_name text not null,
  email_ciphertext text,
  role text not null default 'unknown'
    check (role in ('organizer', 'presenter', 'attendee', 'unknown')),
  attended_intervals jsonb not null default '[]'::jsonb
    check (jsonb_typeof(attended_intervals) = 'array'),
  created_at timestamptz not null default now(),
  unique (meeting_id, external_participant_id)
);

create table public.meeting_artifacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id uuid not null references public.external_meetings(id) on delete cascade,
  external_artifact_id text not null,
  kind text not null check (kind in ('transcript', 'recording')),
  status text not null default 'pending'
    check (status in ('pending', 'available', 'expired', 'unavailable', 'failed')),
  language text,
  provider_reference text,
  source_version text not null,
  content_hash text check (content_hash is null or content_hash ~ '^[a-f0-9]{64}$'),
  available_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (meeting_id, external_artifact_id, source_version),
  check (expires_at is null or available_at is null or expires_at > available_at)
);

create table public.meeting_transcript_segments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  artifact_id uuid not null references public.meeting_artifacts(id) on delete cascade,
  external_segment_id text not null,
  participant_id uuid references public.meeting_participants(id) on delete set null,
  speaker_label text not null,
  text_content text not null check (char_length(btrim(text_content)) between 1 and 20000),
  start_ms bigint not null check (start_ms >= 0),
  end_ms bigint not null check (end_ms > start_ms),
  ordinal integer not null check (ordinal >= 0),
  text_start integer check (text_start is null or text_start >= 0),
  text_end integer,
  quote_hash text not null check (quote_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (artifact_id, external_segment_id),
  unique (artifact_id, ordinal),
  check ((text_start is null and text_end is null) or
         (text_start is not null and text_end is not null and text_end > text_start))
);

create table public.meeting_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id uuid not null references public.external_meetings(id) on delete cascade,
  artifact_id uuid references public.meeting_artifacts(id) on delete cascade,
  job_type text not null check (job_type in ('discover', 'import', 'normalize', 'process', 'reconcile')),
  idempotency_key text not null,
  state text not null default 'queued'
    check (state in ('queued', 'running', 'retry', 'succeeded', 'dead_letter', 'cancelled')),
  stage text not null default 'queued',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  next_attempt_at timestamptz,
  locked_at timestamptz,
  locked_by text,
  correlation_id uuid not null default gen_random_uuid(),
  safe_error_code text,
  safe_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, idempotency_key)
);

create table public.briefing_source_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  briefing_id uuid not null unique references public.ai_briefings(id) on delete cascade,
  meeting_id uuid not null references public.external_meetings(id) on delete restrict,
  artifact_id uuid not null references public.meeting_artifacts(id) on delete restrict,
  source_version text not null,
  normalized_hash text not null check (normalized_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (meeting_id, artifact_id, source_version)
);

create table public.meeting_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  correlation_id uuid not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);

create index idx_meeting_connections_org_status on public.meeting_connections(org_id, status);
create index idx_meeting_webhook_state_retry on public.meeting_webhook_events(state, next_attempt_at);
create index idx_external_meetings_org_started on public.external_meetings(org_id, starts_at desc);
create index idx_external_meetings_team_started on public.external_meetings(team_id, starts_at desc) where team_id is not null;
create index idx_meeting_artifacts_meeting_kind on public.meeting_artifacts(meeting_id, kind, status);
create index idx_transcript_segments_artifact_time on public.meeting_transcript_segments(artifact_id, start_ms, ordinal);
create index idx_meeting_jobs_dispatch on public.meeting_processing_jobs(state, next_attempt_at, created_at);
create index idx_meeting_audit_org_created on public.meeting_audit_events(org_id, created_at desc);

create or replace function public.can_briefing_meeting_permission_v1(
  p_org_id uuid,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and (
    coalesce(public.is_platform_admin(auth.uid()), false)
    or coalesce(public.is_organization_admin(p_org_id, auth.uid()), false)
    or exists (
      select 1
      from public.organization_member_modules module
      join public.organization_members member using (org_id, user_id)
      join public.role_permissions role_permission
        on role_permission.role_name = module.role_name
      where module.org_id = p_org_id
        and module.user_id = auth.uid()
        and module.module_key = 'ai_briefing'
        and member.is_active
        and role_permission.permission_key = p_permission
    )
  );
$$;

create or replace function public.validate_meeting_child_org_v1()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_parent_org uuid;
  v_related_meeting_id uuid;
begin
  if tg_table_name = 'meeting_sync_cursors' then
    select org_id into v_parent_org from public.meeting_connections where id = new.connection_id;
    if v_parent_org is null then raise exception using errcode = '23503', message = 'meeting_connection_not_found'; end if;
    return new;
  elsif tg_table_name = 'meeting_webhook_events' then
    select org_id into v_parent_org from public.meeting_connections where id = new.connection_id;
  elsif tg_table_name = 'external_meetings' then
    select org_id into v_parent_org from public.meeting_connections where id = new.connection_id;
  elsif tg_table_name = 'meeting_participants' then
    select org_id into v_parent_org from public.external_meetings where id = new.meeting_id;
  elsif tg_table_name = 'meeting_artifacts' then
    select org_id into v_parent_org from public.external_meetings where id = new.meeting_id;
  elsif tg_table_name = 'meeting_transcript_segments' then
    select org_id, meeting_id into v_parent_org, v_related_meeting_id
    from public.meeting_artifacts where id = new.artifact_id and kind = 'transcript';
    if v_parent_org is null then
      raise exception using errcode = '23514', message = 'meeting_segment_requires_transcript';
    end if;
    if new.participant_id is not null and not exists (
      select 1 from public.meeting_participants participant
      where participant.id = new.participant_id
        and participant.meeting_id = v_related_meeting_id
    ) then
      raise exception using errcode = '23514', message = 'meeting_segment_participant_mismatch';
    end if;
  elsif tg_table_name = 'meeting_processing_jobs' then
    select org_id into v_parent_org from public.external_meetings where id = new.meeting_id;
    if new.artifact_id is not null and not exists (
      select 1 from public.meeting_artifacts artifact
      where artifact.id = new.artifact_id and artifact.meeting_id = new.meeting_id
    ) then
      raise exception using errcode = '23514', message = 'meeting_job_artifact_mismatch';
    end if;
  elsif tg_table_name = 'briefing_source_links' then
    select org_id into v_parent_org from public.ai_briefings where id = new.briefing_id;
    if v_parent_org is distinct from new.org_id then
      raise exception using errcode = '23514', message = 'briefing_source_org_mismatch';
    end if;
    select org_id into v_parent_org from public.external_meetings where id = new.meeting_id;
    if not exists (
      select 1 from public.meeting_artifacts artifact
      where artifact.id = new.artifact_id
        and artifact.meeting_id = new.meeting_id
        and artifact.kind = 'transcript'
    ) then
      raise exception using errcode = '23514', message = 'briefing_source_artifact_mismatch';
    end if;
  end if;

  if v_parent_org is null or v_parent_org is distinct from new.org_id then
    raise exception using errcode = '23514', message = 'meeting_child_org_mismatch';
  end if;
  return new;
end;
$$;

create or replace function public.validate_external_meeting_context_v1()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.team_id is not null
     and public.resolve_team_org_id(new.team_id) is distinct from new.org_id then
    raise exception using errcode = '23514', message = 'meeting_team_org_mismatch';
  end if;
  if new.project_id is not null
     and public.resolve_project_org_id(new.project_id) is distinct from new.org_id then
    raise exception using errcode = '23514', message = 'meeting_project_org_mismatch';
  end if;
  if new.project_id is not null and new.team_id is not null and not exists (
    select 1 from public.projects project
    where project.id = new.project_id
      and (project.team_id is null or project.team_id = new.team_id)
  ) then
    raise exception using errcode = '23514', message = 'meeting_project_team_mismatch';
  end if;
  if new.sprint_id is not null and (
    new.team_id is null or not exists (
      select 1 from public.sprints sprint
      where sprint.id = new.sprint_id and sprint.team_id = new.team_id
    )
  ) then
    raise exception using errcode = '23514', message = 'meeting_sprint_team_mismatch';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_external_meeting_state_v1()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_old_rank integer;
  v_new_rank integer;
begin
  if new.state = old.state then return new; end if;
  if new.state in ('recoverable_failure', 'terminal_failure', 'archived') then return new; end if;
  if old.state = 'recoverable_failure' and new.state in ('importing', 'normalizing', 'processing') then
    return new;
  end if;

  v_old_rank := array_position(array[
    'discovered', 'artifacts_pending', 'ready', 'importing', 'normalizing',
    'processing', 'needs_review', 'verified', 'applied'
  ], old.state);
  v_new_rank := array_position(array[
    'discovered', 'artifacts_pending', 'ready', 'importing', 'normalizing',
    'processing', 'needs_review', 'verified', 'applied'
  ], new.state);

  if v_old_rank is null or v_new_rank is null or v_new_rank < v_old_rank then
    raise exception using errcode = '55000', message = 'meeting_state_regression_forbidden';
  end if;
  return new;
end;
$$;

create trigger trg_meeting_webhook_org before insert or update of org_id, connection_id
on public.meeting_webhook_events for each row execute function public.validate_meeting_child_org_v1();
create trigger trg_external_meeting_org before insert or update of org_id, connection_id
on public.external_meetings for each row execute function public.validate_meeting_child_org_v1();
create trigger trg_external_meeting_context before insert or update of org_id, team_id, project_id, sprint_id
on public.external_meetings for each row execute function public.validate_external_meeting_context_v1();
create trigger trg_meeting_participant_org before insert or update of org_id, meeting_id
on public.meeting_participants for each row execute function public.validate_meeting_child_org_v1();
create trigger trg_meeting_artifact_org before insert or update of org_id, meeting_id
on public.meeting_artifacts for each row execute function public.validate_meeting_child_org_v1();
create trigger trg_transcript_segment_org before insert or update of org_id, artifact_id, participant_id
on public.meeting_transcript_segments for each row execute function public.validate_meeting_child_org_v1();
create trigger trg_meeting_job_org before insert or update of org_id, meeting_id, artifact_id
on public.meeting_processing_jobs for each row execute function public.validate_meeting_child_org_v1();
create trigger trg_briefing_source_org before insert or update of org_id, briefing_id, meeting_id, artifact_id
on public.briefing_source_links for each row execute function public.validate_meeting_child_org_v1();
create trigger trg_external_meeting_state before update of state
on public.external_meetings for each row execute function public.enforce_external_meeting_state_v1();

create or replace function public.list_meeting_connections_v1(p_org_id uuid)
returns table(
  id uuid,
  provider text,
  connection_mode text,
  display_name text,
  granted_scopes text[],
  status text,
  sync_policy text,
  initial_days_back integer,
  retention_days integer,
  health_checked_at timestamptz,
  last_synced_at timestamptz,
  safe_error_code text,
  safe_error_message text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_briefing_meeting_permission_v1(p_org_id, 'briefing.connections.view') then
    raise exception using errcode = '42501', message = 'meeting_connections_access_denied';
  end if;

  return query
  select connection.id, connection.provider, connection.connection_mode,
    connection.display_name, connection.granted_scopes, connection.status,
    connection.sync_policy, connection.initial_days_back, connection.retention_days,
    connection.health_checked_at, connection.last_synced_at,
    connection.safe_error_code, connection.safe_error_message
  from public.meeting_connections connection
  where connection.org_id = p_org_id
  order by connection.created_at;
end;
$$;

create or replace function public.request_meeting_import_v1(
  p_meeting_id uuid,
  p_team_id uuid,
  p_project_id uuid default null,
  p_sprint_id uuid default null,
  p_idempotency_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_meeting public.external_meetings%rowtype;
  v_job_id uuid;
  v_existing_meeting_id uuid;
  v_key text;
begin
  select * into v_meeting from public.external_meetings where id = p_meeting_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'meeting_not_found'; end if;
  if not public.can_briefing_meeting_permission_v1(v_meeting.org_id, 'briefing.meetings.import') then
    raise exception using errcode = '42501', message = 'meeting_import_access_denied';
  end if;
  if not public.has_organization_entitlement(v_meeting.org_id, 'briefing.integrations.enabled') then
    raise exception using errcode = '42501', message = 'meeting_integrations_entitlement_required';
  end if;

  v_key := coalesce(nullif(btrim(p_idempotency_key), ''),
    'meeting-import:' || p_meeting_id::text || ':' || v_meeting.source_version);

  select job.id, job.meeting_id into v_job_id, v_existing_meeting_id
  from public.meeting_processing_jobs job
  where job.org_id = v_meeting.org_id and job.idempotency_key = v_key;

  if v_job_id is not null then
    if v_existing_meeting_id is distinct from p_meeting_id then
      raise exception using errcode = '23505', message = 'meeting_idempotency_key_conflict';
    end if;
    return v_job_id;
  end if;

  if v_meeting.state <> 'ready' or not v_meeting.has_transcript then
    raise exception using errcode = '55000', message = 'meeting_transcript_not_ready';
  end if;
  if public.resolve_team_org_id(p_team_id) is distinct from v_meeting.org_id then
    raise exception using errcode = '23514', message = 'meeting_team_org_mismatch';
  end if;
  if p_project_id is not null and public.resolve_project_org_id(p_project_id) is distinct from v_meeting.org_id then
    raise exception using errcode = '23514', message = 'meeting_project_org_mismatch';
  end if;
  if p_sprint_id is not null and not exists (
    select 1 from public.sprints sprint
    where sprint.id = p_sprint_id and sprint.team_id = p_team_id
  ) then
    raise exception using errcode = '23514', message = 'meeting_sprint_team_mismatch';
  end if;

  update public.external_meetings set
    team_id = p_team_id,
    project_id = p_project_id,
    sprint_id = p_sprint_id,
    state = 'importing',
    imported_at = coalesce(imported_at, now()),
    updated_at = now()
  where id = p_meeting_id;

  insert into public.meeting_processing_jobs(
    org_id, meeting_id, job_type, idempotency_key, state, stage
  ) values (
    v_meeting.org_id, p_meeting_id, 'import', v_key, 'queued', 'import'
  )
  on conflict (org_id, idempotency_key) do update
    set updated_at = public.meeting_processing_jobs.updated_at
  returning id into v_job_id;

  insert into public.meeting_audit_events(
    org_id, actor_id, action, resource_type, resource_id, correlation_id, details
  ) select v_meeting.org_id, auth.uid(), 'meeting_import_requested', 'external_meeting',
    p_meeting_id, job.correlation_id,
    jsonb_build_object('job_id', job.id, 'team_id', p_team_id)
  from public.meeting_processing_jobs job where job.id = v_job_id;

  return v_job_id;
end;
$$;

create or replace function public.receive_meeting_webhook_event_v1(
  p_connection_id uuid,
  p_provider_event_id text,
  p_event_type text,
  p_payload_hash text,
  p_payload_ref text default null,
  p_occurred_at timestamptz default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_event_id uuid;
begin
  select connection.org_id into v_org_id
  from public.meeting_connections connection
  where connection.id = p_connection_id and connection.status <> 'disabled';
  if v_org_id is null then
    raise exception using errcode = 'P0002', message = 'meeting_connection_not_found';
  end if;

  insert into public.meeting_webhook_events(
    org_id, connection_id, provider_event_id, event_type, payload_ref,
    payload_hash, occurred_at, correlation_id
  ) values (
    v_org_id, p_connection_id, btrim(p_provider_event_id), btrim(p_event_type),
    p_payload_ref, lower(p_payload_hash), p_occurred_at, p_correlation_id
  )
  on conflict (connection_id, provider_event_id) do update
    set provider_event_id = excluded.provider_event_id
  returning id into v_event_id;

  return v_event_id;
end;
$$;

create or replace function public.claim_meeting_processing_jobs_v1(
  p_worker_id text,
  p_limit integer default 10
)
returns setof public.meeting_processing_jobs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(p_worker_id), '') is null or p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'meeting_job_claim_invalid';
  end if;

  return query
  with candidates as (
    select job.id
    from public.meeting_processing_jobs job
    where job.state in ('queued', 'retry')
      and (job.next_attempt_at is null or job.next_attempt_at <= now())
      and (job.locked_at is null or job.locked_at < now() - interval '15 minutes')
    order by job.created_at
    for update skip locked
    limit p_limit
  )
  update public.meeting_processing_jobs job
  set state = 'running',
      locked_at = now(),
      locked_by = btrim(p_worker_id),
      attempt_count = job.attempt_count + 1,
      updated_at = now()
  from candidates
  where job.id = candidates.id
  returning job.*;
end;
$$;

create or replace function public.complete_meeting_processing_job_v1(
  p_job_id uuid,
  p_worker_id text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.meeting_processing_jobs job
  set state = 'succeeded', locked_at = null, locked_by = null,
      next_attempt_at = null, safe_error_code = null,
      safe_error_message = null, updated_at = now()
  where job.id = p_job_id and job.state = 'running'
    and job.locked_by = btrim(p_worker_id);
  if not found then
    raise exception using errcode = '55000', message = 'meeting_job_lock_mismatch';
  end if;
end;
$$;

create or replace function public.fail_meeting_processing_job_v1(
  p_job_id uuid,
  p_worker_id text,
  p_error_code text,
  p_safe_error_message text,
  p_recoverable boolean default true
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_state text;
begin
  update public.meeting_processing_jobs job
  set state = case
        when p_recoverable and job.attempt_count < job.max_attempts then 'retry'
        else 'dead_letter'
      end,
      next_attempt_at = case
        when p_recoverable and job.attempt_count < job.max_attempts
          then now() + make_interval(secs => least(3600, 30 * power(2, greatest(0, job.attempt_count - 1)))::integer)
        else null
      end,
      locked_at = null,
      locked_by = null,
      safe_error_code = left(nullif(btrim(p_error_code), ''), 200),
      safe_error_message = left(nullif(btrim(p_safe_error_message), ''), 1000),
      updated_at = now()
  where job.id = p_job_id and job.state = 'running'
    and job.locked_by = btrim(p_worker_id)
  returning state into v_state;

  if v_state is null then
    raise exception using errcode = '55000', message = 'meeting_job_lock_mismatch';
  end if;
  return v_state;
end;
$$;

alter table public.meeting_connections enable row level security;
alter table public.meeting_sync_cursors enable row level security;
alter table public.meeting_webhook_events enable row level security;
alter table public.external_meetings enable row level security;
alter table public.meeting_participants enable row level security;
alter table public.meeting_artifacts enable row level security;
alter table public.meeting_transcript_segments enable row level security;
alter table public.meeting_processing_jobs enable row level security;
alter table public.briefing_source_links enable row level security;
alter table public.meeting_audit_events enable row level security;

create policy meeting_connections_select on public.meeting_connections for select to authenticated
using (public.can_briefing_meeting_permission_v1(org_id, 'briefing.connections.view'));
create policy external_meetings_select on public.external_meetings for select to authenticated
using (public.can_briefing_meeting_permission_v1(org_id, 'briefing.meetings.list'));
create policy meeting_participants_select on public.meeting_participants for select to authenticated
using (public.can_briefing_meeting_permission_v1(org_id, 'briefing.meetings.list'));
create policy meeting_artifacts_select on public.meeting_artifacts for select to authenticated
using (public.can_briefing_meeting_permission_v1(org_id, 'briefing.meetings.list'));
create policy transcript_segments_select on public.meeting_transcript_segments for select to authenticated
using (public.can_briefing_meeting_permission_v1(org_id, 'briefing.meetings.list'));
create policy meeting_jobs_select on public.meeting_processing_jobs for select to authenticated
using (public.can_briefing_meeting_permission_v1(org_id, 'briefing.meetings.import'));
create policy briefing_source_links_select on public.briefing_source_links for select to authenticated
using (public.can_briefing_meeting_permission_v1(org_id, 'briefing.meetings.list'));

revoke all on table public.meeting_connections, public.meeting_sync_cursors,
  public.meeting_webhook_events, public.external_meetings, public.meeting_participants,
  public.meeting_artifacts, public.meeting_transcript_segments,
  public.meeting_processing_jobs, public.briefing_source_links,
  public.meeting_audit_events from public, anon, authenticated;

grant select on public.external_meetings, public.meeting_participants, public.meeting_artifacts,
  public.meeting_transcript_segments, public.meeting_processing_jobs,
  public.briefing_source_links to authenticated;

grant select, insert, update, delete on public.meeting_connections,
  public.meeting_sync_cursors, public.meeting_webhook_events,
  public.external_meetings, public.meeting_participants, public.meeting_artifacts,
  public.meeting_transcript_segments, public.meeting_processing_jobs,
  public.briefing_source_links, public.meeting_audit_events to service_role;

revoke all on function public.can_briefing_meeting_permission_v1(uuid,text) from public, anon;
revoke all on function public.validate_meeting_child_org_v1() from public, anon, authenticated;
revoke all on function public.validate_external_meeting_context_v1() from public, anon, authenticated;
revoke all on function public.enforce_external_meeting_state_v1() from public, anon, authenticated;
revoke all on function public.list_meeting_connections_v1(uuid) from public, anon;
revoke all on function public.request_meeting_import_v1(uuid,uuid,uuid,uuid,text) from public, anon;
revoke all on function public.receive_meeting_webhook_event_v1(uuid,text,text,text,text,timestamptz,uuid) from public, anon, authenticated;
revoke all on function public.claim_meeting_processing_jobs_v1(text,integer) from public, anon, authenticated;
revoke all on function public.complete_meeting_processing_job_v1(uuid,text) from public, anon, authenticated;
revoke all on function public.fail_meeting_processing_job_v1(uuid,text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.can_briefing_meeting_permission_v1(uuid,text) to authenticated, service_role;
grant execute on function public.list_meeting_connections_v1(uuid) to authenticated, service_role;
grant execute on function public.request_meeting_import_v1(uuid,uuid,uuid,uuid,text) to authenticated, service_role;
grant execute on function public.receive_meeting_webhook_event_v1(uuid,text,text,text,text,timestamptz,uuid) to service_role;
grant execute on function public.claim_meeting_processing_jobs_v1(text,integer) to service_role;
grant execute on function public.complete_meeting_processing_job_v1(uuid,text) to service_role;
grant execute on function public.fail_meeting_processing_job_v1(uuid,text,text,text,boolean) to service_role;

commit;
