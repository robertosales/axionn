-- Axionn Briefing - associacao humana de responsavel ao cadastro canonico de developers.

alter table public.ai_briefing_suggestions
  add column if not exists confirmed_assignee_id uuid
    references public.developers(id) on delete set null;

create index if not exists idx_ai_briefing_suggestions_confirmed_assignee
  on public.ai_briefing_suggestions(confirmed_assignee_id)
  where confirmed_assignee_id is not null;

create or replace function public.set_ai_briefing_suggestion_assignee(
  p_suggestion_id uuid,
  p_developer_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_team_id uuid;
  v_review_status text;
begin
  select briefing.org_id, briefing.team_id, suggestion.review_status
    into v_org_id, v_team_id, v_review_status
  from public.ai_briefing_suggestions suggestion
  join public.ai_briefings briefing on briefing.id = suggestion.briefing_id
  where suggestion.id = p_suggestion_id
  for update of suggestion;

  if not found then
    raise exception using errcode = 'P0002', message = 'briefing_suggestion_not_found';
  end if;

  if auth.uid() is null
     or not public.is_organization_member(v_org_id, auth.uid()) then
    raise exception using errcode = '42501', message = 'briefing_assignee_access_denied';
  end if;

  if v_review_status = 'applied' then
    raise exception using errcode = '22023', message = 'briefing_suggestion_already_applied';
  end if;

  if p_developer_id is not null
     and not exists (
       select 1
       from public.developers developer
       join public.team_members member
         on member.team_id = developer.team_id
        and member.user_id = developer.user_id
       where developer.id = p_developer_id
         and developer.team_id = v_team_id
     ) then
    raise exception using errcode = '22023', message = 'briefing_assignee_invalid_for_team';
  end if;

  update public.ai_briefing_suggestions
  set confirmed_assignee_id = p_developer_id
  where id = p_suggestion_id;
end;
$$;

create or replace function public.apply_ai_briefing_confirmed_assignee()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.target_type = 'user_story' then
    update public.user_stories story
    set assignee_id = suggestion.confirmed_assignee_id
    from public.ai_briefing_suggestions suggestion
    join public.ai_briefings briefing on briefing.id = suggestion.briefing_id
    join public.developers developer
      on developer.id = suggestion.confirmed_assignee_id
     and developer.team_id = briefing.team_id
    where suggestion.id = new.suggestion_id
      and story.id = new.target_id
      and story.team_id = briefing.team_id
      and suggestion.confirmed_assignee_id is not null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_ai_briefing_apply_confirmed_assignee
  on public.ai_suggestion_applications;
create trigger trg_ai_briefing_apply_confirmed_assignee
after insert on public.ai_suggestion_applications
for each row execute function public.apply_ai_briefing_confirmed_assignee();

revoke all on function public.set_ai_briefing_suggestion_assignee(uuid, uuid)
  from public, anon;
grant execute on function public.set_ai_briefing_suggestion_assignee(uuid, uuid)
  to authenticated, service_role;

revoke all on function public.apply_ai_briefing_confirmed_assignee()
  from public, anon, authenticated;

comment on column public.ai_briefing_suggestions.confirmed_assignee_id is
  'Responsavel canonico confirmado por humano; nunca definido automaticamente pela IA.';
