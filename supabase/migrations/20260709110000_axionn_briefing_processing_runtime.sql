-- Axionn Briefing - persistencia transacional do processamento por IA.
-- Estas RPCs sao internas: apenas Edge Functions com service_role podem executa-las.

create or replace function public.start_ai_briefing_run(
  p_briefing_id uuid,
  p_request_id uuid,
  p_prompt_version text,
  p_schema_version text
)
returns table (
  run_id uuid,
  org_id uuid,
  project_id uuid,
  team_id uuid,
  sprint_id uuid,
  briefing_type text,
  title text,
  meeting_date timestamptz,
  source_content text,
  language text,
  participants jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_briefing public.ai_briefings%rowtype;
  v_run_id uuid;
begin
  select * into v_briefing
  from public.ai_briefings briefing
  where briefing.id = p_briefing_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'briefing_not_found';
  end if;

  if v_briefing.team_id is null then
    raise exception using errcode = '22023', message = 'briefing_team_required_for_processing';
  end if;

  if v_briefing.status not in ('draft', 'failed') then
    raise exception using errcode = '55000', message = 'briefing_not_processable';
  end if;

  insert into public.ai_briefing_runs (
    briefing_id,
    request_id,
    prompt_version,
    schema_version,
    status
  )
  values (
    v_briefing.id,
    p_request_id,
    p_prompt_version,
    p_schema_version,
    'processing'
  )
  returning id into v_run_id;

  update public.ai_briefings
  set status = 'processing'
  where id = v_briefing.id;

  return query
  select
    v_run_id,
    v_briefing.org_id,
    v_briefing.project_id,
    v_briefing.team_id,
    v_briefing.sprint_id,
    v_briefing.briefing_type,
    v_briefing.title,
    v_briefing.meeting_date,
    v_briefing.source_content,
    v_briefing.language,
    v_briefing.participants;
end;
$$;

create or replace function public.complete_ai_briefing_run(
  p_run_id uuid,
  p_provider_id uuid,
  p_model_name text,
  p_output_payload jsonb,
  p_input_tokens integer default null,
  p_output_tokens integer default null,
  p_estimated_cost numeric default null,
  p_duration_ms integer default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run public.ai_briefing_runs%rowtype;
  v_suggestion jsonb;
  v_evidence jsonb;
  v_suggestion_id uuid;
  v_ordinal integer := 0;
  v_count integer := 0;
  v_source_start integer;
  v_source_end integer;
begin
  select * into v_run
  from public.ai_briefing_runs run
  where run.id = p_run_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'briefing_run_not_found';
  end if;

  if v_run.status <> 'processing' then
    raise exception using errcode = '55000', message = 'briefing_run_not_processing';
  end if;

  if jsonb_typeof(p_output_payload) <> 'object'
     or p_output_payload ->> 'schemaVersion' <> v_run.schema_version
     or jsonb_typeof(p_output_payload -> 'suggestions') <> 'array' then
    raise exception using errcode = '22023', message = 'briefing_output_invalid';
  end if;

  for v_suggestion in
    select value from jsonb_array_elements(p_output_payload -> 'suggestions')
  loop
    if jsonb_typeof(v_suggestion) <> 'object'
       or jsonb_typeof(v_suggestion -> 'evidence') <> 'array'
       or jsonb_array_length(v_suggestion -> 'evidence') = 0 then
      raise exception using errcode = '22023', message = 'briefing_suggestion_invalid';
    end if;

    insert into public.ai_briefing_suggestions (
      briefing_id,
      run_id,
      suggestion_type,
      ordinal,
      title,
      description,
      suggested_assignee_name,
      suggested_due_date,
      date_source,
      priority_hint,
      original_payload
    )
    values (
      v_run.briefing_id,
      v_run.id,
      v_suggestion ->> 'type',
      v_ordinal,
      v_suggestion ->> 'title',
      coalesce(v_suggestion ->> 'description', ''),
      nullif(btrim(v_suggestion ->> 'assigneeName'), ''),
      nullif(v_suggestion ->> 'dueDate', '')::date,
      coalesce(v_suggestion ->> 'dateSource', 'absent'),
      nullif(v_suggestion ->> 'priority', ''),
      v_suggestion - 'evidence'
    )
    returning id into v_suggestion_id;

    for v_evidence in
      select value from jsonb_array_elements(v_suggestion -> 'evidence')
    loop
      v_source_start := case
        when jsonb_typeof(v_evidence -> 'sourceStart') = 'number'
          then (v_evidence ->> 'sourceStart')::integer
        else null
      end;
      v_source_end := case
        when jsonb_typeof(v_evidence -> 'sourceEnd') = 'number'
          then (v_evidence ->> 'sourceEnd')::integer
        else null
      end;

      insert into public.ai_suggestion_evidence (
        suggestion_id,
        quote_text,
        speaker_name,
        source_start,
        source_end,
        timestamp_start,
        timestamp_end
      )
      values (
        v_suggestion_id,
        v_evidence ->> 'quote',
        nullif(btrim(v_evidence ->> 'speaker'), ''),
        v_source_start,
        v_source_end,
        nullif(btrim(v_evidence ->> 'timestampStart'), ''),
        nullif(btrim(v_evidence ->> 'timestampEnd'), '')
      );
    end loop;

    v_ordinal := v_ordinal + 1;
    v_count := v_count + 1;
  end loop;

  update public.ai_briefing_runs
  set provider_id = p_provider_id,
      model_name = p_model_name,
      status = 'success',
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      estimated_cost = p_estimated_cost,
      duration_ms = p_duration_ms,
      output_payload = p_output_payload,
      completed_at = now(),
      error_code = null,
      error_detail = null
  where id = v_run.id;

  update public.ai_briefings
  set status = 'ready_for_review',
      language = coalesce(nullif(p_output_payload ->> 'language', ''), language)
  where id = v_run.briefing_id;

  return v_count;
end;
$$;

create or replace function public.fail_ai_briefing_run(
  p_run_id uuid,
  p_error_code text,
  p_error_detail text default null,
  p_provider_id uuid default null,
  p_model_name text default null,
  p_duration_ms integer default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_briefing_id uuid;
begin
  update public.ai_briefing_runs
  set provider_id = p_provider_id,
      model_name = p_model_name,
      status = 'failed',
      error_code = left(coalesce(nullif(btrim(p_error_code), ''), 'briefing_processing_failed'), 120),
      error_detail = left(p_error_detail, 2000),
      duration_ms = p_duration_ms,
      completed_at = now()
  where id = p_run_id
    and status = 'processing'
  returning briefing_id into v_briefing_id;

  if v_briefing_id is not null then
    update public.ai_briefings
    set status = 'failed'
    where id = v_briefing_id;
  end if;
end;
$$;

revoke all on function public.start_ai_briefing_run(uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.complete_ai_briefing_run(
  uuid, uuid, text, jsonb, integer, integer, numeric, integer
) from public, anon, authenticated;
revoke all on function public.fail_ai_briefing_run(
  uuid, text, text, uuid, text, integer
) from public, anon, authenticated;

grant execute on function public.start_ai_briefing_run(uuid, uuid, text, text)
  to service_role;
grant execute on function public.complete_ai_briefing_run(
  uuid, uuid, text, jsonb, integer, integer, numeric, integer
) to service_role;
grant execute on function public.fail_ai_briefing_run(
  uuid, text, text, uuid, text, integer
) to service_role;

comment on function public.start_ai_briefing_run(uuid, uuid, text, text) is
  'Reivindica um briefing para processamento e cria uma execucao de forma atomica.';
comment on function public.complete_ai_briefing_run(
  uuid, uuid, text, jsonb, integer, integer, numeric, integer
) is
  'Persiste analise, sugestoes e evidencias em uma unica transacao.';
