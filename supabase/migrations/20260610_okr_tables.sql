-- OKR Module: tabelas principais
-- Executar no Supabase SQL Editor ou via CLI: supabase db push

create table if not exists public.okr_objectives (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  owner_id    uuid references public.profiles(user_id) on delete set null,
  title       text not null,
  description text,
  cycle       text not null,              -- ex: 'Q1/2026', 'Q2/2026'
  status      text not null default 'on_track'
                check (status in ('on_track','at_risk','off_track','completed')),
  progress    integer not null default 0 check (progress between 0 and 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.okr_key_results (
  id           uuid primary key default gen_random_uuid(),
  objective_id uuid not null references public.okr_objectives(id) on delete cascade,
  title        text not null,
  unit         text not null default '%'
                 check (unit in ('%','number','bool','bugs')),
  target       numeric not null default 100,
  current      numeric not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.okr_check_ins (
  id             uuid primary key default gen_random_uuid(),
  key_result_id  uuid not null references public.okr_key_results(id) on delete cascade,
  value          numeric not null,
  note           text,
  author_id      uuid references public.profiles(user_id) on delete set null,
  created_at     timestamptz not null default now()
);

-- Índices de performance
create index if not exists idx_okr_objectives_team_cycle on public.okr_objectives(team_id, cycle);
create index if not exists idx_okr_key_results_objective on public.okr_key_results(objective_id);
create index if not exists idx_okr_check_ins_kr on public.okr_check_ins(key_result_id);

-- RLS: habilitar e criar policies
alter table public.okr_objectives enable row level security;
alter table public.okr_key_results enable row level security;
alter table public.okr_check_ins enable row level security;

-- Objectives: leitura e escrita por membros do time
create policy "okr_objectives_team_select" on public.okr_objectives
  for select using (is_team_member(team_id, auth.uid()));

create policy "okr_objectives_team_insert" on public.okr_objectives
  for insert with check (is_team_member(team_id, auth.uid()));

create policy "okr_objectives_team_update" on public.okr_objectives
  for update using (is_team_member(team_id, auth.uid()));

create policy "okr_objectives_team_delete" on public.okr_objectives
  for delete using (is_team_member(team_id, auth.uid()));

-- Key Results: acesso via objective
create policy "okr_key_results_select" on public.okr_key_results
  for select using (
    exists (
      select 1 from public.okr_objectives o
      where o.id = objective_id and is_team_member(o.team_id, auth.uid())
    )
  );

create policy "okr_key_results_insert" on public.okr_key_results
  for insert with check (
    exists (
      select 1 from public.okr_objectives o
      where o.id = objective_id and is_team_member(o.team_id, auth.uid())
    )
  );

create policy "okr_key_results_update" on public.okr_key_results
  for update using (
    exists (
      select 1 from public.okr_objectives o
      where o.id = objective_id and is_team_member(o.team_id, auth.uid())
    )
  );

create policy "okr_key_results_delete" on public.okr_key_results
  for delete using (
    exists (
      select 1 from public.okr_objectives o
      where o.id = objective_id and is_team_member(o.team_id, auth.uid())
    )
  );

-- Check-ins: acesso via key_result → objective
create policy "okr_check_ins_select" on public.okr_check_ins
  for select using (
    exists (
      select 1
        from public.okr_key_results kr
        join public.okr_objectives o on o.id = kr.objective_id
       where kr.id = key_result_id and is_team_member(o.team_id, auth.uid())
    )
  );

create policy "okr_check_ins_insert" on public.okr_check_ins
  for insert with check (
    exists (
      select 1
        from public.okr_key_results kr
        join public.okr_objectives o on o.id = kr.objective_id
       where kr.id = key_result_id and is_team_member(o.team_id, auth.uid())
    )
  );

-- Função para recalcular progress do objetivo automaticamente após check-in
create or replace function public.fn_okr_recalc_objective_progress()
returns trigger language plpgsql security definer as $$
declare
  v_objective_id uuid;
  v_progress     integer;
  v_status       text;
begin
  select objective_id into v_objective_id
    from public.okr_key_results where id = new.key_result_id;

  -- Atualiza current do KR
  update public.okr_key_results
     set current = new.value, updated_at = now()
   where id = new.key_result_id;

  -- Recalcula progresso médio do objetivo
  select round(avg(
    case
      when unit = 'bugs'   then greatest(0, 100 - current * 20)
      when unit = 'bool'   then case when current >= target then 100 else 0 end
      when target = 0      then 100
      else least(100, round((current / target) * 100))
    end
  ))::integer
  into v_progress
  from public.okr_key_results
  where objective_id = v_objective_id;

  v_status := case
    when v_progress >= 100 then 'completed'
    when v_progress >= 70  then 'on_track'
    when v_progress >= 40  then 'at_risk'
    else 'off_track'
  end;

  update public.okr_objectives
     set progress = coalesce(v_progress, 0),
         status   = v_status,
         updated_at = now()
   where id = v_objective_id;

  return new;
end;
$$;

create trigger trg_okr_checkin_recalc
after insert on public.okr_check_ins
for each row execute function public.fn_okr_recalc_objective_progress();
