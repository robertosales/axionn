-- Evolução aditiva do OKR: preserva objetivos, KRs e check-ins legados.
begin;

alter table public.okr_objectives
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists calculated_progress numeric,
  add column if not exists calculated_health text not null default 'no_data',
  add column if not exists health_reason text,
  add column if not exists manual_health_override text,
  add column if not exists health_override_reason text,
  add column if not exists scope_type text not null default 'team',
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists last_calculated_at timestamptz,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists legacy_progress numeric,
  add column if not exists measurement_status text not null default 'needs_configuration';

update public.okr_objectives
set legacy_progress = progress,
    calculated_progress = null,
    measurement_status = 'needs_configuration'
where legacy_progress is null;

alter table public.okr_key_results
  add column if not exists description text,
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists update_type text not null default 'manual',
  add column if not exists metric_code text,
  add column if not exists metric_config jsonb not null default '{}'::jsonb,
  add column if not exists baseline_value numeric,
  add column if not exists current_value numeric,
  add column if not exists target_value numeric,
  add column if not exists target_min numeric,
  add column if not exists target_max numeric,
  add column if not exists direction text not null default 'increase',
  add column if not exists weight numeric,
  add column if not exists raw_progress numeric,
  add column if not exists calculated_progress numeric,
  add column if not exists calculated_health text not null default 'no_data',
  add column if not exists measurement_quality text not null default 'no_data',
  add column if not exists source_label text,
  add column if not exists formula_version text,
  add column if not exists last_measured_at timestamptz,
  add column if not exists frequency text not null default 'manual',
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists created_by uuid references auth.users(id) on delete set null;

update public.okr_key_results
set current_value = current,
    target_value = target,
    update_type = 'manual',
    measurement_quality = 'partial'
where current_value is null and target_value is null;

create table if not exists public.okr_initiatives (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null references public.okr_objectives(id) on delete cascade,
  key_result_id uuid references public.okr_key_results(id) on delete set null,
  title text not null,
  description text,
  owner_id uuid references auth.users(id) on delete set null,
  status text not null default 'planned',
  due_date date,
  linked_entity_type text,
  linked_entity_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.okr_key_result_snapshots (
  id uuid primary key default gen_random_uuid(),
  key_result_id uuid not null references public.okr_key_results(id) on delete cascade,
  measured_value numeric,
  raw_progress numeric,
  calculated_progress numeric,
  health text not null default 'no_data',
  measurement_quality text not null default 'no_data',
  source text,
  formula_version text,
  measured_at timestamptz not null default now(),
  period_start date,
  period_end date,
  scope_type text,
  scope_id uuid,
  items_considered integer,
  calculation_metadata jsonb not null default '{}'::jsonb,
  triggered_by_type text not null default 'manual',
  triggered_by_id uuid,
  idempotency_key text unique,
  created_at timestamptz not null default now()
);

alter table public.okr_check_ins
  add column if not exists objective_id uuid references public.okr_objectives(id) on delete cascade,
  add column if not exists confidence integer,
  add column if not exists summary text,
  add column if not exists risks text,
  add column if not exists next_steps text,
  add column if not exists previous_value numeric,
  add column if not exists evidence jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_okr_objectives_scope_cycle on public.okr_objectives(team_id, cycle, lifecycle_status);
create index if not exists idx_okr_snapshots_kr_measured on public.okr_key_result_snapshots(key_result_id, measured_at desc);
create index if not exists idx_okr_initiatives_objective on public.okr_initiatives(objective_id, status);

alter table public.okr_initiatives enable row level security;
alter table public.okr_key_result_snapshots enable row level security;

create policy okr_initiatives_team_access on public.okr_initiatives for all to authenticated
using (exists (select 1 from public.okr_objectives o where o.id = objective_id and (public.is_admin() or public.is_team_member(auth.uid(), o.team_id))))
with check (exists (select 1 from public.okr_objectives o where o.id = objective_id and (public.is_admin() or public.is_team_member(auth.uid(), o.team_id))));

create policy okr_snapshots_team_select on public.okr_key_result_snapshots for select to authenticated
using (exists (select 1 from public.okr_key_results kr join public.okr_objectives o on o.id = kr.objective_id where kr.id = key_result_id and (public.is_admin() or public.is_team_member(auth.uid(), o.team_id))));

create policy okr_snapshots_team_insert on public.okr_key_result_snapshots for insert to authenticated
with check (exists (select 1 from public.okr_key_results kr join public.okr_objectives o on o.id = kr.objective_id where kr.id = key_result_id and (public.is_admin() or public.is_team_member(auth.uid(), o.team_id))));

comment on column public.okr_objectives.legacy_progress is 'Percentual legado preservado; não representa progresso calculado.';
comment on table public.okr_key_result_snapshots is 'Evidência imutável e histórica das medições de Key Results.';

commit;
