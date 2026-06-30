-- Suporte a impedimentos no nível da Sprint.
-- Versão com timestamp único para não colidir com outras migrations de 2026-05-08.

alter table public.impediments
  alter column hu_id drop not null;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'impediments'
      and column_name = 'sprint_id'
  ) then
    alter table public.impediments
      add column sprint_id uuid references public.sprints(id) on delete cascade;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'impediments'
      and constraint_name = 'impediments_must_have_target'
  ) then
    alter table public.impediments
      add constraint impediments_must_have_target
      check (hu_id is not null or sprint_id is not null);
  end if;
end;
$$;

create index if not exists idx_impediments_sprint_id
  on public.impediments (sprint_id)
  where sprint_id is not null;

create index if not exists idx_impediments_team_sprint
  on public.impediments (team_id, sprint_id)
  where sprint_id is not null;
