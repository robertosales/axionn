-- Axionn Briefing - aplicacao controlada de sugestoes aprovadas.

create or replace function public.apply_ai_briefing_suggestion(
  p_suggestion_id uuid
)
returns table (
  application_id uuid,
  target_type text,
  target_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_suggestion public.ai_briefing_suggestions%rowtype;
  v_briefing public.ai_briefings%rowtype;
  v_payload jsonb;
  v_target_type text;
  v_target_id uuid;
  v_application_id uuid;
  v_status text;
  v_priority text;
  v_due_date date;
begin
  select * into v_suggestion
  from public.ai_briefing_suggestions suggestion
  where suggestion.id = p_suggestion_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'briefing_suggestion_not_found';
  end if;

  select * into v_briefing
  from public.ai_briefings briefing
  where briefing.id = v_suggestion.briefing_id
  for update;

  if auth.uid() is null
     or not public.is_organization_member(v_briefing.org_id, auth.uid()) then
    raise exception using errcode = '42501', message = 'briefing_apply_access_denied';
  end if;

  if v_briefing.team_id is null then
    raise exception using errcode = '22023', message = 'briefing_apply_team_required';
  end if;

  if not public.is_organization_admin(v_briefing.org_id, auth.uid())
     and not exists (
       select 1 from public.team_members member
       where member.team_id = v_briefing.team_id
         and member.user_id = auth.uid()
     ) then
    raise exception using errcode = '42501', message = 'briefing_apply_team_access_denied';
  end if;

  if not public.has_organization_entitlement(
    v_briefing.org_id,
    'ai.briefing.apply_actions'
  ) then
    raise exception using errcode = '42501', message = 'briefing_apply_entitlement_required';
  end if;

  if v_suggestion.review_status not in ('approved', 'edited', 'applied') then
    raise exception using errcode = '22023', message = 'briefing_suggestion_requires_approval';
  end if;

  select application.id, application.target_type, application.target_id
    into v_application_id, v_target_type, v_target_id
  from public.ai_suggestion_applications application
  where application.suggestion_id = v_suggestion.id;

  if found then
    return query select v_application_id, v_target_type, v_target_id;
    return;
  end if;

  if v_suggestion.suggestion_type not in (
    'action', 'backlog_candidate', 'impediment'
  ) then
    raise exception using errcode = '22023', message = 'briefing_suggestion_not_applicable';
  end if;

  v_payload := case
    when v_suggestion.review_status = 'edited'
      then coalesce(v_suggestion.reviewed_payload, v_suggestion.original_payload)
    else v_suggestion.original_payload
  end;

  if v_suggestion.suggestion_type in ('action', 'backlog_candidate') then
    if v_briefing.sprint_id is null then
      raise exception using errcode = '22023', message = 'briefing_apply_sprint_required';
    end if;

    select workflow.key into v_status
    from public.workflow_columns workflow
    where workflow.team_id = v_briefing.team_id
    order by workflow.sort_order, workflow.id
    limit 1;

    v_status := coalesce(v_status, 'aguardando_desenvolvimento');
    v_priority := case coalesce(v_payload ->> 'priority', v_suggestion.priority_hint)
      when 'low' then 'baixa'
      when 'high' then 'alta'
      when 'urgent' then 'critica'
      else 'media'
    end;
    v_due_date := nullif(
      coalesce(v_payload ->> 'dueDate', v_suggestion.suggested_due_date::text),
      ''
    )::date;

    insert into public.user_stories (
      team_id,
      sprint_id,
      code,
      title,
      description,
      story_points,
      priority,
      status,
      position,
      end_date,
      custom_fields
    )
    values (
      v_briefing.team_id,
      v_briefing.sprint_id,
      '',
      coalesce(nullif(btrim(v_payload ->> 'title'), ''), v_suggestion.title),
      coalesce(v_payload ->> 'description', v_suggestion.description, ''),
      0,
      v_priority,
      v_status,
      coalesce((
        select max(story.position) + 1
        from public.user_stories story
        where story.team_id = v_briefing.team_id
          and story.status = v_status
      ), 0),
      v_due_date,
      jsonb_build_object(
        'source', 'axionn_briefing',
        'briefing_id', v_briefing.id,
        'suggestion_id', v_suggestion.id,
        'suggestion_type', v_suggestion.suggestion_type
      )
    )
    returning id into v_target_id;

    v_target_type := 'user_story';
  else
    if v_briefing.sprint_id is null then
      raise exception using errcode = '22023', message = 'briefing_apply_sprint_required';
    end if;

    v_priority := case coalesce(v_payload ->> 'priority', v_suggestion.priority_hint)
      when 'low' then 'baixa'
      when 'high' then 'alta'
      when 'urgent' then 'critica'
      else 'media'
    end;

    insert into public.impediments (
      team_id,
      hu_id,
      sprint_id,
      reason,
      type,
      criticality,
      has_ticket
    )
    values (
      v_briefing.team_id,
      null,
      v_briefing.sprint_id,
      concat_ws(
        E'\n\n',
        coalesce(nullif(btrim(v_payload ->> 'title'), ''), v_suggestion.title),
        nullif(btrim(coalesce(v_payload ->> 'description', v_suggestion.description)), '')
      ),
      'outro',
      v_priority,
      false
    )
    returning id into v_target_id;

    v_target_type := 'impediment';
  end if;

  insert into public.ai_suggestion_applications (
    suggestion_id,
    target_type,
    target_id,
    applied_by,
    application_snapshot
  )
  values (
    v_suggestion.id,
    v_target_type,
    v_target_id,
    auth.uid(),
    jsonb_build_object(
      'payload', v_payload,
      'briefing_id', v_briefing.id,
      'team_id', v_briefing.team_id,
      'sprint_id', v_briefing.sprint_id
    )
  )
  returning id into v_application_id;

  update public.ai_briefing_suggestions
  set review_status = 'applied'
  where id = v_suggestion.id;

  update public.ai_briefings
  set status = case
    when exists (
      select 1
      from public.ai_briefing_suggestions pending
      where pending.briefing_id = v_briefing.id
        and pending.id <> v_suggestion.id
        and pending.review_status in ('approved', 'edited')
        and pending.suggestion_type in ('action', 'backlog_candidate', 'impediment')
    ) then 'partially_applied'
    else 'applied'
  end
  where id = v_briefing.id;

  return query select v_application_id, v_target_type, v_target_id;
end;
$$;

revoke all on function public.apply_ai_briefing_suggestion(uuid)
  from public, anon;
grant execute on function public.apply_ai_briefing_suggestion(uuid)
  to authenticated, service_role;

with apply_entitlements(plan_code, enabled) as (
  values
    ('starter', false),
    ('pro', true),
    ('enterprise', true)
)
insert into public.saas_plan_entitlements (
  plan_id,
  feature_key,
  enabled,
  limit_value
)
select
  plan.id,
  'ai.briefing.apply_actions',
  entitlement.enabled,
  null
from apply_entitlements entitlement
join public.saas_plans plan on plan.code = entitlement.plan_code
on conflict (plan_id, feature_key) do update
set enabled = excluded.enabled,
    limit_value = excluded.limit_value,
    updated_at = now();

comment on function public.apply_ai_briefing_suggestion(uuid) is
  'Aplica uma sugestao aprovada como HU ou impedimento, com idempotencia e auditoria.';
