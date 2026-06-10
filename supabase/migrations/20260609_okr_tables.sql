-- ─────────────────────────────────────────────────────────────────────────────
-- Migração: Módulo OKR
-- Tabelas: okr_objectives, okr_key_results, okr_check_ins
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. okr_objectives ────────────────────────────────────────────────────────
create table if not exists public.okr_objectives (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  owner_id    uuid references auth.users(id) on delete set null,
  team_id     uuid references public.teams(id) on delete cascade,
  cycle       text not null,            -- ex: 'Q2/2026'
  status      text not null default 'on_track'
              check (status in ('on_track','at_risk','off_track','completed')),
  progress    integer not null default 0 check (progress between 0 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.okr_objectives is 'Objetivos OKR por ciclo e time';

-- ── 2. okr_key_results ───────────────────────────────────────────────────────
create table if not exists public.okr_key_results (
  id           uuid primary key default gen_random_uuid(),
  objective_id uuid not null references public.okr_objectives(id) on delete cascade,
  title        text not null,
  unit         text not null default '%'
               check (unit in ('%','pts','bugs','score','dias','bool','R$','un')),
  target       numeric(12,2) not null default 100,
  current      numeric(12,2) not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.okr_key_results is 'Key Results vinculados a um objetivo OKR';

-- ── 3. okr_check_ins ─────────────────────────────────────────────────────────
create table if not exists public.okr_check_ins (
  id             uuid primary key default gen_random_uuid(),
  key_result_id  uuid not null references public.okr_key_results(id) on delete cascade,
  value          numeric(12,2) not null,
  note           text,
  author_id      uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now()
);

comment on table public.okr_check_ins is 'Histórico de atualizações de um Key Result';

-- ── 4. Índices ────────────────────────────────────────────────────────────────
create index if not exists okr_objectives_team_cycle_idx
  on public.okr_objectives (team_id, cycle);

create index if not exists okr_key_results_objective_idx
  on public.okr_key_results (objective_id);

create index if not exists okr_check_ins_kr_idx
  on public.okr_check_ins (key_result_id, created_at desc);

-- ── 5. Trigger: updated_at automático ────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger okr_objectives_updated_at
  before update on public.okr_objectives
  for each row execute function public.set_updated_at();

create trigger okr_key_results_updated_at
  before update on public.okr_key_results
  for each row execute function public.set_updated_at();

-- ── 6. Trigger: recalcular progresso do objetivo após check-in ────────────────
create or replace function public.recalculate_objective_progress()
returns trigger language plpgsql as $$
declare
  v_objective_id uuid;
  v_progress     integer;
  v_status       text;
begin
  -- descobre o objetivo dono do KR que recebeu check-in
  select objective_id into v_objective_id
  from public.okr_key_results
  where id = new.key_result_id;

  -- atualiza o current do KR com o valor do check-in
  update public.okr_key_results
  set current = new.value, updated_at = now()
  where id = new.key_result_id;

  -- calcula progresso médio de todos os KRs do objetivo
  select coalesce(round(avg(
    case
      when unit = 'bugs' then
        case when current = 0 then 100 else greatest(0, 100 - current * 20) end
      when unit = 'bool' then
        case when current >= target then 100 else 0 end
      when target = 0 then 100
      else least(100, round((current / target) * 100))
    end
  )), 0)
  into v_progress
  from public.okr_key_results
  where objective_id = v_objective_id;

  -- determina status baseado no progresso
  v_status :=
    case
      when v_progress >= 100 then 'completed'
      when v_progress >= 70  then 'on_track'
      when v_progress >= 40  then 'at_risk'
      else                        'off_track'
    end;

  -- atualiza objetivo
  update public.okr_objectives
  set progress = v_progress, status = v_status, updated_at = now()
  where id = v_objective_id;

  return new;
end;
$$;

create trigger okr_checkin_recalc_progress
  after insert on public.okr_check_ins
  for each row execute function public.recalculate_objective_progress();

-- ── 7. Row Level Security ─────────────────────────────────────────────────────
alter table public.okr_objectives  enable row level security;
alter table public.okr_key_results enable row level security;
alter table public.okr_check_ins   enable row level security;

-- Membros do time leem seus próprios objetivos
create policy "okr_objectives_select" on public.okr_objectives
  for select using (
    team_id in (
      select team_id from public.team_members
      where user_id = auth.uid()
    )
  );

-- Apenas admins e owners inserem/atualizam objetivos
create policy "okr_objectives_write" on public.okr_objectives
  for all using (
    auth.uid() = owner_id or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and module_access in ('admin','sala_agil')
    )
  );

-- Todos membros leem KRs de seus times
create policy "okr_key_results_select" on public.okr_key_results
  for select using (
    objective_id in (
      select o.id from public.okr_objectives o
      join public.team_members tm on tm.team_id = o.team_id
      where tm.user_id = auth.uid()
    )
  );

create policy "okr_key_results_write" on public.okr_key_results
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and module_access in ('admin','sala_agil')
    )
  );

-- Qualquer membro do time pode inserir check-ins
create policy "okr_check_ins_insert" on public.okr_check_ins
  for insert with check (auth.uid() = author_id);

create policy "okr_check_ins_select" on public.okr_check_ins
  for select using (true);
