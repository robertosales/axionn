-- Fundação comercial aditiva. Preserva saas_plans, assinaturas e entitlements atuais.
-- Executar exclusivamente pelo Lovable após revisão do diagnóstico.
begin;

create table if not exists public.product_modules (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  domain text not null check (domain in ('operation','intelligence','governance')),
  status text not null default 'active' check (status in ('active','inactive')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_features (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.product_modules(id) on delete restrict,
  code text not null unique,
  name text not null,
  description text,
  feature_type text not null default 'capability' check (feature_type in ('capability','limit','service')),
  usage_unit text,
  status text not null default 'active' check (status in ('active','inactive')),
  dependencies jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saas_plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.saas_plans(id) on delete restrict,
  version integer not null,
  status text not null default 'draft' check (status in ('draft','active','retired')),
  valid_from timestamptz,
  valid_until timestamptz,
  currency text,
  billing_interval text check (billing_interval is null or billing_interval in ('monthly','yearly','custom')),
  base_price numeric,
  per_user_price numeric,
  trial_allowed boolean not null default false,
  trial_days integer check (trial_days is null or trial_days >= 0),
  change_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_id, version),
  check (valid_until is null or valid_from is null or valid_until > valid_from)
);

create table if not exists public.saas_plan_version_features (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.saas_plan_versions(id) on delete cascade,
  feature_id uuid not null references public.product_features(id) on delete restrict,
  access_level text not null default 'full' check (access_level in ('none','basic','full','custom')),
  enabled boolean not null default true,
  limit_value bigint check (limit_value is null or limit_value >= 0),
  reset_period text check (reset_period is null or reset_period in ('daily','monthly','yearly','none')),
  enforcement_mode text not null default 'hard' check (enforcement_mode in ('soft','hard','notify')),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(plan_version_id, feature_id)
);

alter table public.organization_subscriptions
  add column if not exists plan_version_id uuid references public.saas_plan_versions(id) on delete restrict,
  add column if not exists auto_renew boolean not null default false,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists suspended_at timestamptz,
  add column if not exists renewed_at timestamptz;

insert into public.product_modules(code,name,domain,display_order) values
  ('organization','Organização','operation',10), ('projects','Projetos','operation',20),
  ('reports','Relatórios','intelligence',30), ('ai','Inteligência artificial','intelligence',40),
  ('okr','OKR','governance',50), ('audit','Auditoria','governance',60)
on conflict(code) do update set name=excluded.name, domain=excluded.domain, display_order=excluded.display_order;

with features(module_code,code,name,feature_type,usage_unit) as (values
  ('organization','users.max','Limite de usuários','limit','users'),
  ('projects','projects.max','Limite de projetos','limit','projects'),
  ('organization','contracts.max','Limite de contratos','limit','contracts'),
  ('reports','reports.advanced','Relatórios avançados','capability',null),
  ('ai','ai.calls.monthly','Chamadas de IA mensais','limit','calls'),
  ('ai','ai.briefing.enabled','Briefing por IA','capability',null),
  ('okr','okr.view','Visualizar OKRs','capability',null),
  ('okr','okr.automatic_metrics','Medições automáticas de OKR','capability',null),
  ('audit','audit.access','Acesso à auditoria','capability',null)
)
insert into public.product_features(module_id,code,name,feature_type,usage_unit)
select module.id, feature.code, feature.name, feature.feature_type, feature.usage_unit
from features feature join public.product_modules module on module.code=feature.module_code
on conflict(code) do update set module_id=excluded.module_id,name=excluded.name,feature_type=excluded.feature_type,usage_unit=excluded.usage_unit;

-- Cria v1 como fotografia dos planos existentes; não muda seus códigos nem clientes.
insert into public.saas_plan_versions(plan_id,version,status,valid_from,trial_allowed,trial_days,change_reason,metadata)
select plan.id,1,'active',plan.created_at,true,14,'Versão inicial derivada do catálogo legado',
  jsonb_build_object('commercial_code',case plan.code when 'starter' then 'core' when 'pro' then 'intelligence' else plan.code end,'legacy_code',plan.code)
from public.saas_plans plan
on conflict(plan_id,version) do nothing;

insert into public.saas_plan_version_features(plan_version_id,feature_id,access_level,enabled,limit_value,configuration)
select version.id,feature.id,case when entitlement.enabled then 'full' else 'none' end,
  entitlement.enabled,entitlement.limit_value,jsonb_build_object('legacy_entitlement_id',entitlement.id)
from public.saas_plan_entitlements entitlement
join public.saas_plan_versions version on version.plan_id=entitlement.plan_id and version.version=1
join public.product_features feature on feature.code=entitlement.feature_key
on conflict(plan_version_id,feature_id) do nothing;

update public.organization_subscriptions subscription set plan_version_id=version.id
from public.saas_plan_versions version
where subscription.plan_version_id is null and version.plan_id=subscription.plan_id and version.version=1;

create index if not exists idx_product_features_module on public.product_features(module_id,status);
create index if not exists idx_plan_versions_plan_status on public.saas_plan_versions(plan_id,status);
create index if not exists idx_subscription_plan_version on public.organization_subscriptions(plan_version_id);

alter table public.product_modules enable row level security;
alter table public.product_features enable row level security;
alter table public.saas_plan_versions enable row level security;
alter table public.saas_plan_version_features enable row level security;

revoke all on public.product_modules,public.product_features,public.saas_plan_versions,public.saas_plan_version_features from anon,authenticated;
grant select on public.product_modules,public.product_features to authenticated;
grant all on public.product_modules,public.product_features,public.saas_plan_versions,public.saas_plan_version_features to service_role;

drop policy if exists product_modules_authenticated_select on public.product_modules;
create policy product_modules_authenticated_select on public.product_modules for select to authenticated using(status='active');
drop policy if exists product_features_authenticated_select on public.product_features;
create policy product_features_authenticated_select on public.product_features for select to authenticated using(status='active');

comment on table public.saas_plan_versions is 'Versões imutáveis do catálogo comercial; clientes existentes permanecem na versão vinculada.';
comment on column public.saas_plan_versions.metadata is 'Inclui alias comercial durante a transição starter/core e pro/intelligence.';
commit;
