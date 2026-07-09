-- Axionn Briefing - acompanha o resultado real dos itens aplicados.

create or replace function public.get_ai_briefing_team_outcomes(
  p_team_id uuid
)
returns table (
  total_applied bigint,
  open_items bigint,
  completed_items bigint,
  overdue_items bigint,
  missing_items bigint
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
    raise exception using errcode = 'P0002', message = 'briefing_outcomes_team_not_found';
  end if;

  if not public.can_access_ai_briefing(v_org_id, p_team_id) then
    raise exception using errcode = '42501', message = 'briefing_outcomes_access_denied';
  end if;

  return query
  with applied as (
    select
      application.target_type,
      application.target_id,
      case
        when suggestion.review_status = 'edited'
          then nullif(suggestion.reviewed_payload ->> 'dueDate', '')::date
        else suggestion.suggested_due_date
      end as due_date
    from public.ai_suggestion_applications application
    join public.ai_briefing_suggestions suggestion
      on suggestion.id = application.suggestion_id
    join public.ai_briefings briefing
      on briefing.id = suggestion.briefing_id
    where briefing.team_id = p_team_id
  ),
  outcome as (
    select
      applied.due_date,
      (
        applied.target_type = 'user_story'
        and story.id is not null
        and lower(story.status) in (
          'concluido', 'concluida', 'done', 'aceite',
          'aceite_final', 'ag_aceite_final', 'resolvido'
        )
      ) or (
        applied.target_type = 'impediment'
        and impediment.id is not null
        and impediment.resolved_at is not null
      ) as completed,
      case applied.target_type
        when 'user_story' then story.id is null
        when 'impediment' then impediment.id is null
        else true
      end as missing
    from applied
    left join public.user_stories story
      on applied.target_type = 'user_story'
     and story.id = applied.target_id
    left join public.impediments impediment
      on applied.target_type = 'impediment'
     and impediment.id = applied.target_id
  )
  select
    count(*) as total_applied,
    count(*) filter (where not completed and not missing) as open_items,
    count(*) filter (where completed and not missing) as completed_items,
    count(*) filter (
      where not completed and not missing and due_date < current_date
    ) as overdue_items,
    count(*) filter (where missing) as missing_items
  from outcome;
end;
$$;

revoke all on function public.get_ai_briefing_team_outcomes(uuid)
  from public, anon;
grant execute on function public.get_ai_briefing_team_outcomes(uuid)
  to authenticated, service_role;

comment on function public.get_ai_briefing_team_outcomes(uuid) is
  'Resume itens aplicados pelo Briefing que seguem abertos, concluidos, vencidos ou removidos.';
