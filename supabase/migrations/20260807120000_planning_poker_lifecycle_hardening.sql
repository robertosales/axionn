-- Planning Poker lifecycle: facilitator-owned, atomic server-side transitions.

drop policy if exists "Admin full access planning_sessions" on public.planning_sessions;
drop policy if exists "Member insert own team planning_sessions" on public.planning_sessions;
drop policy if exists "Member update own team planning_sessions" on public.planning_sessions;
drop policy if exists "Member delete own team planning_sessions" on public.planning_sessions;
drop policy if exists "Admin full access planning_rounds" on public.planning_rounds;
drop policy if exists "Member insert planning_rounds" on public.planning_rounds;
drop policy if exists "Member update planning_rounds" on public.planning_rounds;
drop policy if exists "Member delete planning_rounds" on public.planning_rounds;
drop policy if exists "Admin full access planning_participants" on public.planning_participants;
drop policy if exists "Member insert planning_participants" on public.planning_participants;
drop policy if exists "Member update planning_participants" on public.planning_participants;
drop policy if exists "Member delete planning_participants" on public.planning_participants;

revoke insert, update, delete on public.planning_sessions from anon, public, authenticated;
revoke insert, update, delete on public.planning_rounds from anon, public, authenticated;
revoke insert, update, delete on public.planning_participants from anon, public, authenticated;
grant all on public.planning_sessions, public.planning_rounds, public.planning_participants to service_role;

create or replace function public.create_planning_session(
  p_team_id uuid, p_sprint_id uuid, p_deck_mode text default 'fibonacci'
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_session_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if not public.is_team_member(auth.uid(), p_team_id) then raise exception 'team_access_denied' using errcode = '42501'; end if;
  if p_deck_mode not in ('fibonacci', 'modified', 'tshirt', 'hours') then raise exception 'invalid_deck_mode' using errcode = '22023'; end if;
  if not exists (select 1 from public.sprints where id = p_sprint_id and team_id = p_team_id) then
    raise exception 'sprint_team_mismatch' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_team_id::text, 0));
  if exists (select 1 from public.planning_sessions where team_id = p_team_id and status = 'open') then
    raise exception 'planning_session_already_open' using errcode = '23505';
  end if;
  insert into public.planning_sessions(team_id, sprint_id, created_by, status, deck_mode)
  values (p_team_id, p_sprint_id, auth.uid(), 'open', p_deck_mode) returning id into v_session_id;
  insert into public.planning_participants(session_id, user_id, is_facilitator)
  values (v_session_id, auth.uid(), true);
  return v_session_id;
end;
$$;

create or replace function public.join_planning_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_team_id uuid; v_status text;
begin
  select team_id, status into v_team_id, v_status from public.planning_sessions where id = p_session_id;
  if auth.uid() is null or not found or not public.is_team_member(auth.uid(), v_team_id) then
    raise exception 'planning_session_access_denied' using errcode = '42501';
  end if;
  if v_status <> 'open' then raise exception 'planning_session_closed' using errcode = '22023'; end if;
  insert into public.planning_participants(session_id, user_id, is_facilitator, is_online, last_seen_at)
  values (p_session_id, auth.uid(), false, true, now())
  on conflict (session_id, user_id) do update set is_online = true, last_seen_at = now();
end;
$$;

create or replace function public.start_planning_round(p_session_id uuid, p_hu_id uuid)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_session public.planning_sessions%rowtype; v_round_id uuid; v_round_number integer;
begin
  select * into v_session from public.planning_sessions where id = p_session_id for update;
  if not found or v_session.status <> 'open' then raise exception 'planning_session_not_open' using errcode = '22023'; end if;
  if auth.uid() <> v_session.created_by and not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'planning_facilitator_required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.user_stories where id = p_hu_id and team_id = v_session.team_id) then
    raise exception 'story_team_mismatch' using errcode = '22023';
  end if;
  if exists (select 1 from public.planning_rounds where session_id = p_session_id and status in ('voting', 'revealed')) then
    raise exception 'planning_round_already_active' using errcode = '23505';
  end if;
  select coalesce(max(round_number), 0) + 1 into v_round_number from public.planning_rounds where session_id = p_session_id;
  insert into public.planning_rounds(session_id, hu_id, round_number, status, facilitator_id)
  values (p_session_id, p_hu_id, v_round_number, 'voting', auth.uid()) returning id into v_round_id;
  return v_round_id;
end;
$$;

create or replace function public.save_planning_result(p_round_id uuid, p_value text, p_hours numeric default null)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_round public.planning_rounds%rowtype; v_session public.planning_sessions%rowtype; v_story_points numeric;
begin
  select * into v_round from public.planning_rounds where id = p_round_id for update;
  if not found or v_round.status <> 'revealed' then raise exception 'planning_round_not_revealed' using errcode = '22023'; end if;
  select * into v_session from public.planning_sessions where id = v_round.session_id;
  if auth.uid() <> v_session.created_by and not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'planning_facilitator_required' using errcode = '42501';
  end if;
  if p_value is null or length(btrim(p_value)) not between 1 and 16 or p_hours < 0 or p_hours > 10000 then
    raise exception 'invalid_planning_result' using errcode = '22023';
  end if;
  begin v_story_points := p_value::numeric; exception when invalid_text_representation then v_story_points := 0; end;
  update public.planning_rounds set status = 'saved', result_value = btrim(p_value), result_hours = p_hours, saved_at = now()
  where id = p_round_id;
  if p_hours is not null then
    update public.user_stories set estimated_hours = p_hours, story_points = v_story_points
    where id = v_round.hu_id and team_id = v_session.team_id;
  end if;
end;
$$;

create or replace function public.close_planning_session(p_session_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_session public.planning_sessions%rowtype; v_total_hus integer; v_total_hours numeric;
begin
  select * into v_session from public.planning_sessions where id = p_session_id for update;
  if not found or v_session.status <> 'open' then raise exception 'planning_session_not_open' using errcode = '22023'; end if;
  if auth.uid() <> v_session.created_by and not public.has_role(auth.uid(), 'admin'::public.app_role) then
    raise exception 'planning_facilitator_required' using errcode = '42501';
  end if;
  if exists (select 1 from public.planning_rounds where session_id = p_session_id and status in ('voting', 'revealed')) then
    raise exception 'planning_round_still_active' using errcode = '22023';
  end if;
  select count(*), coalesce(sum(result_hours), 0) into v_total_hus, v_total_hours
  from public.planning_rounds where session_id = p_session_id and status = 'saved';
  update public.planning_sessions set status = 'closed', finished_at = now(), total_hus = v_total_hus, total_horas = v_total_hours
  where id = p_session_id;
end;
$$;

revoke all on function public.create_planning_session(uuid, uuid, text) from public, anon;
revoke all on function public.join_planning_session(uuid) from public, anon;
revoke all on function public.start_planning_round(uuid, uuid) from public, anon;
revoke all on function public.save_planning_result(uuid, text, numeric) from public, anon;
revoke all on function public.close_planning_session(uuid) from public, anon;
grant execute on function public.create_planning_session(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.join_planning_session(uuid) to authenticated, service_role;
grant execute on function public.start_planning_round(uuid, uuid) to authenticated, service_role;
grant execute on function public.save_planning_result(uuid, text, numeric) to authenticated, service_role;
grant execute on function public.close_planning_session(uuid) to authenticated, service_role;
