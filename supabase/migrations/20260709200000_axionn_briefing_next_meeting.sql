-- Axionn Briefing - preparacao automatica da proxima reuniao.
-- Usa briefings anteriores para montar uma pauta com:
-- - acoes abertas
-- - impedimentos nao resolvidos
-- - itens vencidos
-- - decisoes pendentes
-- - sugestoes nao revisadas
-- - pontos que precisam voltar para discussao

create or replace function public.generate_briefing_agenda(
  p_team_id uuid,
  p_briefing_type text default 'daily',
  p_limit integer default 15
)
returns table (
  section text,
  ordinal integer,
  title text,
  description text,
  source_briefing_id uuid,
  source_briefing_title text,
  suggestion_type text,
  due_date date,
  priority_hint text
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
    raise exception using errcode = 'P0002', message = 'briefing_agenda_team_not_found';
  end if;

  if auth.uid() is null
     or not public.is_organization_member(v_org_id, auth.uid()) then
    raise exception using errcode = '42501', message = 'briefing_agenda_access_denied';
  end if;

  if not public.is_organization_admin(v_org_id, auth.uid())
     and not exists (
       select 1 from public.team_members member
       where member.team_id = p_team_id
         and member.user_id = auth.uid()
     ) then
    raise exception using errcode = '42501', message = 'briefing_agenda_team_access_denied';
  end if;

  return query
  with scoped_briefings as (
    select briefing.id, briefing.title, briefing.meeting_date, briefing.created_at
    from public.ai_briefings briefing
    where briefing.team_id = p_team_id
      and briefing.status not in ('archived', 'failed', 'draft')
  ),
  scoped_suggestions as (
    select
      suggestion.id,
      suggestion.briefing_id,
      suggestion.suggestion_type,
      suggestion.title,
      suggestion.description,
      suggestion.review_status,
      case
        when suggestion.review_status = 'edited'
          then nullif(suggestion.reviewed_payload ->> 'dueDate', '')::date
        else suggestion.suggested_due_date
      end as due_date,
      suggestion.priority_hint
    from public.ai_briefing_suggestions suggestion
    join scoped_briefings briefing on briefing.id = suggestion.briefing_id
  ),
  sections as (
    select
      'Acoes abertas' as section,
      1 as section_ordinal,
      suggestion.title,
      suggestion.description,
      suggestion.briefing_id,
      briefing.title as source_title,
      suggestion.suggestion_type,
      suggestion.due_date,
      suggestion.priority_hint
    from scoped_suggestions suggestion
    join scoped_briefings briefing on briefing.id = suggestion.briefing_id
    where suggestion.suggestion_type = 'action'
      and suggestion.review_status in ('pending', 'approved', 'edited')

    union all

    select
      'Impedimentos pendentes',
      2,
      suggestion.title,
      suggestion.description,
      suggestion.briefing_id,
      briefing.title,
      suggestion.suggestion_type,
      suggestion.due_date,
      suggestion.priority_hint
    from scoped_suggestions suggestion
    join scoped_briefings briefing on briefing.id = suggestion.briefing_id
    where suggestion.suggestion_type = 'impediment'
      and suggestion.review_status in ('pending', 'approved', 'edited')

    union all

    select
      'Itens vencidos',
      3,
      suggestion.title,
      suggestion.description,
      suggestion.briefing_id,
      briefing.title,
      suggestion.suggestion_type,
      suggestion.due_date,
      suggestion.priority_hint
    from scoped_suggestions suggestion
    join scoped_briefings briefing on briefing.id = suggestion.briefing_id
    where suggestion.due_date is not null
      and suggestion.due_date < current_date
      and suggestion.review_status in ('pending', 'approved', 'edited')

    union all

    select
      'Decisoes pendentes',
      4,
      suggestion.title,
      suggestion.description,
      suggestion.briefing_id,
      briefing.title,
      suggestion.suggestion_type,
      suggestion.due_date,
      suggestion.priority_hint
    from scoped_suggestions suggestion
    join scoped_briefings briefing on briefing.id = suggestion.briefing_id
    where suggestion.suggestion_type = 'decision'
      and suggestion.review_status = 'pending'

    union all

    select
      'Perguntas em aberto',
      5,
      suggestion.title,
      suggestion.description,
      suggestion.briefing_id,
      briefing.title,
      suggestion.suggestion_type,
      suggestion.due_date,
      suggestion.priority_hint
    from scoped_suggestions suggestion
    join scoped_briefings briefing on briefing.id = suggestion.briefing_id
    where suggestion.suggestion_type = 'open_question'
      and suggestion.review_status = 'pending'

    union all

    select
      'Candidatos ao backlog',
      6,
      suggestion.title,
      suggestion.description,
      suggestion.briefing_id,
      briefing.title,
      suggestion.suggestion_type,
      suggestion.due_date,
      suggestion.priority_hint
    from scoped_suggestions suggestion
    join scoped_briefings briefing on briefing.id = suggestion.briefing_id
    where suggestion.suggestion_type = 'backlog_candidate'
      and suggestion.review_status = 'pending'
  )
  select
    sections.section,
    row_number() over (
      partition by sections.section_ordinal
      order by sections.due_date nulls last, sections.title
    )::integer as ordinal,
    sections.title,
    sections.description,
    sections.briefing_id,
    sections.source_title,
    sections.suggestion_type,
    sections.due_date,
    sections.priority_hint
  from sections
  order by sections.section_ordinal, ordinal
  limit p_limit;
end;
$$;

revoke all on function public.generate_briefing_agenda(uuid, text, integer)
  from public, anon;
grant execute on function public.generate_briefing_agenda(uuid, text, integer)
  to authenticated, service_role;

comment on function public.generate_briefing_agenda(uuid, text, integer) is
  'Monta pauta automatica para a proxima reuniao com base em briefings anteriores da equipe.';
