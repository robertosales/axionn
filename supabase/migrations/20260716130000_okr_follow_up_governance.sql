-- Fase 2 do OKR: governança, auditoria, alertas e processamento incremental.
-- Executar exclusivamente pelo fluxo de banco do Lovable.
begin;

alter table public.okr_objectives
  add column if not exists health_override_by uuid references auth.users(id) on delete set null,
  add column if not exists health_override_at timestamptz,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.okr_key_results
  add column if not exists start_date date,
  add column if not exists end_date date,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

create table if not exists public.okr_audit_log (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid references public.okr_objectives(id) on delete cascade,
  key_result_id uuid references public.okr_key_results(id) on delete cascade,
  initiative_id uuid references public.okr_initiatives(id) on delete cascade,
  action text not null,
  actor_id uuid references auth.users(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.okr_alerts (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null references public.okr_objectives(id) on delete cascade,
  key_result_id uuid references public.okr_key_results(id) on delete cascade,
  alert_type text not null,
  severity text not null default 'warning',
  message text not null,
  status text not null default 'open',
  deduplication_key text not null unique,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.okr_recalculation_queue (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null references public.okr_objectives(id) on delete cascade,
  reason text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  processed_at timestamptz,
  last_error text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists idx_okr_audit_objective_time on public.okr_audit_log(objective_id, created_at desc);
create index if not exists idx_okr_alerts_objective_status on public.okr_alerts(objective_id, status, detected_at desc);
create index if not exists idx_okr_queue_pending on public.okr_recalculation_queue(status, available_at) where status = 'pending';

alter table public.okr_audit_log enable row level security;
alter table public.okr_alerts enable row level security;
alter table public.okr_recalculation_queue enable row level security;

drop policy if exists okr_audit_team_select on public.okr_audit_log;
create policy okr_audit_team_select on public.okr_audit_log for select to authenticated
using (exists (select 1 from public.okr_objectives o where o.id = objective_id and (public.is_admin() or public.is_team_member(auth.uid(), o.team_id))));

drop policy if exists okr_alerts_team_select on public.okr_alerts;
create policy okr_alerts_team_select on public.okr_alerts for select to authenticated
using (exists (select 1 from public.okr_objectives o where o.id = objective_id and (public.is_admin() or public.is_team_member(auth.uid(), o.team_id))));

create or replace function public.set_okr_health_override(p_objective_id uuid, p_health text, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_objective public.okr_objectives%rowtype;
begin
  select * into v_objective from public.okr_objectives where id = p_objective_id;
  if v_objective.id is null then raise exception 'Objetivo não encontrado'; end if;
  if not (public.is_admin() or public.is_team_member(auth.uid(), v_objective.team_id)) then raise exception 'Acesso negado'; end if;
  if p_health is not null and p_health not in ('on_track','attention','at_risk','no_data','completed') then raise exception 'Saúde inválida'; end if;
  if p_health is not null and nullif(trim(p_reason), '') is null then raise exception 'Justificativa obrigatória'; end if;
  update public.okr_objectives set
    manual_health_override = p_health,
    health_override_reason = case when p_health is null then null else trim(p_reason) end,
    health_override_by = case when p_health is null then null else auth.uid() end,
    health_override_at = case when p_health is null then null else now() end,
    updated_by = auth.uid(), updated_at = now()
  where id = p_objective_id;
  insert into public.okr_audit_log(objective_id, action, actor_id, before_data, after_data)
  values (p_objective_id, 'health_override', auth.uid(),
    jsonb_build_object('health', v_objective.manual_health_override, 'reason', v_objective.health_override_reason),
    jsonb_build_object('health', p_health, 'reason', case when p_health is null then null else trim(p_reason) end));
end $$;

revoke all on function public.set_okr_health_override(uuid,text,text) from public;
grant execute on function public.set_okr_health_override(uuid,text,text) to authenticated;

create or replace function public.enqueue_okr_recalculation() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_objective_id uuid;
begin
  for v_objective_id in select o.id from public.okr_objectives o
  where o.team_id = new.team_id and o.lifecycle_status = 'active'
  and (o.start_date is null or o.start_date <= current_date)
  and (o.end_date is null or o.end_date >= current_date)
  loop
    insert into public.okr_recalculation_queue(objective_id, reason, idempotency_key)
    values (v_objective_id, tg_table_name || ':' || tg_op,
      v_objective_id::text || ':' || tg_table_name || ':' || date_trunc('hour', now())::text)
    on conflict (idempotency_key) do nothing;
  end loop;
  return new;
end $$;

-- Eventos suportados apenas quando as tabelas possuem team_id no modelo atual.
drop trigger if exists trg_okr_user_story_event on public.user_stories;
create trigger trg_okr_user_story_event after insert or update of status, story_points on public.user_stories
for each row execute function public.enqueue_okr_recalculation();

drop trigger if exists trg_okr_impediment_event on public.impediments;
create trigger trg_okr_impediment_event after insert or update of resolved_at on public.impediments
for each row execute function public.enqueue_okr_recalculation();

comment on table public.okr_recalculation_queue is 'Fila idempotente consumida pela função okr-recalculation; não é exposta ao cliente.';
comment on function public.set_okr_health_override is 'Override auditável sem apagar a saúde calculada.';
commit;
