-- Fase 3 comercial: uso normalizado, add-ons efetivos e enforcement auditável.
-- Executar exclusivamente pelo Lovable.
begin;

create table if not exists public.organization_usage_records (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  usage_code text not null, period_start timestamptz not null, period_end timestamptz not null,
  used_value numeric not null default 0 check (used_value >= 0), source text not null,
  idempotency_key text unique, metadata jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(), created_at timestamptz not null default now(),
  check (period_end > period_start)
);

create table if not exists public.commercial_enforcement_events (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  feature_code text not null, decision text not null check (decision in ('allowed','warning','denied')),
  used_value numeric, limit_value numeric, reason text not null, actor_id uuid references auth.users(id) on delete set null,
  correlation_id uuid, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create index if not exists idx_usage_org_code_period on public.organization_usage_records(organization_id,usage_code,period_start desc);
create index if not exists idx_enforcement_org_time on public.commercial_enforcement_events(organization_id,created_at desc);
create index if not exists idx_enforcement_denied on public.commercial_enforcement_events(feature_code,created_at desc) where decision='denied';

-- Plano + add-ons ativos + override vigente. Override continua com precedência final.
create or replace function public.get_effective_organization_entitlements(p_org_id uuid)
returns table(org_id uuid,plan_code text,subscription_status text,feature_key text,enabled boolean,limit_value bigint,source text)
language sql stable security definer set search_path=public,pg_temp as $$
with context as (
 select s.id subscription_id,s.org_id,s.status subscription_status,p.id plan_id,p.code plan_code
 from public.organization_subscriptions s join public.saas_plans p on p.id=s.plan_id where s.org_id=p_org_id
), addon_values as (
 select f.code feature_key,bool_or(af.enabled) enabled,sum(coalesce(af.limit_delta,0)*sa.quantity)::bigint limit_delta
 from context c join public.organization_subscription_addons sa on sa.subscription_id=c.subscription_id and sa.status='active' and sa.starts_at<=now() and (sa.ends_at is null or sa.ends_at>now())
 join public.saas_addon_features af on af.addon_id=sa.addon_id join public.product_features f on f.id=af.feature_id group by f.code
), keys as (
 select e.feature_key from context c join public.saas_plan_entitlements e on e.plan_id=c.plan_id
 union select feature_key from addon_values
 union select o.feature_key from public.organization_entitlement_overrides o where o.org_id=p_org_id and (o.starts_at is null or o.starts_at<=now()) and (o.ends_at is null or o.ends_at>now())
)
select c.org_id,c.plan_code,c.subscription_status,k.feature_key,
 coalesce(o.enabled,(coalesce(e.enabled,false) or coalesce(a.enabled,false)),false),
 coalesce(o.limit_value,case when e.id is null then a.limit_delta when e.limit_value is null then null else e.limit_value+coalesce(a.limit_delta,0) end),
 case when o.id is not null and (o.enabled is not null or o.limit_value is not null) then o.source_type when a.feature_key is not null then 'addon' when e.id is not null then 'plan' else 'missing' end
from context c join keys k on true
left join public.saas_plan_entitlements e on e.plan_id=c.plan_id and e.feature_key=k.feature_key
left join addon_values a on a.feature_key=k.feature_key
left join public.organization_entitlement_overrides o on o.org_id=c.org_id and o.feature_key=k.feature_key and (o.starts_at is null or o.starts_at<=now()) and (o.ends_at is null or o.ends_at>now())
order by k.feature_key $$;

create or replace function public.record_organization_usage_v1(p_org_id uuid,p_usage_code text,p_used_value numeric,p_period_start timestamptz,p_period_end timestamptz,p_source text,p_idempotency_key text,p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if auth.role()<>'service_role' then raise exception using errcode='42501',message='usage_record_service_role_required'; end if;
 if p_used_value<0 or p_period_end<=p_period_start then raise exception using errcode='22023',message='invalid_usage_record'; end if;
 insert into public.organization_usage_records(organization_id,usage_code,used_value,period_start,period_end,source,idempotency_key,metadata)
 values(p_org_id,lower(trim(p_usage_code)),p_used_value,p_period_start,p_period_end,trim(p_source),p_idempotency_key,coalesce(p_metadata,'{}'::jsonb))
 on conflict(idempotency_key) do update set used_value=excluded.used_value,metadata=excluded.metadata,calculated_at=now() returning id into v_id;
 return v_id;
end $$;

create or replace function public.get_my_commercial_usage_v1(p_org_id uuid)
returns table(usage_code text,used_value numeric,limit_value bigint,remaining_value numeric,usage_percent numeric,status text,source text,period_start timestamptz,period_end timestamptz,calculated_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or not public.is_organization_member(p_org_id,auth.uid()) then raise exception using errcode='42501',message='commercial_usage_access_denied'; end if;
 return query with latest as (
  select distinct on(r.usage_code) r.* from public.organization_usage_records r where r.organization_id=p_org_id order by r.usage_code,r.calculated_at desc
 ) select l.usage_code,l.used_value,e.limit_value,
  case when e.limit_value is null then null else greatest(e.limit_value-l.used_value,0) end,
  case when e.limit_value is null or e.limit_value=0 then null else least(100,round(l.used_value/e.limit_value*100,2)) end,
  case when e.limit_value is null then 'unlimited' when l.used_value>=e.limit_value then 'reached' when e.limit_value>0 and l.used_value/e.limit_value>=.8 then 'warning' else 'ok' end,
  l.source,l.period_start,l.period_end,l.calculated_at
 from latest l left join public.get_effective_organization_entitlements(p_org_id) e on e.feature_key=l.usage_code order by l.usage_code;
end $$;

create or replace function public.check_commercial_usage_v1(p_org_id uuid,p_feature_code text,p_increment numeric default 1,p_correlation_id uuid default null)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_ent record; v_used numeric:=0; v_decision text:='allowed'; v_reason text:='within_limit';
begin
 if auth.role()<>'service_role' then raise exception using errcode='42501',message='commercial_enforcement_service_role_required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(format('commercial:%s:%s',p_org_id,p_feature_code),0));
 select * into v_ent from public.get_effective_organization_entitlements(p_org_id) e where e.feature_key=p_feature_code;
 if v_ent.feature_key is null or not v_ent.enabled or v_ent.subscription_status not in('active','trialing') then v_decision:='denied';v_reason:='entitlement_denied';
 else
  select coalesce(r.used_value,0) into v_used from public.organization_usage_records r where r.organization_id=p_org_id and r.usage_code=p_feature_code and r.period_start<=now() and r.period_end>now() order by r.calculated_at desc limit 1;
  if v_ent.limit_value is not null and v_used+p_increment>v_ent.limit_value then v_decision:='denied';v_reason:='limit_exceeded';
  elsif v_ent.limit_value is not null and v_ent.limit_value>0 and (v_used+p_increment)/v_ent.limit_value>=.8 then v_decision:='warning';v_reason:='limit_near'; end if;
 end if;
 insert into public.commercial_enforcement_events(organization_id,feature_code,decision,used_value,limit_value,reason,actor_id,correlation_id,metadata)
 values(p_org_id,p_feature_code,v_decision,v_used,v_ent.limit_value,v_reason,auth.uid(),p_correlation_id,jsonb_build_object('increment',p_increment));
 return v_decision<>'denied';
end $$;

alter table public.organization_usage_records enable row level security; alter table public.commercial_enforcement_events enable row level security;
revoke all on public.organization_usage_records,public.commercial_enforcement_events from anon,authenticated;
grant all on public.organization_usage_records,public.commercial_enforcement_events to service_role;
revoke all on function public.record_organization_usage_v1(uuid,text,numeric,timestamptz,timestamptz,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_organization_usage_v1(uuid,text,numeric,timestamptz,timestamptz,text,text,jsonb) to service_role;
revoke all on function public.get_my_commercial_usage_v1(uuid) from public,anon; grant execute on function public.get_my_commercial_usage_v1(uuid) to authenticated,service_role;
revoke all on function public.check_commercial_usage_v1(uuid,text,numeric,uuid) from public,anon,authenticated; grant execute on function public.check_commercial_usage_v1(uuid,text,numeric,uuid) to service_role;
comment on function public.check_commercial_usage_v1 is 'Retorna false e preserva evento auditável; o chamador backend deve bloquear a operação quando false.';
commit;
