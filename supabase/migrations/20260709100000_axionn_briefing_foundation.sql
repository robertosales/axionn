-- Axionn Briefing - fundacao do dominio de memoria operacional assistida.
-- A IA produz rascunhos com evidencias; somente revisoes humanas podem ser aplicadas.

create table if not exists public.ai_briefings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  sprint_id uuid references public.sprints(id) on delete set null,
  briefing_type text not null
    check (briefing_type in ('daily', 'planning', 'review', 'retro', 'discovery', 'free')),
  title text not null check (char_length(btrim(title)) between 3 and 200),
  meeting_date timestamptz,
  source_type text not null default 'pasted_text'
    check (source_type in ('pasted_text', 'manual_notes', 'text_file', 'markdown_file')),
  source_content text not null check (char_length(btrim(source_content)) between 20 and 120000),
  source_hash text not null,
  language text,
  participants jsonb not null default '[]'::jsonb
    check (jsonb_typeof(participants) = 'array'),
  status text not null default 'draft'
    check (status in (
      'draft', 'processing', 'ready_for_review', 'partially_applied',
      'applied', 'failed', 'archived'
    )),
  retention_until timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (language is null or language ~ '^[a-z]{2}(-[A-Z]{2})?$')
);

create table if not exists public.ai_briefing_runs (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references public.ai_briefings(id) on delete cascade,
  request_id uuid not null unique,
  provider_id uuid references public.ai_providers(id) on delete set null,
  model_name text,
  prompt_version text not null,
  schema_version text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'success', 'failed')),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost numeric(14,6) check (estimated_cost is null or estimated_cost >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  error_code text,
  error_detail text,
  output_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (output_payload is null or jsonb_typeof(output_payload) = 'object')
);

create table if not exists public.ai_briefing_suggestions (
  id uuid primary key default gen_random_uuid(),
  briefing_id uuid not null references public.ai_briefings(id) on delete cascade,
  run_id uuid not null references public.ai_briefing_runs(id) on delete cascade,
  suggestion_type text not null
    check (suggestion_type in (
      'decision', 'action', 'impediment', 'risk', 'open_question', 'backlog_candidate'
    )),
  ordinal integer not null check (ordinal >= 0),
  title text not null check (char_length(btrim(title)) between 3 and 240),
  description text not null default '',
  suggested_assignee_id uuid references auth.users(id) on delete set null,
  suggested_assignee_name text,
  suggested_due_date date,
  date_source text not null default 'absent'
    check (date_source in ('explicit', 'inferred', 'absent')),
  priority_hint text
    check (priority_hint is null or priority_hint in ('low', 'medium', 'high', 'urgent')),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'edited', 'rejected', 'applied')),
  original_payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(original_payload) = 'object'),
  reviewed_payload jsonb,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, suggestion_type, ordinal),
  check (reviewed_payload is null or jsonb_typeof(reviewed_payload) = 'object'),
  check (
    (review_status = 'pending' and reviewed_by is null and reviewed_at is null)
    or
    (review_status <> 'pending' and reviewed_by is not null and reviewed_at is not null)
  )
);

create table if not exists public.ai_suggestion_evidence (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.ai_briefing_suggestions(id) on delete cascade,
  quote_text text not null check (char_length(btrim(quote_text)) between 1 and 4000),
  speaker_name text,
  source_start integer,
  source_end integer,
  timestamp_start text,
  timestamp_end text,
  created_at timestamptz not null default now(),
  check (
    (source_start is null and source_end is null)
    or
    (source_start is not null and source_end is not null
      and source_start >= 0 and source_end > source_start)
  )
);

create table if not exists public.ai_suggestion_applications (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null unique
    references public.ai_briefing_suggestions(id) on delete restrict,
  target_type text not null
    check (target_type in ('user_story', 'activity', 'impediment', 'decision_record')),
  target_id uuid not null,
  applied_by uuid not null references auth.users(id) on delete restrict,
  application_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(application_snapshot) = 'object'),
  applied_at timestamptz not null default now()
);

create index if not exists idx_ai_briefings_org_created
  on public.ai_briefings(org_id, created_at desc);
create index if not exists idx_ai_briefings_team_sprint
  on public.ai_briefings(team_id, sprint_id, created_at desc);
create index if not exists idx_ai_briefings_project
  on public.ai_briefings(project_id, created_at desc)
  where project_id is not null;
create index if not exists idx_ai_briefing_runs_briefing
  on public.ai_briefing_runs(briefing_id, created_at desc);
create index if not exists idx_ai_briefing_suggestions_review
  on public.ai_briefing_suggestions(briefing_id, review_status, ordinal);
create index if not exists idx_ai_suggestion_evidence_suggestion
  on public.ai_suggestion_evidence(suggestion_id);
create index if not exists idx_ai_suggestion_applications_target
  on public.ai_suggestion_applications(target_type, target_id);

create or replace function public.touch_ai_briefing_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.validate_ai_briefing_context()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_context_org_id uuid;
  v_team_id uuid;
begin
  if new.project_id is not null then
    select public.resolve_project_org_id(new.project_id), project.team_id
      into v_context_org_id, v_team_id
    from public.projects project
    where project.id = new.project_id;

    if v_context_org_id is distinct from new.org_id then
      raise exception using errcode = '23514', message = 'briefing_project_org_mismatch';
    end if;

    if new.team_id is not null and v_team_id is not null and v_team_id <> new.team_id then
      raise exception using errcode = '23514', message = 'briefing_project_team_mismatch';
    end if;
  end if;

  if new.team_id is not null then
    select public.resolve_team_org_id(new.team_id)
      into v_context_org_id;

    if v_context_org_id is distinct from new.org_id then
      raise exception using errcode = '23514', message = 'briefing_team_org_mismatch';
    end if;
  end if;

  if new.sprint_id is not null then
    select sprint.team_id into v_team_id
    from public.sprints sprint
    where sprint.id = new.sprint_id;

    if new.team_id is null or v_team_id is distinct from new.team_id then
      raise exception using errcode = '23514', message = 'briefing_sprint_team_mismatch';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ai_briefings_updated_at on public.ai_briefings;
create trigger trg_ai_briefings_updated_at
before update on public.ai_briefings
for each row execute function public.touch_ai_briefing_updated_at();

drop trigger if exists trg_ai_briefing_suggestions_updated_at on public.ai_briefing_suggestions;
create trigger trg_ai_briefing_suggestions_updated_at
before update on public.ai_briefing_suggestions
for each row execute function public.touch_ai_briefing_updated_at();

drop trigger if exists trg_ai_briefings_context on public.ai_briefings;
create trigger trg_ai_briefings_context
before insert or update of org_id, project_id, team_id, sprint_id
on public.ai_briefings
for each row execute function public.validate_ai_briefing_context();

create or replace function public.create_ai_briefing(
  p_org_id uuid,
  p_briefing_type text,
  p_title text,
  p_source_content text,
  p_source_hash text,
  p_project_id uuid default null,
  p_team_id uuid default null,
  p_sprint_id uuid default null,
  p_meeting_date timestamptz default null,
  p_source_type text default 'pasted_text',
  p_language text default null,
  p_participants jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.is_organization_member(p_org_id, auth.uid()) then
    raise exception using errcode = '42501', message = 'briefing_access_denied';
  end if;

  if not public.has_organization_entitlement(p_org_id, 'ai.briefing.enabled') then
    raise exception using errcode = '42501', message = 'briefing_entitlement_required';
  end if;

  if p_team_id is not null
     and not public.is_organization_admin(p_org_id, auth.uid())
     and not exists (
       select 1 from public.team_members member
       where member.team_id = p_team_id and member.user_id = auth.uid()
     ) then
    raise exception using errcode = '42501', message = 'briefing_team_access_denied';
  end if;

  insert into public.ai_briefings (
    org_id, project_id, team_id, sprint_id, briefing_type, title,
    meeting_date, source_type, source_content, source_hash, language,
    participants, created_by
  )
  values (
    p_org_id, p_project_id, p_team_id, p_sprint_id, p_briefing_type,
    btrim(p_title), p_meeting_date, p_source_type, btrim(p_source_content),
    p_source_hash, p_language, coalesce(p_participants, '[]'::jsonb), auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.review_ai_briefing_suggestion(
  p_suggestion_id uuid,
  p_review_status text,
  p_reviewed_payload jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_current_status text;
begin
  if p_review_status not in ('approved', 'edited', 'rejected') then
    raise exception using errcode = '22023', message = 'briefing_review_status_invalid';
  end if;

  select briefing.org_id, suggestion.review_status
    into v_org_id, v_current_status
  from public.ai_briefing_suggestions suggestion
  join public.ai_briefings briefing on briefing.id = suggestion.briefing_id
  where suggestion.id = p_suggestion_id
  for update of suggestion;

  if not found then
    raise exception using errcode = 'P0002', message = 'briefing_suggestion_not_found';
  end if;

  if auth.uid() is null or not public.is_organization_member(v_org_id, auth.uid()) then
    raise exception using errcode = '42501', message = 'briefing_review_access_denied';
  end if;

  if v_current_status = 'applied' then
    raise exception using errcode = '22023', message = 'briefing_suggestion_already_applied';
  end if;

  if p_review_status = 'edited' and p_reviewed_payload is null then
    raise exception using errcode = '22023', message = 'briefing_review_payload_required';
  end if;

  update public.ai_briefing_suggestions
  set review_status = p_review_status,
      reviewed_payload = case
        when p_review_status = 'edited' then p_reviewed_payload
        else null
      end,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_suggestion_id;
end;
$$;

alter table public.ai_briefings enable row level security;
alter table public.ai_briefing_runs enable row level security;
alter table public.ai_briefing_suggestions enable row level security;
alter table public.ai_suggestion_evidence enable row level security;
alter table public.ai_suggestion_applications enable row level security;

create policy ai_briefings_member_select on public.ai_briefings
for select to authenticated
using (
  public.is_organization_member(org_id, auth.uid())
  and (
    team_id is null
    or public.is_organization_admin(org_id, auth.uid())
    or exists (
      select 1 from public.team_members member
      where member.team_id = ai_briefings.team_id
        and member.user_id = auth.uid()
    )
  )
);

create policy ai_briefing_runs_member_select on public.ai_briefing_runs
for select to authenticated
using (
  exists (
    select 1 from public.ai_briefings briefing
    where briefing.id = ai_briefing_runs.briefing_id
  )
);

create policy ai_briefing_suggestions_member_select on public.ai_briefing_suggestions
for select to authenticated
using (
  exists (
    select 1 from public.ai_briefings briefing
    where briefing.id = ai_briefing_suggestions.briefing_id
  )
);

create policy ai_suggestion_evidence_member_select on public.ai_suggestion_evidence
for select to authenticated
using (
  exists (
    select 1
    from public.ai_briefing_suggestions suggestion
    join public.ai_briefings briefing on briefing.id = suggestion.briefing_id
    where suggestion.id = ai_suggestion_evidence.suggestion_id
  )
);

create policy ai_suggestion_applications_member_select on public.ai_suggestion_applications
for select to authenticated
using (
  exists (
    select 1
    from public.ai_briefing_suggestions suggestion
    join public.ai_briefings briefing on briefing.id = suggestion.briefing_id
    where suggestion.id = ai_suggestion_applications.suggestion_id
  )
);

revoke all on table public.ai_briefings from public, anon, authenticated;
revoke all on table public.ai_briefing_runs from public, anon, authenticated;
revoke all on table public.ai_briefing_suggestions from public, anon, authenticated;
revoke all on table public.ai_suggestion_evidence from public, anon, authenticated;
revoke all on table public.ai_suggestion_applications from public, anon, authenticated;

grant select on table public.ai_briefings to authenticated;
grant select on table public.ai_briefing_runs to authenticated;
grant select on table public.ai_briefing_suggestions to authenticated;
grant select on table public.ai_suggestion_evidence to authenticated;
grant select on table public.ai_suggestion_applications to authenticated;
grant all on table public.ai_briefings to service_role;
grant all on table public.ai_briefing_runs to service_role;
grant all on table public.ai_briefing_suggestions to service_role;
grant all on table public.ai_suggestion_evidence to service_role;
grant all on table public.ai_suggestion_applications to service_role;

revoke all on function public.touch_ai_briefing_updated_at()
  from public, anon, authenticated;
revoke all on function public.validate_ai_briefing_context()
  from public, anon, authenticated;
revoke all on function public.create_ai_briefing(
  uuid, text, text, text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb
) from public, anon;
revoke all on function public.review_ai_briefing_suggestion(uuid, text, jsonb)
  from public, anon;

grant execute on function public.create_ai_briefing(
  uuid, text, text, text, text, uuid, uuid, uuid, timestamptz, text, text, jsonb
) to authenticated, service_role;
grant execute on function public.review_ai_briefing_suggestion(uuid, text, jsonb)
  to authenticated, service_role;

with briefing_entitlements(plan_code, enabled, monthly_limit, max_chars) as (
  values
    ('starter', true, 5::bigint, 30000::bigint),
    ('pro', true, 100::bigint, 60000::bigint),
    ('enterprise', true, null::bigint, 120000::bigint)
)
insert into public.saas_plan_entitlements (plan_id, feature_key, enabled, limit_value)
select plan.id, entitlement.feature_key, entitlement.enabled, entitlement.limit_value
from briefing_entitlements seed
join public.saas_plans plan on plan.code = seed.plan_code
cross join lateral (
  values
    ('ai.briefing.enabled'::text, seed.enabled, null::bigint),
    ('ai.briefing.runs.monthly'::text, true, seed.monthly_limit),
    ('ai.briefing.max_input_chars'::text, true, seed.max_chars)
) entitlement(feature_key, enabled, limit_value)
on conflict (plan_id, feature_key) do update
set enabled = excluded.enabled,
    limit_value = excluded.limit_value,
    updated_at = now();

comment on table public.ai_briefings is
  'Entrada contextual do Axionn Briefing, vinculada a uma unica organizacao.';
comment on table public.ai_briefing_suggestions is
  'Unidades de trabalho sugeridas pela IA e obrigatoriamente revisaveis.';
comment on table public.ai_suggestion_evidence is
  'Trechos da fonte que sustentam cada sugestao do briefing.';
comment on table public.ai_suggestion_applications is
  'Registro idempotente do objeto de dominio criado a partir de uma sugestao aprovada.';
