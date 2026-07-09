-- Permite que administradores da organização consultem o histórico ágil dos
-- times da própria organização, sem exigir vínculo redundante em team_members.

create or replace function public.is_organization_team_admin(
  p_team_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.teams team
    where team.id = p_team_id
      and team.org_id is not null
      and public.is_organization_admin(team.org_id, p_user_id)
  );
$$;

revoke all on function public.is_organization_team_admin(uuid, uuid)
  from public, anon;
grant execute on function public.is_organization_team_admin(uuid, uuid)
  to authenticated, service_role;

drop policy if exists planning_sessions_organization_admin_select
  on public.planning_sessions;
create policy planning_sessions_organization_admin_select
on public.planning_sessions
for select
to authenticated
using (public.is_organization_team_admin(team_id, auth.uid()));

drop policy if exists planning_votes_organization_admin_select
  on public.planning_votes;
create policy planning_votes_organization_admin_select
on public.planning_votes
for select
to authenticated
using (
  exists (
    select 1
    from public.planning_sessions session
    where session.id = planning_votes.session_id
      and public.is_organization_team_admin(session.team_id, auth.uid())
  )
);

drop policy if exists planning_rounds_organization_admin_select
  on public.planning_rounds;
create policy planning_rounds_organization_admin_select
on public.planning_rounds
for select
to authenticated
using (
  exists (
    select 1
    from public.planning_sessions session
    where session.id = planning_rounds.session_id
      and public.is_organization_team_admin(session.team_id, auth.uid())
  )
);

drop policy if exists planning_participants_organization_admin_select
  on public.planning_participants;
create policy planning_participants_organization_admin_select
on public.planning_participants
for select
to authenticated
using (
  exists (
    select 1
    from public.planning_sessions session
    where session.id = planning_participants.session_id
      and public.is_organization_team_admin(session.team_id, auth.uid())
  )
);

drop policy if exists retro_sessions_organization_admin_select
  on public.retro_sessions;
create policy retro_sessions_organization_admin_select
on public.retro_sessions
for select
to authenticated
using (public.is_organization_team_admin(team_id, auth.uid()));

drop policy if exists retro_cards_organization_admin_select
  on public.retro_cards;
create policy retro_cards_organization_admin_select
on public.retro_cards
for select
to authenticated
using (
  exists (
    select 1
    from public.retro_sessions session
    where session.id = retro_cards.session_id
      and public.is_organization_team_admin(session.team_id, auth.uid())
  )
);

drop policy if exists retro_actions_organization_admin_select
  on public.retro_actions;
create policy retro_actions_organization_admin_select
on public.retro_actions
for select
to authenticated
using (
  exists (
    select 1
    from public.retro_sessions session
    where session.id = retro_actions.session_id
      and public.is_organization_team_admin(session.team_id, auth.uid())
  )
);

drop policy if exists retro_participants_organization_admin_select
  on public.retro_participants;
create policy retro_participants_organization_admin_select
on public.retro_participants
for select
to authenticated
using (
  exists (
    select 1
    from public.retro_sessions session
    where session.id = retro_participants.session_id
      and public.is_organization_team_admin(session.team_id, auth.uid())
  )
);

drop policy if exists retro_votes_organization_admin_select
  on public.retro_votes;
create policy retro_votes_organization_admin_select
on public.retro_votes
for select
to authenticated
using (
  exists (
    select 1
    from public.retro_sessions session
    where session.id = retro_votes.session_id
      and public.is_organization_team_admin(session.team_id, auth.uid())
  )
);

comment on function public.is_organization_team_admin(uuid, uuid) is
  'Valida se o usuário administra a organização canônica do time.';

select pg_notify('pgrst', 'reload schema');
