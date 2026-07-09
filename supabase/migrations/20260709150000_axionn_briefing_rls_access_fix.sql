-- Axionn Briefing - corrige a policy de leitura sem reexpor helpers internos.
-- Os helpers is_organization_* recebem user_id e, por seguranca, nao podem ser
-- executados diretamente por authenticated. Este wrapper usa apenas auth.uid().

create or replace function public.can_access_ai_briefing(
  p_org_id uuid,
  p_team_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and public.is_organization_member(p_org_id, auth.uid())
    and (
      p_team_id is null
      or public.is_organization_admin(p_org_id, auth.uid())
      or exists (
        select 1
        from public.team_members member
        where member.team_id = p_team_id
          and member.user_id = auth.uid()
      )
    );
$$;

revoke all on function public.can_access_ai_briefing(uuid, uuid)
  from public, anon;
grant execute on function public.can_access_ai_briefing(uuid, uuid)
  to authenticated, service_role;

drop policy if exists ai_briefings_member_select on public.ai_briefings;
create policy ai_briefings_member_select on public.ai_briefings
for select to authenticated
using (public.can_access_ai_briefing(org_id, team_id));

comment on function public.can_access_ai_briefing(uuid, uuid) is
  'Autoriza leitura tenant/team-scoped de briefings usando exclusivamente o usuario autenticado.';
