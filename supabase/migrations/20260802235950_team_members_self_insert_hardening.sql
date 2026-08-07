-- Team membership is managed through organization-scoped, admin-guarded RPCs.
-- A direct self-insert would let an authenticated user choose an arbitrary team_id.
drop policy if exists "tm_member_insert_self" on public.team_members;

comment on table public.team_members is
  'Team membership is managed by organization-scoped administrative RPCs; direct member self-insert is denied by RLS.';
