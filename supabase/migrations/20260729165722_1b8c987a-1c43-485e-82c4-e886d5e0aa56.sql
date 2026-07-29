alter table public.okr_initiatives
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists priority text not null default 'medium',
  add column if not exists start_date date,
  add column if not exists progress numeric not null default 0,
  add column if not exists blocked_reason text,
  add column if not exists cancelled_reason text,
  add column if not exists linked_entity_module text,
  add column if not exists dependency_metadata jsonb not null default '{}'::jsonb,
  add column if not exists version integer not null default 1,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

update public.okr_initiatives i
   set organization_id = coalesce(o.organization_id, public.resolve_team_org_id(o.team_id))
  from public.okr_objectives o
 where o.id = i.objective_id
   and i.organization_id is null;

alter table public.okr_initiatives drop constraint if exists okr_initiatives_priority_check;
alter table public.okr_initiatives add constraint okr_initiatives_priority_check
  check (priority in ('low', 'medium', 'high', 'critical'));

alter table public.okr_initiatives drop constraint if exists okr_initiatives_status_check;
alter table public.okr_initiatives add constraint okr_initiatives_status_check
  check (status in ('planned', 'in_progress', 'blocked', 'completed', 'cancelled', 'archived'));

alter table public.okr_initiatives drop constraint if exists okr_initiatives_progress_check;
alter table public.okr_initiatives add constraint okr_initiatives_progress_check
  check (progress >= 0 and progress <= 100);

alter table public.okr_initiatives drop constraint if exists okr_initiatives_dates_check;
alter table public.okr_initiatives add constraint okr_initiatives_dates_check
  check (start_date is null or due_date is null or due_date >= start_date);

create index if not exists idx_okr_initiatives_org_status
  on public.okr_initiatives (organization_id, status);
create index if not exists idx_okr_initiatives_objective
  on public.okr_initiatives (objective_id) where archived_at is null;

create table if not exists public.okr_initiative_dependencies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  initiative_id uuid not null references public.okr_initiatives(id) on delete cascade,
  depends_on_initiative_id uuid not null references public.okr_initiatives(id) on delete cascade,
  dependency_type text not null default 'blocks'
    check (dependency_type in ('blocks', 'relates_to', 'duplicates')),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint okr_initiative_dependencies_no_self check (initiative_id <> depends_on_initiative_id),
  unique (initiative_id, depends_on_initiative_id)
);

create or replace function public.tg_okr_initiative_dependency_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_a uuid;
  v_org_b uuid;
  v_cycle boolean;
begin
  select organization_id into v_org_a from public.okr_initiatives where id = new.initiative_id;
  select organization_id into v_org_b from public.okr_initiatives where id = new.depends_on_initiative_id;
  if v_org_a is null or v_org_a is distinct from v_org_b or v_org_a is distinct from new.organization_id then
    raise exception 'OKR_V2_DEPENDENCY_CROSS_ORG' using errcode = '42501';
  end if;

  with recursive chain as (
    select depends_on_initiative_id as node
      from public.okr_initiative_dependencies
     where initiative_id = new.depends_on_initiative_id
    union
    select d.depends_on_initiative_id
      from public.okr_initiative_dependencies d
      join chain c on c.node = d.initiative_id
  )
  select exists (select 1 from chain where node = new.initiative_id) into v_cycle;

  if v_cycle then
    raise exception 'OKR_V2_DEPENDENCY_CYCLE_DETECTED' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_okr_initiative_dependency_guard on public.okr_initiative_dependencies;
create trigger trg_okr_initiative_dependency_guard
before insert or update on public.okr_initiative_dependencies
for each row execute function public.tg_okr_initiative_dependency_guard();

alter table public.okr_alerts
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists cycle_id uuid references public.okr_cycles(id) on delete set null,
  add column if not exists initiative_id uuid references public.okr_initiatives(id) on delete cascade,
  add column if not exists rule_code text,
  add column if not exists first_detected_at timestamptz not null default now(),
  add column if not exists last_detected_at timestamptz not null default now(),
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by uuid references auth.users(id) on delete set null,
  add column if not exists resolution_note text,
  add column if not exists occurrence_count integer not null default 1,
  add column if not exists correlation_id uuid not null default gen_random_uuid();

update public.okr_alerts a set rule_code = coalesce(a.rule_code, a.alert_type) where a.rule_code is null;

update public.okr_alerts a
   set organization_id = coalesce(o.organization_id, public.resolve_team_org_id(o.team_id))
  from public.okr_objectives o
 where o.id = a.objective_id
   and a.organization_id is null;

create index if not exists idx_okr_alerts_org_status
  on public.okr_alerts (organization_id, status, severity);

alter table public.okr_initiative_dependencies enable row level security;

drop policy if exists okr_initiative_dependencies_select_v1 on public.okr_initiative_dependencies;
create policy okr_initiative_dependencies_select_v1
  on public.okr_initiative_dependencies for select to authenticated
  using (public.has_okr_permission_v2(auth.uid(), 'okr.view', organization_id));

revoke all on public.okr_initiative_dependencies from public, anon, authenticated;
grant select on public.okr_initiative_dependencies to authenticated;
grant all on public.okr_initiative_dependencies to service_role;