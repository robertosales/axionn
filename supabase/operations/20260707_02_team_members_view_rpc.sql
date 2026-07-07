-- Hotfix: permite que a tela Times / Squads carregue membros dos times
-- acessiveis sem depender de SELECT direto em team_members/profiles.

create or replace function public.get_team_members_for_teams_v2(
  p_org_id uuid,
  p_team_ids uuid[]
)
returns table (
  team_id uuid,
  user_id uuid,
  role text,
  display_name text,
  email text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with requested_teams as (
    select distinct team_id
    from unnest(coalesce(p_team_ids, '{}'::uuid[])) as team_id
    where team_id is not null
  ),
  authorized_teams as (
    select team.id
    from requested_teams requested
    join public.teams team
      on team.id = requested.team_id
    where coalesce(team.org_id, public.resolve_team_org_id(team.id)) = p_org_id
      and coalesce(team.is_active, true)
      and (
        coalesce(public.is_platform_admin(auth.uid()), false)
        or coalesce(public.is_organization_admin(p_org_id, auth.uid()), false)
        or exists (
          select 1
          from public.team_members current_member
          where current_member.team_id = team.id
            and current_member.user_id = auth.uid()
        )
      )
  ),
  direct_members as (
    select
      member.team_id,
      member.user_id,
      member.role
    from public.team_members member
    join authorized_teams team
      on team.id = member.team_id
  ),
  profile_team_members as (
    select
      profile.team_id,
      profile.user_id,
      'member'::text as role
    from public.profiles profile
    join authorized_teams team
      on team.id = profile.team_id
    where profile.user_id is not null
      and coalesce(profile.is_active, true)
  ),
  merged_members as (
    select distinct on (member.team_id, member.user_id)
      member.team_id,
      member.user_id,
      member.role
    from (
      select * from direct_members
      union all
      select * from profile_team_members
    ) member
    order by
      member.team_id,
      member.user_id,
      case when member.role = 'admin' then 0 else 1 end
  )
  select
    member.team_id,
    member.user_id,
    member.role,
    coalesce(nullif(profile.display_name, ''), profile.full_name, profile.email, member.user_id::text) as display_name,
    coalesce(profile.email, '') as email
  from merged_members member
  left join public.profiles profile
    on profile.user_id = member.user_id
  order by
    member.team_id,
    coalesce(nullif(profile.display_name, ''), profile.full_name, profile.email, member.user_id::text);
$$;

revoke all on function public.get_team_members_for_teams_v2(uuid, uuid[])
  from public, anon;
grant execute on function public.get_team_members_for_teams_v2(uuid, uuid[])
  to authenticated, service_role;

comment on function public.get_team_members_for_teams_v2(uuid, uuid[]) is
  'Lista membros de times ativos dentro da organizacao para org admin, platform admin ou membro do proprio time.';
