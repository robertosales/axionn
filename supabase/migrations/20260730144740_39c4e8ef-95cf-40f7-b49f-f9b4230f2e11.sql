-- ============================================================
-- OKR V2 - PR 9: reviews, encerramento e carry-forward
-- ============================================================
begin;

create table if not exists public.okr_objective_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_id uuid references public.okr_cycles(id) on delete set null,
  objective_id uuid not null references public.okr_objectives(id) on delete cascade,
  review_status text not null default 'pending',
  final_score numeric,
  final_health text,
  impact_rating text,
  outcome_summary text,
  what_worked text,
  what_did_not_work text,
  lessons_learned text,
  recommendation text,
  carry_forward_decision text,
  carry_forward_reason text,
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.okr_objective_reviews
    add constraint okr_objective_reviews_objective_uk unique (objective_id);
exception when duplicate_table or duplicate_object then null; end $$;

do $$ begin
  alter table public.okr_objective_reviews
    add constraint okr_objective_reviews_status_chk
    check (review_status in ('pending','in_review','submitted','approved','rejected'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.okr_objective_reviews
    add constraint okr_objective_reviews_cf_chk
    check (carry_forward_decision is null or carry_forward_decision in
      ('none','full_objective','selected_key_results','rewritten_objective','learning_only'));
exception when duplicate_object then null; end $$;

create index if not exists okr_objective_reviews_org_cycle
  on public.okr_objective_reviews(organization_id, cycle_id);

create table if not exists public.okr_cycle_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  cycle_id uuid not null unique references public.okr_cycles(id) on delete cascade,
  final_score numeric,
  objectives_total integer not null default 0,
  objectives_completed integer not null default 0,
  objectives_cancelled integer not null default 0,
  objectives_carried_forward integer not null default 0,
  check_in_compliance numeric,
  main_achievements text,
  main_failures text,
  cross_team_dependencies text,
  lessons_learned text,
  strategic_recommendations text,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.okr_carry_forward_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  source_cycle_id uuid,
  source_objective_id uuid not null references public.okr_objectives(id) on delete cascade,
  target_cycle_id uuid,
  target_objective_id uuid not null references public.okr_objectives(id) on delete cascade,
  carry_forward_type text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  created_by uuid
);

do $$ begin
  alter table public.okr_carry_forward_links
    add constraint okr_carry_forward_type_chk
    check (carry_forward_type in ('full_objective','selected_key_results','rewritten_objective','learning_only'));
exception when duplicate_object then null; end $$;

create index if not exists okr_carry_forward_links_source
  on public.okr_carry_forward_links(source_objective_id);

grant select on public.okr_objective_reviews to authenticated;
grant select on public.okr_cycle_reviews to authenticated;
grant select on public.okr_carry_forward_links to authenticated;
grant all on public.okr_objective_reviews to service_role;
grant all on public.okr_cycle_reviews to service_role;
grant all on public.okr_carry_forward_links to service_role;

alter table public.okr_objective_reviews enable row level security;
alter table public.okr_cycle_reviews enable row level security;
alter table public.okr_carry_forward_links enable row level security;

drop policy if exists okr_objective_reviews_select_v1 on public.okr_objective_reviews;
create policy okr_objective_reviews_select_v1 on public.okr_objective_reviews
  for select to authenticated
  using (public.has_okr_permission_v2(auth.uid(), 'okr.view', organization_id));

drop policy if exists okr_cycle_reviews_select_v1 on public.okr_cycle_reviews;
create policy okr_cycle_reviews_select_v1 on public.okr_cycle_reviews
  for select to authenticated
  using (public.has_okr_permission_v2(auth.uid(), 'okr.view', organization_id));

drop policy if exists okr_carry_forward_links_select_v1 on public.okr_carry_forward_links;
create policy okr_carry_forward_links_select_v1 on public.okr_carry_forward_links
  for select to authenticated
  using (public.has_okr_permission_v2(auth.uid(), 'okr.view', organization_id));

-- ============================================================
-- RPCs
-- ============================================================

create or replace function public.list_okr_objective_reviews_v1(
  p_org_id uuid,
  p_cycle_id uuid default null
) returns setof public.okr_objective_reviews
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public._okr_v2_guard(p_org_id, 'okr.view');
  return query
    select r.* from public.okr_objective_reviews r
     where r.organization_id = p_org_id
       and (p_cycle_id is null or r.cycle_id = p_cycle_id)
     order by r.created_at;
end;
$$;

create or replace function public.submit_okr_objective_review_v1(
  p_org_id uuid,
  p_objective_id uuid,
  p_payload jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_obj public.okr_objectives%rowtype;
  v_id uuid;
  v_cf text := nullif(p_payload->>'carry_forward_decision', '');
  v_score numeric;
begin
  perform public._okr_v2_guard(p_org_id, 'okr.edit');

  select * into v_obj from public.okr_objectives where id = p_objective_id for update;
  if v_obj.id is null
     or coalesce(v_obj.organization_id, public.resolve_team_org_id(v_obj.team_id)) is distinct from p_org_id then
    raise exception 'OKR_V2_OBJECTIVE_NOT_FOUND' using errcode = '22023';
  end if;
  if coalesce(v_obj.lifecycle_status, 'active') not in ('active','paused') then
    raise exception 'OKR_V2_REVIEW_INVALID_OBJECTIVE_STATE: %', v_obj.lifecycle_status using errcode = '55000';
  end if;
  if nullif(trim(coalesce(p_payload->>'outcome_summary','')), '') is null then
    raise exception 'OKR_V2_REVIEW_OUTCOME_REQUIRED' using errcode = '22023';
  end if;
  if v_cf is not null and v_cf <> 'none'
     and nullif(trim(coalesce(p_payload->>'carry_forward_reason','')), '') is null then
    raise exception 'OKR_V2_REVIEW_CARRY_FORWARD_REASON_REQUIRED' using errcode = '22023';
  end if;

  v_score := coalesce(nullif(p_payload->>'final_score','')::numeric, v_obj.calculated_progress, 0);

  insert into public.okr_objective_reviews (
    organization_id, cycle_id, objective_id, review_status, final_score, final_health,
    impact_rating, outcome_summary, what_worked, what_did_not_work, lessons_learned,
    recommendation, carry_forward_decision, carry_forward_reason, reviewed_by, reviewed_at
  ) values (
    p_org_id, v_obj.cycle_id, p_objective_id, 'submitted', v_score,
    coalesce(nullif(p_payload->>'final_health',''), v_obj.manual_health_override, v_obj.calculated_health),
    nullif(p_payload->>'impact_rating',''),
    p_payload->>'outcome_summary',
    nullif(p_payload->>'what_worked',''),
    nullif(p_payload->>'what_did_not_work',''),
    nullif(p_payload->>'lessons_learned',''),
    nullif(p_payload->>'recommendation',''),
    coalesce(v_cf, 'none'),
    nullif(p_payload->>'carry_forward_reason',''),
    auth.uid(), now()
  )
  on conflict (objective_id) do update set
    review_status = 'submitted',
    cycle_id = excluded.cycle_id,
    final_score = excluded.final_score,
    final_health = excluded.final_health,
    impact_rating = excluded.impact_rating,
    outcome_summary = excluded.outcome_summary,
    what_worked = excluded.what_worked,
    what_did_not_work = excluded.what_did_not_work,
    lessons_learned = excluded.lessons_learned,
    recommendation = excluded.recommendation,
    carry_forward_decision = excluded.carry_forward_decision,
    carry_forward_reason = excluded.carry_forward_reason,
    rejection_reason = null,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where public.okr_objective_reviews.review_status <> 'approved'
  returning id into v_id;

  if v_id is null then
    raise exception 'OKR_V2_REVIEW_ALREADY_APPROVED' using errcode = '55000';
  end if;

  update public.okr_objectives
     set review_started_at = coalesce(review_started_at, now()),
         updated_by = auth.uid(), updated_at = now()
   where id = p_objective_id;

  insert into public.okr_audit_log (objective_id, action, actor_id, after_data, metadata)
  values (p_objective_id, 'objective_review_submitted', auth.uid(), p_payload,
          jsonb_build_object('organization_id', p_org_id, 'review_id', v_id));

  return v_id;
end;
$$;

create or replace function public.approve_okr_objective_review_v1(
  p_org_id uuid,
  p_review_id uuid,
  p_approve boolean default true,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_rev public.okr_objective_reviews%rowtype;
begin
  perform public._okr_v2_guard(p_org_id, 'okr.close_cycle', 'okr.cycle_management');

  select * into v_rev from public.okr_objective_reviews where id = p_review_id for update;
  if v_rev.id is null or v_rev.organization_id is distinct from p_org_id then
    raise exception 'OKR_V2_REVIEW_NOT_FOUND' using errcode = '22023';
  end if;
  if v_rev.review_status <> 'submitted' then
    raise exception 'OKR_V2_REVIEW_INVALID_STATE: %', v_rev.review_status using errcode = '55000';
  end if;

  if not p_approve then
    if nullif(trim(coalesce(p_reason, '')), '') is null then
      raise exception 'OKR_V2_REVIEW_REJECTION_REASON_REQUIRED' using errcode = '22023';
    end if;
    update public.okr_objective_reviews
       set review_status = 'rejected', rejection_reason = p_reason, updated_at = now()
     where id = p_review_id;
    insert into public.okr_audit_log (objective_id, action, actor_id, metadata)
    values (v_rev.objective_id, 'objective_review_rejected', auth.uid(),
            jsonb_build_object('organization_id', p_org_id, 'review_id', p_review_id, 'reason', p_reason));
    return;
  end if;

  -- snapshot final imutavel de cada KR
  insert into public.okr_key_result_snapshots (
    key_result_id, measured_value, raw_progress, calculated_progress, health,
    measurement_quality, source, formula_version, measured_at, calculation_metadata,
    triggered_by_type, triggered_by_id
  )
  select kr.id, kr.current_value, kr.raw_progress, kr.calculated_progress, kr.calculated_health,
         kr.measurement_quality, 'objective_review_final', coalesce(kr.formula_version, 'v2'), now(),
         jsonb_build_object('review_id', p_review_id, 'reason', 'final_review_snapshot'),
         'objective_review', p_review_id
    from public.okr_key_results kr
   where kr.objective_id = v_rev.objective_id
     and kr.archived_at is null;

  update public.okr_objective_reviews
     set review_status = 'approved', approved_by = auth.uid(), approved_at = now(), updated_at = now()
   where id = p_review_id;

  update public.okr_objectives
     set lifecycle_status = 'completed',
         completed_at = now(),
         completed_by = auth.uid(),
         updated_by = auth.uid(),
         updated_at = now()
   where id = v_rev.objective_id;

  insert into public.okr_audit_log (objective_id, action, actor_id, after_data, metadata)
  values (v_rev.objective_id, 'objective_review_approved', auth.uid(),
          to_jsonb(v_rev), jsonb_build_object('organization_id', p_org_id, 'review_id', p_review_id));
end;
$$;

create or replace function public.carry_forward_okr_objective_v1(
  p_org_id uuid,
  p_objective_id uuid,
  p_target_cycle_id uuid,
  p_carry_forward_type text,
  p_reason text,
  p_key_result_ids uuid[] default null
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_obj public.okr_objectives%rowtype;
  v_cycle public.okr_cycles%rowtype;
  v_new uuid;
begin
  perform public._okr_v2_guard(p_org_id, 'okr.create');

  if nullif(trim(coalesce(p_reason,'')), '') is null then
    raise exception 'OKR_V2_CARRY_FORWARD_REASON_REQUIRED' using errcode = '22023';
  end if;
  if p_carry_forward_type not in ('full_objective','selected_key_results','rewritten_objective','learning_only') then
    raise exception 'OKR_V2_CARRY_FORWARD_INVALID_TYPE' using errcode = '22023';
  end if;

  select * into v_obj from public.okr_objectives where id = p_objective_id;
  if v_obj.id is null
     or coalesce(v_obj.organization_id, public.resolve_team_org_id(v_obj.team_id)) is distinct from p_org_id then
    raise exception 'OKR_V2_OBJECTIVE_NOT_FOUND' using errcode = '22023';
  end if;

  select * into v_cycle from public.okr_cycles where id = p_target_cycle_id;
  if v_cycle.id is null or v_cycle.organization_id is distinct from p_org_id then
    raise exception 'OKR_V2_CYCLE_NOT_FOUND' using errcode = '22023';
  end if;
  if v_cycle.status not in ('draft','planning','active') then
    raise exception 'OKR_V2_CARRY_FORWARD_TARGET_CYCLE_CLOSED: %', v_cycle.status using errcode = '55000';
  end if;
  if p_target_cycle_id = v_obj.cycle_id then
    raise exception 'OKR_V2_CARRY_FORWARD_SAME_CYCLE' using errcode = '22023';
  end if;

  insert into public.okr_objectives (
    title, description, owner_id, sponsor_id, team_id, organization_id, cycle_id,
    objective_level, parent_objective_id, scope_type, status, lifecycle_status,
    start_date, end_date, created_by, updated_by
  ) values (
    v_obj.title, v_obj.description, v_obj.owner_id, v_obj.sponsor_id, v_obj.team_id, p_org_id,
    p_target_cycle_id, v_obj.objective_level, v_obj.parent_objective_id, v_obj.scope_type,
    'on_track', 'draft', v_cycle.starts_at, v_cycle.ends_at, auth.uid(), auth.uid()
  ) returning id into v_new;

  if p_carry_forward_type in ('full_objective','selected_key_results') then
    insert into public.okr_key_results (
      objective_id, title, description, owner_id, unit, direction, update_type,
      metric_code, metric_config, baseline_value, current_value, target_value,
      target_min, target_max, weight, frequency, lifecycle_status,
      allow_overachievement, target, current, created_by, updated_by
    )
    select v_new, kr.title, kr.description, kr.owner_id, kr.unit, kr.direction, kr.update_type,
           kr.metric_code, kr.metric_config, kr.baseline_value, kr.baseline_value, kr.target_value,
           kr.target_min, kr.target_max, kr.weight, kr.frequency, 'draft',
           kr.allow_overachievement, kr.target, 0, auth.uid(), auth.uid()
      from public.okr_key_results kr
     where kr.objective_id = p_objective_id
       and kr.archived_at is null
       and (p_carry_forward_type = 'full_objective'
            or (p_key_result_ids is not null and kr.id = any(p_key_result_ids)));
  end if;

  insert into public.okr_carry_forward_links (
    organization_id, source_cycle_id, source_objective_id, target_cycle_id,
    target_objective_id, carry_forward_type, reason, created_by
  ) values (
    p_org_id, v_obj.cycle_id, p_objective_id, p_target_cycle_id, v_new,
    p_carry_forward_type, p_reason, auth.uid()
  );

  insert into public.okr_audit_log (objective_id, action, actor_id, metadata)
  values (p_objective_id, 'objective_carried_forward', auth.uid(),
          jsonb_build_object('organization_id', p_org_id, 'target_objective_id', v_new,
                             'target_cycle_id', p_target_cycle_id, 'type', p_carry_forward_type,
                             'reason', p_reason));

  return v_new;
end;
$$;

create or replace function public.upsert_okr_cycle_review_v1(
  p_cycle_id uuid,
  p_payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_cycle public.okr_cycles%rowtype;
  v_total integer; v_done integer; v_cancel integer; v_cf integer;
  v_score numeric; v_compliance numeric; v_id uuid;
begin
  select * into v_cycle from public.okr_cycles where id = p_cycle_id;
  if v_cycle.id is null then
    raise exception 'OKR_CYCLE_NOT_FOUND' using errcode = '02000';
  end if;
  perform public._okr_v2_guard(v_cycle.organization_id, 'okr.close_cycle', 'okr.cycle_management');

  select count(*),
         count(*) filter (where lifecycle_status = 'completed'),
         count(*) filter (where lifecycle_status = 'cancelled'),
         avg(coalesce(calculated_progress, 0))
    into v_total, v_done, v_cancel, v_score
    from public.okr_objectives
   where cycle_id = p_cycle_id;

  select count(*) into v_cf
    from public.okr_carry_forward_links where source_cycle_id = p_cycle_id;

  select case when count(*) = 0 then null
              else round(100.0 * count(*) filter (where has_check_in) / count(*), 2) end
    into v_compliance
    from (
      select kr.id, exists (
        select 1 from public.okr_check_ins ci where ci.key_result_id = kr.id
      ) as has_check_in
        from public.okr_key_results kr
        join public.okr_objectives o on o.id = kr.objective_id
       where o.cycle_id = p_cycle_id and kr.archived_at is null
    ) s;

  insert into public.okr_cycle_reviews (
    organization_id, cycle_id, final_score, objectives_total, objectives_completed,
    objectives_cancelled, objectives_carried_forward, check_in_compliance,
    main_achievements, main_failures, cross_team_dependencies, lessons_learned,
    strategic_recommendations
  ) values (
    v_cycle.organization_id, p_cycle_id, round(coalesce(v_score, 0), 2),
    coalesce(v_total, 0), coalesce(v_done, 0), coalesce(v_cancel, 0), coalesce(v_cf, 0), v_compliance,
    nullif(p_payload->>'main_achievements',''),
    nullif(p_payload->>'main_failures',''),
    nullif(p_payload->>'cross_team_dependencies',''),
    nullif(p_payload->>'lessons_learned',''),
    nullif(p_payload->>'strategic_recommendations','')
  )
  on conflict (cycle_id) do update set
    final_score = excluded.final_score,
    objectives_total = excluded.objectives_total,
    objectives_completed = excluded.objectives_completed,
    objectives_cancelled = excluded.objectives_cancelled,
    objectives_carried_forward = excluded.objectives_carried_forward,
    check_in_compliance = excluded.check_in_compliance,
    main_achievements = coalesce(excluded.main_achievements, public.okr_cycle_reviews.main_achievements),
    main_failures = coalesce(excluded.main_failures, public.okr_cycle_reviews.main_failures),
    cross_team_dependencies = coalesce(excluded.cross_team_dependencies, public.okr_cycle_reviews.cross_team_dependencies),
    lessons_learned = coalesce(excluded.lessons_learned, public.okr_cycle_reviews.lessons_learned),
    strategic_recommendations = coalesce(excluded.strategic_recommendations, public.okr_cycle_reviews.strategic_recommendations),
    updated_at = now()
  where public.okr_cycle_reviews.approved_at is null
  returning id into v_id;

  if v_id is null then
    raise exception 'OKR_V2_CYCLE_REVIEW_ALREADY_APPROVED' using errcode = '55000';
  end if;

  return v_id;
end;
$$;

create or replace function public.approve_okr_cycle_review_v1(
  p_cycle_id uuid,
  p_close_cycle boolean default true
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_cycle public.okr_cycles%rowtype;
  v_review public.okr_cycle_reviews%rowtype;
  v_pending integer;
begin
  select * into v_cycle from public.okr_cycles where id = p_cycle_id;
  if v_cycle.id is null then
    raise exception 'OKR_CYCLE_NOT_FOUND' using errcode = '02000';
  end if;
  perform public._okr_v2_guard(v_cycle.organization_id, 'okr.close_cycle', 'okr.cycle_management');

  select * into v_review from public.okr_cycle_reviews where cycle_id = p_cycle_id for update;
  if v_review.id is null then
    raise exception 'OKR_V2_CYCLE_REVIEW_NOT_FOUND' using errcode = '22023';
  end if;

  select count(*) into v_pending
    from public.okr_objectives o
   where o.cycle_id = p_cycle_id
     and coalesce(o.lifecycle_status, 'active') in ('draft','ready','active','paused')
     and not exists (
       select 1 from public.okr_objective_reviews r
        where r.objective_id = o.id and r.review_status = 'approved'
     );

  if v_pending > 0 then
    raise exception 'OKR_V2_CYCLE_REVIEW_PENDING_OBJECTIVES: %', v_pending using errcode = '55000';
  end if;

  if v_review.approved_at is null then
    update public.okr_cycle_reviews
       set approved_by = auth.uid(), approved_at = now(), updated_at = now()
     where id = v_review.id;
  end if;

  if p_close_cycle then
    if v_cycle.status = 'active' then
      perform public.start_okr_cycle_closing_v1(p_cycle_id);
    end if;
    if (select status from public.okr_cycles where id = p_cycle_id) = 'closing' then
      perform public.close_okr_cycle_v1(p_cycle_id);
    end if;
  end if;

  insert into public.okr_audit_log (action, actor_id, metadata)
  values ('cycle_review_approved', auth.uid(),
          jsonb_build_object('cycle_id', p_cycle_id, 'closed', p_close_cycle));
end;
$$;

-- grants
revoke all on function public.list_okr_objective_reviews_v1(uuid, uuid) from public, anon;
revoke all on function public.submit_okr_objective_review_v1(uuid, uuid, jsonb) from public, anon;
revoke all on function public.approve_okr_objective_review_v1(uuid, uuid, boolean, text) from public, anon;
revoke all on function public.carry_forward_okr_objective_v1(uuid, uuid, uuid, text, text, uuid[]) from public, anon;
revoke all on function public.upsert_okr_cycle_review_v1(uuid, jsonb) from public, anon;
revoke all on function public.approve_okr_cycle_review_v1(uuid, boolean) from public, anon;

grant execute on function public.list_okr_objective_reviews_v1(uuid, uuid) to authenticated, service_role;
grant execute on function public.submit_okr_objective_review_v1(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.approve_okr_objective_review_v1(uuid, uuid, boolean, text) to authenticated, service_role;
grant execute on function public.carry_forward_okr_objective_v1(uuid, uuid, uuid, text, text, uuid[]) to authenticated, service_role;
grant execute on function public.upsert_okr_cycle_review_v1(uuid, jsonb) to authenticated, service_role;
grant execute on function public.approve_okr_cycle_review_v1(uuid, boolean) to authenticated, service_role;

commit;