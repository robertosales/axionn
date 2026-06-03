-- Fase 3: tabela de vinculo entre projetos (de qualquer modulo) e times existentes
create table if not exists public.project_teams (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projetos(id) on delete cascade,
  team_id     uuid not null references public.teams(id) on delete cascade,
  role        text not null default 'sustentacao' check (role in ('agile', 'sustentacao')),
  created_at  timestamptz not null default now(),
  unique (project_id, team_id)
);

comment on table public.project_teams is
  'Vincula times existentes (salas) a projetos, substituindo o campo equipe texto livre.';

create index if not exists idx_project_teams_project_id on public.project_teams(project_id);
create index if not exists idx_project_teams_team_id    on public.project_teams(team_id);

-- RLS: apenas membros do time podem ver os vinculos
alter table public.project_teams enable row level security;

create policy "project_teams_select" on public.project_teams
  for select using (
    team_id in (
      select team_id from public.team_members where user_id = auth.uid()
    )
  );

create policy "project_teams_manage" on public.project_teams
  for all using (
    team_id in (
      select tm.team_id from public.team_members tm
      join public.user_roles ur on ur.user_id = tm.user_id and ur.team_id = tm.team_id
      where tm.user_id = auth.uid() and ur.role in ('owner', 'admin')
    )
  );
