-- Axionn Briefing - acompanhamento deterministico de pendencias por equipe.

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
  v_due_date date;
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

  if p_review_status = 'edited' then
    if jsonb_typeof(p_reviewed_payload) <> 'object'
       or char_length(btrim(coalesce(p_reviewed_payload ->> 'title', ''))) not between 3 and 240
       or coalesce(p_reviewed_payload ->> 'dateSource', '') not in ('explicit', 'inferred', 'absent')
       or (
         p_reviewed_payload ? 'priority'
         and p_reviewed_payload ->> 'priority' is not null
         and p_reviewed_payload ->> 'priority' not in ('low', 'medium', 'high', 'urgent')
       ) then
      raise exception using errcode = '22023', message = 'briefing_review_payload_invalid';
    end if;

    if nullif(p_reviewed_payload ->> 'dueDate', '') is not null then
      begin
        v_due_date := (p_reviewed_payload ->> 'dueDate')::date;
      exception when others then
        raise exception using errcode = '22023', message = 'briefing_review_due_date_invalid';
      end;
    end if;

    if (p_reviewed_payload ->> 'dateSource' = 'absent' and v_due_date is not null)
       or (p_reviewed_payload ->> 'dateSource' <> 'absent' and v_due_date is null) then
      raise exception using errcode = '22023', message = 'briefing_review_due_date_inconsistent';
    end if;
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

create or replace function public.get_ai_briefing_team_followup(
  p_team_id uuid
)
returns table (
  team_id uuid,
  total_briefings bigint,
  pending_review bigint,
  ready_to_apply bigint,
  applied_items bigint,
  overdue_items bigint,
  attention_items jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
begin
  v_org_id := public.resolve_team_org_id(p_team_id);

  if v_org_id is null then
    raise exception using errcode = 'P0002', message = 'briefing_followup_team_not_found';
  end if;

  if auth.uid() is null
     or not public.is_organization_member(v_org_id, auth.uid()) then
    raise exception using errcode = '42501', message = 'briefing_followup_access_denied';
  end if;

  if not public.is_organization_admin(v_org_id, auth.uid())
     and not exists (
       select 1 from public.team_members member
       where member.team_id = p_team_id
         and member.user_id = auth.uid()
     ) then
    raise exception using errcode = '42501', message = 'briefing_followup_team_access_denied';
  end if;

  return query
  with scoped_briefings as (
    select briefing.id, briefing.title, briefing.meeting_date, briefing.created_at
    from public.ai_briefings briefing
    where briefing.team_id = p_team_id
      and briefing.status <> 'archived'
  ),
  scoped_suggestions as (
    select
      suggestion.id,
      suggestion.briefing_id,
      suggestion.suggestion_type,
      suggestion.title,
      suggestion.review_status,
      case
        when suggestion.review_status = 'edited'
          then nullif(suggestion.reviewed_payload ->> 'dueDate', '')::date
        else suggestion.suggested_due_date
      end as due_date
    from public.ai_briefing_suggestions suggestion
    join scoped_briefings briefing on briefing.id = suggestion.briefing_id
  ),
  metrics as (
    select
      (select count(*) from scoped_briefings) as total_briefings,
      count(*) filter (
        where suggestion.review_status = 'pending'
      ) as pending_review,
      count(*) filter (
        where suggestion.review_status in ('approved', 'edited')
          and suggestion.suggestion_type in (
            'action', 'backlog_candidate', 'impediment'
          )
      ) as ready_to_apply,
      count(*) filter (
        where suggestion.review_status = 'applied'
      ) as applied_items,
      count(*) filter (
        where suggestion.review_status in ('pending', 'approved', 'edited')
          and suggestion.due_date < current_date
      ) as overdue_items
    from scoped_suggestions suggestion
  ),
  attention as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'suggestion_id', item.id,
          'briefing_id', item.briefing_id,
          'briefing_title', item.briefing_title,
          'suggestion_type', item.suggestion_type,
          'title', item.title,
          'review_status', item.review_status,
          'due_date', item.due_date
        )
        order by item.due_date, item.title
      ),
      '[]'::jsonb
    ) as items
    from (
      select
        suggestion.id,
        suggestion.briefing_id,
        briefing.title as briefing_title,
        suggestion.suggestion_type,
        suggestion.title,
        suggestion.review_status,
        suggestion.due_date
      from scoped_suggestions suggestion
      join scoped_briefings briefing on briefing.id = suggestion.briefing_id
      where suggestion.review_status in ('pending', 'approved', 'edited')
        and suggestion.due_date < current_date
      order by suggestion.due_date, suggestion.title
      limit 10
    ) item
  )
  select
    p_team_id,
    metrics.total_briefings,
    metrics.pending_review,
    metrics.ready_to_apply,
    metrics.applied_items,
    metrics.overdue_items,
    attention.items
  from metrics
  cross join attention;
end;
$$;

revoke all on function public.get_ai_briefing_team_followup(uuid)
  from public, anon;
grant execute on function public.get_ai_briefing_team_followup(uuid)
  to authenticated, service_role;

comment on function public.get_ai_briefing_team_followup(uuid) is
  'Resume pendencias, aplicacoes e compromissos vencidos dos briefings acessiveis da equipe.';
