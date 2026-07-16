-- Fase 2 comercial: trials, add-ons, contratos e transições auditáveis.
-- Executar exclusivamente pelo Lovable.
begin;

alter table public.organization_subscriptions
  drop constraint if exists organization_subscriptions_status_check;
alter table public.organization_subscriptions
  add constraint organization_subscriptions_status_check check (status in ('pending','trialing','active','past_due','suspended','canceled','expired'));

alter table public.organization_entitlement_overrides
  add column if not exists feature_id uuid references public.product_features(id) on delete restrict,
  add column if not exists source_type text not null default 'manual' check (source_type in ('manual','contract','addon','migration')),
  add column if not exists source_id uuid,
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz;
do $$ begin
 if not exists(select 1 from pg_constraint where conname='organization_entitlement_override_period_check') then
  alter table public.organization_entitlement_overrides add constraint organization_entitlement_override_period_check check (ends_at is null or starts_at is null or ends_at > starts_at);
 end if;
end $$;

update public.organization_entitlement_overrides override_row set feature_id=feature.id
from public.product_features feature where override_row.feature_id is null and feature.code=override_row.feature_key;

create table if not exists public.saas_trials (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.organization_subscriptions(id) on delete set null,
  plan_version_id uuid not null references public.saas_plan_versions(id) on delete restrict,
  status text not null default 'scheduled' check (status in ('scheduled','trialing','converted','expired','canceled')),
  starts_at timestamptz not null, ends_at timestamptz not null, converted_at timestamptz, canceled_at timestamptz,
  source text not null default 'manual', limits jsonb not null default '{}'::jsonb, features jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create unique index if not exists idx_saas_trials_one_current on public.saas_trials(organization_id)
where status in ('scheduled','trialing');

create table if not exists public.saas_addons (
  id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, description text,
  status text not null default 'active' check (status in ('active','inactive','archived')), unit text,
  currency text, price numeric check (price is null or price >= 0), billing_interval text check (billing_interval is null or billing_interval in ('monthly','yearly','custom')),
  configuration jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.saas_addon_features (
  addon_id uuid not null references public.saas_addons(id) on delete cascade,
  feature_id uuid not null references public.product_features(id) on delete restrict,
  enabled boolean not null default true, limit_delta bigint, configuration jsonb not null default '{}'::jsonb,
  primary key(addon_id,feature_id)
);

create table if not exists public.organization_subscription_addons (
  id uuid primary key default gen_random_uuid(), subscription_id uuid not null references public.organization_subscriptions(id) on delete cascade,
  addon_id uuid not null references public.saas_addons(id) on delete restrict, quantity numeric not null default 1 check (quantity > 0),
  status text not null default 'active' check (status in ('scheduled','active','suspended','canceled','expired')),
  starts_at timestamptz not null default now(), ends_at timestamptz, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

-- Liga o contrato operacional existente à assinatura sem criar contrato concorrente.
alter table public.contracts
  add column if not exists subscription_id uuid references public.organization_subscriptions(id) on delete set null,
  add column if not exists plan_version_id uuid references public.saas_plan_versions(id) on delete restrict,
  add column if not exists contract_number text,
  add column if not exists currency text,
  add column if not exists commercial_amount numeric,
  add column if not exists discount_percent numeric check (discount_percent is null or discount_percent between 0 and 100),
  add column if not exists commercial_owner_id uuid references auth.users(id) on delete set null,
  add column if not exists commercial_terms jsonb not null default '{}'::jsonb;

create index if not exists idx_trials_org_status on public.saas_trials(organization_id,status);
create index if not exists idx_subscription_addons_subscription on public.organization_subscription_addons(subscription_id,status);
create index if not exists idx_overrides_effective on public.organization_entitlement_overrides(org_id,feature_key,starts_at,ends_at);

-- Overrides fora da vigência deixam de participar da resolução efetiva.
create or replace function public.get_effective_organization_entitlements(p_org_id uuid)
returns table(org_id uuid,plan_code text,subscription_status text,feature_key text,enabled boolean,limit_value bigint,source text)
language sql stable security definer set search_path=public,pg_temp as $$
with context as (
 select s.org_id,s.status subscription_status,p.id plan_id,p.code plan_code from public.organization_subscriptions s join public.saas_plans p on p.id=s.plan_id where s.org_id=p_org_id
), keys as (
 select e.feature_key from context c join public.saas_plan_entitlements e on e.plan_id=c.plan_id
 union select o.feature_key from public.organization_entitlement_overrides o where o.org_id=p_org_id and (o.starts_at is null or o.starts_at<=now()) and (o.ends_at is null or o.ends_at>now())
)
select c.org_id,c.plan_code,c.subscription_status,k.feature_key,
 coalesce(o.enabled,e.enabled,false),coalesce(o.limit_value,e.limit_value),
 case when o.id is not null and (o.enabled is not null or o.limit_value is not null) then o.source_type else case when e.id is not null then 'plan' else 'missing' end end
from context c join keys k on true
left join public.saas_plan_entitlements e on e.plan_id=c.plan_id and e.feature_key=k.feature_key
left join public.organization_entitlement_overrides o on o.org_id=c.org_id and o.feature_key=k.feature_key and (o.starts_at is null or o.starts_at<=now()) and (o.ends_at is null or o.ends_at>now())
order by k.feature_key $$;

create or replace function public.transition_platform_subscription_v2(p_org_id uuid,p_plan_version_id uuid,p_target_status text,p_effective_at timestamptz,p_reason text,p_mode text default 'immediate')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=auth.uid(); v_subscription public.organization_subscriptions%rowtype; v_target public.saas_plan_versions%rowtype; v_allowed boolean; v_before jsonb;
begin
 perform public.assert_platform_admin_v2();
 if nullif(trim(p_reason),'') is null then raise exception using errcode='22023',message='transition_reason_required'; end if;
 if p_mode not in ('immediate','scheduled','renewal') then raise exception using errcode='22023',message='invalid_transition_mode'; end if;
 select * into v_subscription from public.organization_subscriptions where org_id=p_org_id for update;
 if v_subscription.id is null then raise exception using errcode='P0002',message='subscription_not_found'; end if;
 select * into v_target from public.saas_plan_versions where id=p_plan_version_id and status='active';
 if v_target.id is null then raise exception using errcode='P0002',message='plan_version_not_found'; end if;
 v_allowed:=case v_subscription.status when 'pending' then p_target_status in ('trialing','active','canceled') when 'trialing' then p_target_status in ('active','expired','canceled','suspended') when 'active' then p_target_status in ('active','past_due','suspended','canceled','expired') when 'past_due' then p_target_status in ('active','suspended','canceled') when 'suspended' then p_target_status in ('active','canceled','expired') when 'expired' then p_target_status='active' else false end;
 if not v_allowed then raise exception using errcode='22023',message='invalid_subscription_transition'; end if;
 v_before:=to_jsonb(v_subscription);
 if p_mode='immediate' or coalesce(p_effective_at,now())<=now() then
  update public.organization_subscriptions set plan_id=v_target.plan_id,plan_version_id=v_target.id,status=p_target_status,
   suspended_at=case when p_target_status='suspended' then now() else null end,
   canceled_at=case when p_target_status='canceled' then now() else null end,updated_at=now() where id=v_subscription.id;
 else
  update public.organization_subscriptions set metadata=metadata||jsonb_build_object('scheduled_change',jsonb_build_object('plan_version_id',v_target.id,'status',p_target_status,'effective_at',p_effective_at,'mode',p_mode,'reason',p_reason)),updated_at=now() where id=v_subscription.id;
 end if;
 insert into public.platform_operational_audit_log(actor_id,action,resource_type,resource_id,before_values,after_values,metadata)
 values(v_actor,'subscription_transition','organization_subscription',v_subscription.id,v_before,(select to_jsonb(s) from public.organization_subscriptions s where s.id=v_subscription.id),jsonb_build_object('reason',p_reason,'mode',p_mode,'effective_at',p_effective_at));
 return v_subscription.id;
end $$;

create or replace function public.upsert_platform_organization_entitlement_override_v2(p_org_id uuid,p_feature_key text,p_enabled boolean,p_limit_value bigint,p_reason text,p_starts_at timestamptz,p_ends_at timestamptz,p_source_type text default 'manual',p_source_id uuid default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_actor uuid:=auth.uid(); v_feature public.product_features%rowtype;
begin
 perform public.assert_platform_admin_v2();
 if nullif(trim(p_reason),'') is null then raise exception using errcode='22023',message='override_reason_required'; end if;
 if p_ends_at is not null and p_starts_at is not null and p_ends_at<=p_starts_at then raise exception using errcode='22023',message='invalid_override_period'; end if;
 select * into v_feature from public.product_features where code=lower(trim(p_feature_key)) and status='active';
 if v_feature.id is null then raise exception using errcode='P0002',message='feature_not_found'; end if;
 insert into public.organization_entitlement_overrides(org_id,feature_id,feature_key,enabled,limit_value,reason,starts_at,ends_at,source_type,source_id,created_by)
 values(p_org_id,v_feature.id,v_feature.code,p_enabled,p_limit_value,trim(p_reason),p_starts_at,p_ends_at,p_source_type,p_source_id,v_actor)
 on conflict(org_id,feature_key) do update set feature_id=excluded.feature_id,enabled=excluded.enabled,limit_value=excluded.limit_value,reason=excluded.reason,starts_at=excluded.starts_at,ends_at=excluded.ends_at,source_type=excluded.source_type,source_id=excluded.source_id
 returning id into v_id;
 insert into public.platform_operational_audit_log(actor_id,action,resource_type,resource_id,after_values,metadata) values(v_actor,'organization_entitlement_override_upserted_v2','organization_entitlement_override',v_id,jsonb_build_object('feature_key',v_feature.code,'enabled',p_enabled,'limit_value',p_limit_value,'starts_at',p_starts_at,'ends_at',p_ends_at),jsonb_build_object('reason',p_reason,'source_type',p_source_type));
 return v_id;
end $$;

create or replace function public.list_platform_organization_subscriptions_v1()
returns table(org_id uuid,org_name text,org_slug text,org_status text,org_plan text,subscription_id uuid,plan_id uuid,plan_code text,plan_name text,subscription_status text,starts_at timestamptz,trial_ends_at timestamptz,current_period_start timestamptz,current_period_end timestamptz,canceled_at timestamptz,source text,users_used bigint,projects_used bigint,contracts_used bigint,overrides jsonb)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
 perform public.assert_platform_admin_v2();
 return query select organization.id,organization.name,organization.slug,organization.status::text,organization.plan::text,
 subscription.id,plan.id,plan.code,plan.name,subscription.status,subscription.starts_at,subscription.trial_ends_at,subscription.current_period_start,subscription.current_period_end,subscription.canceled_at,subscription.source,
 (select count(*) from public.organization_members member where member.org_id=organization.id)::bigint,
 (select count(*) from public.projects project where project.org_id=organization.id)::bigint,
 (select count(*) from public.contracts contract where contract.org_id=organization.id)::bigint,
 coalesce((select jsonb_agg(jsonb_build_object('id',override_row.id,'feature_key',override_row.feature_key,'enabled',override_row.enabled,'limit_value',override_row.limit_value,'reason',override_row.reason,'starts_at',override_row.starts_at,'ends_at',override_row.ends_at,'source_type',override_row.source_type,'created_at',override_row.created_at,'updated_at',override_row.updated_at) order by override_row.feature_key) from public.organization_entitlement_overrides override_row where override_row.org_id=organization.id),'[]'::jsonb)
 from public.organizations organization left join public.organization_subscriptions subscription on subscription.org_id=organization.id left join public.saas_plans plan on plan.id=subscription.plan_id order by organization.name;
end $$;

alter table public.saas_trials enable row level security; alter table public.saas_addons enable row level security; alter table public.saas_addon_features enable row level security; alter table public.organization_subscription_addons enable row level security;
revoke all on public.saas_trials,public.saas_addons,public.saas_addon_features,public.organization_subscription_addons from anon,authenticated;
grant all on public.saas_trials,public.saas_addons,public.saas_addon_features,public.organization_subscription_addons to service_role;
revoke all on function public.transition_platform_subscription_v2(uuid,uuid,text,timestamptz,text,text) from public,anon; grant execute on function public.transition_platform_subscription_v2(uuid,uuid,text,timestamptz,text,text) to authenticated,service_role;
revoke all on function public.upsert_platform_organization_entitlement_override_v2(uuid,text,boolean,bigint,text,timestamptz,timestamptz,text,uuid) from public,anon; grant execute on function public.upsert_platform_organization_entitlement_override_v2(uuid,text,boolean,bigint,text,timestamptz,timestamptz,text,uuid) to authenticated,service_role;
commit;
