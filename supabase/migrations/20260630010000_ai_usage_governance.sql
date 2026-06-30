-- Axion SaaS — Fase 0
-- Governança transacional de chamadas de IA por empresa/time.

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

create index if not exists idx_ai_usage_events_company_created
  on public.ai_usage_events(company_id, created_at desc);
create index if not exists idx_ai_usage_events_org_created
  on public.ai_usage_events(org_id, created_at desc);
create index if not exists idx_ai_usage_events_team_created
  on public.ai_usage_events(team_id, created_at desc);
create index if not exists idx_ai_usage_events_user_created
  on public.ai_usage_events(user_id, created_at desc);
create index if not exists idx_ai_usage_events_status_created
  on public.ai_usage_events(status, created_at desc);

alter table public.ai_usage_events enable row level security;
revoke all on table public.ai_usage_events from public, anon, authenticated;
grant select, insert, update on table public.ai_usage_events to service_role;

create or replace function public.reserve_ai_usage(
  p_team_id uuid,
  p_user_id uuid,
  p_feature text,
  p_request_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_team_company_id uuid;
  v_team_contract_id uuid;
  v_contract_id uuid;
  v_company_id uuid;
  v_org_id uuid;
  v_license public.licenses%rowtype;
  v_is_member boolean := false;
  v_remaining integer;
begin
  if p_team_id is null then
    raise exception using errcode = 'P0001', message = 'AI_TEAM_REQUIRED';
  end if;

  if nullif(trim(p_feature), '') is null then
    raise exception using errcode = 'P0001', message = 'AI_FEATURE_REQUIRED';
  end if;

  select t.company_id, t.contract_id
    into v_team_company_id, v_team_contract_id
  from public.teams t
  where t.id = p_team_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'AI_TEAM_NOT_FOUND';
  end if;

  v_contract_id := v_team_contract_id;

  if v_contract_id is null then
    select ct.contract_id
      into v_contract_id
    from public.contract_teams ct
    where ct.team_id = p_team_id
    order by ct.created_at desc
    limit 1;
  end if;

  if v_contract_id is null then
    select crt.contract_id
      into v_contract_id
    from public.contract_room_teams crt
    where crt.team_id = p_team_id
      and crt.is_active = true
    order by crt.created_at desc
    limit 1;
  end if;

  if v_contract_id is null then
    select p.contract_id
      into v_contract_id
    from public.projects p
    where p.team_id = p_team_id
      and p.contract_id is not null
    order by p.created_at desc
    limit 1;
  end if;

  if v_contract_id is not null then
    select c.company_id, c.org_id
      into v_company_id, v_org_id
    from public.contracts c
    where c.id = v_contract_id;
  end if;

  v_company_id := coalesce(v_team_company_id, v_company_id);

  if p_user_id is not null then
    select (
      exists (
        select 1
        from public.team_members tm
        where tm.team_id = p_team_id
          and tm.user_id = p_user_id
      )
      or exists (
        select 1
        from public.user_roles ur
        where ur.user_id = p_user_id
          and ur.role = 'admin'
      )
      or (
        v_contract_id is not null
        and exists (
          select 1
          from public.user_contracts uc
          where uc.contract_id = v_contract_id
            and uc.user_id = p_user_id
        )
      )
      or (
        v_contract_id is not null
        and exists (
          select 1
          from public.contract_members cm
          where cm.contract_id = v_contract_id
            and cm.user_id = p_user_id
        )
      )
      or (
        v_org_id is not null
        and exists (
          select 1
          from public.organization_members om
          where om.org_id = v_org_id
            and om.user_id = p_user_id
        )
      )
    ) into v_is_member;

    if not v_is_member then
      raise exception using errcode = 'P0001', message = 'AI_TEAM_ACCESS_DENIED';
    end if;
  end if;

  if v_company_id is null then
    raise exception using errcode = 'P0001', message = 'AI_COMPANY_REQUIRED';
  end if;

  select l.*
    into v_license
  from public.licenses l
  where l.company_id = v_company_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'AI_LICENSE_REQUIRED';
  end if;

  if lower(coalesce(v_license.status, '')) not in ('active', 'trial') then
    raise exception using errcode = 'P0001', message = 'AI_LICENSE_INACTIVE';
  end if;

  if v_license.valid_until < current_date then
    raise exception using errcode = 'P0001', message = 'AI_LICENSE_EXPIRED';
  end if;

  if v_license.quota_reset_at <= now() then
    update public.licenses
       set ai_calls_used = 0,
           pf_used_month = 0,
           quota_reset_at = date_trunc('month', now()) + interval '1 month',
           updated_at = now()
     where id = v_license.id
     returning * into v_license;
  end if;

  if v_license.ai_calls_quota is not null
     and v_license.ai_calls_used >= v_license.ai_calls_quota then
    raise exception using errcode = 'P0001', message = 'AI_QUOTA_EXCEEDED';
  end if;

  update public.licenses
     set ai_calls_used = ai_calls_used + 1,
         updated_at = now()
   where id = v_license.id
   returning * into v_license;

  insert into public.ai_usage_events (
    request_id,
    company_id,
    org_id,
    team_id,
    user_id,
    feature,
    status,
    units
  ) values (
    p_request_id,
    v_company_id,
    v_org_id,
    p_team_id,
    p_user_id,
    trim(p_feature),
    'reserved',
    1
  );

  v_remaining := case
    when v_license.ai_calls_quota is null then null
    else greatest(v_license.ai_calls_quota - v_license.ai_calls_used, 0)
  end;

  return jsonb_build_object(
    'request_id', p_request_id,
    'company_id', v_company_id,
    'org_id', v_org_id,
    'team_id', p_team_id,
    'license_id', v_license.id,
    'plan', v_license.plan,
    'quota', v_license.ai_calls_quota,
    'used', v_license.ai_calls_used,
    'remaining', v_remaining,
    'mode', 'enforced'
  );
end;
$$;

create or replace function public.finalize_ai_usage(
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
    raise exception using errcode = 'P0001', message = 'AI_USAGE_STATUS_INVALID';
  end if;

  update public.ai_usage_events
     set status = p_status,
         provider_id = p_provider_id,
         error_code = nullif(trim(p_error_code), ''),
         metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
         completed_at = now()
   where request_id = p_request_id
     and status = 'reserved';
end;
$$;

revoke all on function public.reserve_ai_usage(uuid, uuid, text, uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_ai_usage(uuid, text, uuid, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.reserve_ai_usage(uuid, uuid, text, uuid)
  to service_role;
grant execute on function public.finalize_ai_usage(uuid, text, uuid, text, jsonb)
  to service_role;

-- Funções que retornam segredos nunca devem estar disponíveis via API pública.
do $$
declare
  v_signature regprocedure;
begin
  for v_signature in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'get_service_role_key',
        'get_ai_provider_key',
        'get_ai_provider_key_by_id',
        'get_project_api_url'
      )
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      v_signature
    );
    execute format(
      'grant execute on function %s to service_role',
      v_signature
    );
  end loop;
end
$$;
