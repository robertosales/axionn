-- Planning Poker: secret ballots, immutable foreign votes and atomic reveal.

delete from public.planning_votes older
using public.planning_votes newer
where older.session_id = newer.session_id
  and older.hu_id = newer.hu_id
  and older.user_id = newer.user_id
  and (older.created_at, older.id) < (newer.created_at, newer.id);

create unique index if not exists planning_votes_one_per_user_round
  on public.planning_votes(session_id, hu_id, user_id);

alter table public.planning_rounds
  add column if not exists vote_revision bigint not null default 0;

drop policy if exists "Admin full access planning_votes" on public.planning_votes;
drop policy if exists "Member view planning_votes" on public.planning_votes;
drop policy if exists "Member insert planning_votes" on public.planning_votes;
drop policy if exists "Member update planning_votes" on public.planning_votes;
drop policy if exists "Member delete planning_votes" on public.planning_votes;
drop policy if exists planning_votes_organization_admin_select on public.planning_votes;

revoke all on public.planning_votes from anon, public, authenticated;
grant all on public.planning_votes to service_role;

create or replace function public.get_planning_round_votes(
  p_session_id uuid,
  p_hu_id uuid
)
returns table(id uuid, user_id uuid, vote_value text, revealed boolean)
language plpgsql security definer stable set search_path = public, pg_temp
as $$
declare v_revealed boolean;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.planning_sessions session
    where session.id = p_session_id
      and (public.is_team_member(auth.uid(), session.team_id)
        or public.is_organization_team_admin(session.team_id, auth.uid())
        or public.has_role(auth.uid(), 'admin'::public.app_role))
  ) then raise exception 'planning_session_access_denied' using errcode = '42501'; end if;

  select round.status in ('revealed', 'saved') into v_revealed
  from public.planning_rounds round
  where round.session_id = p_session_id and round.hu_id = p_hu_id
  order by round.round_number desc limit 1;

  return query
  select vote.id, vote.user_id,
    case when coalesce(v_revealed, false) or vote.user_id = auth.uid() then vote.vote_value else null end,
    coalesce(v_revealed, false)
  from public.planning_votes vote
  where vote.session_id = p_session_id and vote.hu_id = p_hu_id;
end;
$$;

create or replace function public.cast_planning_vote(
  p_session_id uuid,
  p_hu_id uuid,
  p_vote_value text
)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_team_id uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if p_vote_value is null or length(btrim(p_vote_value)) not between 1 and 16 then
    raise exception 'invalid_vote_value' using errcode = '22023';
  end if;
  select session.team_id, session.status into v_team_id, v_status
  from public.planning_sessions session where session.id = p_session_id;
  if not found or not public.is_team_member(auth.uid(), v_team_id) then
    raise exception 'planning_session_access_denied' using errcode = '42501';
  end if;
  if v_status <> 'open' or not exists (
    select 1 from public.planning_rounds round
    where round.session_id = p_session_id and round.hu_id = p_hu_id and round.status = 'voting'
  ) then raise exception 'planning_round_not_voting' using errcode = '22023'; end if;

  insert into public.planning_votes(session_id, hu_id, user_id, vote_value, revealed)
  values (p_session_id, p_hu_id, auth.uid(), btrim(p_vote_value), false)
  on conflict (session_id, hu_id, user_id)
  do update set vote_value = excluded.vote_value, revealed = false;

  update public.planning_rounds
  set vote_revision = vote_revision + 1
  where session_id = p_session_id and hu_id = p_hu_id and status = 'voting';
end;
$$;

create or replace function public.reveal_planning_votes(p_round_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_round public.planning_rounds%rowtype; v_creator uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into v_round from public.planning_rounds where id = p_round_id for update;
  if not found or v_round.status <> 'voting' then
    raise exception 'planning_round_not_voting' using errcode = '22023';
  end if;
  select created_by into v_creator from public.planning_sessions where id = v_round.session_id;
  if auth.uid() <> v_creator and not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'planning_facilitator_required' using errcode = '42501';
  end if;
  update public.planning_rounds set status = 'revealed', revealed_at = now() where id = p_round_id;
  update public.planning_votes set revealed = true
  where session_id = v_round.session_id and hu_id = v_round.hu_id;
end;
$$;

revoke all on function public.get_planning_round_votes(uuid, uuid) from public, anon;
revoke all on function public.cast_planning_vote(uuid, uuid, text) from public, anon;
revoke all on function public.reveal_planning_votes(uuid) from public, anon;
grant execute on function public.get_planning_round_votes(uuid, uuid) to authenticated, service_role;
grant execute on function public.cast_planning_vote(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.reveal_planning_votes(uuid) to authenticated, service_role;
