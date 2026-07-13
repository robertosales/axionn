-- Axionn Briefing - governanca de uso alinhada ao modelo SaaS por organizacao.

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  company_id uuid references public.companies(id) on delete set null,
  org_id uuid references public.organizations(id) on delete set null,
  team_id uuid not null references public.teams(id) on delete restrict,
  user_id uuid,
  provider_id uuid references public.ai_providers(id) on delete set null,
  feature text not null,
  status text not null default 'reserved'
    check (status in ('reserved', 'success', 'failed')),
  units integer not null default 1 check (units > 0),
  error_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_ai_usage_events_org_feature_created
  on public.ai_usage_events(org_id, feature, created_at desc);

alter table public.ai_usage_events enable row level security;
revoke all on table public.ai_usage_events from public, anon, authenticated;
grant select, insert, update on table public.ai_usage_events to service_role;

create or replace function public.reserve_ai_briefing_usage(
  p_org_id uuid,
  p_team_id uuid,
  p_user_id uuid,
  p_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team_company_id uuid;
  v_resolved_org_id uuid;
  v_limit bigint;
  v_used bigint;
  v_period_start timestamptz := date_trunc('month', now());
begin
  if p_org_id is null or p_team_id is null or p_user_id is null
     or p_request_id is null then
    raise exception using errcode = '22023', message = 'AI_BRIEFING_USAGE_CONTEXT_REQUIRED';
  end if;

  select team.company_id, coalesce(team.org_id, public.resolve_team_org_id(team.id))
    into v_team_company_id, v_resolved_org_id
  from public.teams team
  where team.id = p_team_id;

  if not found or v_resolved_org_id is distinct from p_org_id then
    raise exception using errcode = '42501', message = 'AI_BRIEFING_TEAM_ORG_INVALID';
  end if;

  if not public.is_organization_member(p_org_id, p_user_id)
     or (
       not public.is_organization_admin(p_org_id, p_user_id)
       and not exists (
         select 1
         from public.team_members member
         where member.team_id = p_team_id
           and member.user_id = p_user_id
       )
     ) then
    raise exception using errcode = '42501', message = 'AI_BRIEFING_USAGE_ACCESS_DENIED';
  end if;

  select entitlement.limit_value
    into v_limit
  from public.get_effective_organization_entitlements(p_org_id) entitlement
  where entitlement.feature_key = 'ai.briefing.runs.monthly'
    and entitlement.enabled;

  if not found then
    raise exception using errcode = '42501', message = 'AI_BRIEFING_USAGE_ENTITLEMENT_REQUIRED';
  end if;

  -- Serializa reservas da mesma organizacao/mes para impedir ultrapassagem
  -- concorrente do limite.
  perform pg_advisory_xact_lock(
    hashtextextended(
      p_org_id::text || ':ai.briefing:' || v_period_start::text,
      0
    )
  );

  select count(*)
    into v_used
  from public.ai_usage_events event
  where event.org_id = p_org_id
    and event.feature = 'ai.briefing'
    and event.created_at >= v_period_start;

  if v_limit is not null and v_used >= v_limit then
    raise exception using errcode = 'P0001', message = 'AI_BRIEFING_MONTHLY_LIMIT_EXCEEDED';
  end if;

  insert into public.ai_usage_events (
    request_id,
    company_id,
    org_id,
    team_id,
    user_id,
    feature,
    status
  )
  values (
    p_request_id,
    v_team_company_id,
    p_org_id,
    p_team_id,
    p_user_id,
    'ai.briefing',
    'reserved'
  );

  return jsonb_build_object(
    'request_id', p_request_id,
    'org_id', p_org_id,
    'team_id', p_team_id,
    'limit', v_limit,
    'used', v_used + 1,
    'remaining', case
      when v_limit is null then null
      else greatest(v_limit - v_used - 1, 0)
    end
  );
end;
$$;

create or replace function public.finalize_ai_briefing_usage(
  p_request_id uuid,
  p_status text,
  p_provider_id uuid default null,
  p_error_code text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_status not in ('success', 'failed') then
    raise exception using errcode = '22023', message = 'AI_USAGE_STATUS_INVALID';
  end if;

  update public.ai_usage_events
  set status = p_status,
      provider_id = p_provider_id,
      error_code = nullif(btrim(p_error_code), ''),
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
      completed_at = now()
  where request_id = p_request_id
    and feature = 'ai.briefing'
    and status = 'reserved';
end;
$$;

revoke all on function public.reserve_ai_briefing_usage(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_ai_briefing_usage(uuid, text, uuid, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.reserve_ai_briefing_usage(uuid, uuid, uuid, uuid)
  to service_role;
grant execute on function public.finalize_ai_briefing_usage(uuid, text, uuid, text, jsonb)
  to service_role;

