-- Axionn Commercial Module — Complete Schema
-- Fase 1: Fundação do catálogo comercial, assinaturas, contratos, trials, add-ons, overrides, uso
-- Executar exclusivamente pelo Lovable
begin;

-- ============================================================
-- 1. CATÁLOGO DE PRODUTO: MÓDULOS E FUNCIONALIDADES
-- ============================================================

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

-- ============================================================
-- 2. PLANOS COMERCIAIS E VERSIONAMENTO
-- ============================================================

create table if not exists public.saas_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  audience text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  display_order integer not null default 0,
  is_public boolean not null default true,
  requires_sales_contact boolean not null default false,
  trial_allowed boolean not null default true,
  trial_days_default integer check (trial_days_default is null or trial_days_default >= 0),
  currency text not null default 'BRL',
  billing_interval text check (billing_interval in ('monthly','yearly','custom')),
  base_price numeric,
  per_user_price numeric,
  valid_from timestamptz,
  valid_until timestamptz,
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

-- ============================================================
-- 3. ASSINATURAS DA ORGANIZAÇÃO
-- ============================================================

create table if not exists public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.saas_plans(id) on delete restrict,
  plan_version_id uuid references public.saas_plan_versions(id) on delete restrict,
  status text not null check (status in ('pending','trialing','active','past_due','suspended','canceled','expired')),
  starts_at timestamptz not null default now(),
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  suspended_at timestamptz,
  renewed_at timestamptz,
  auto_renew boolean not null default false,
  cancel_at_period_end boolean not null default false,
  cancel_reason text,
  source text not null default 'manual' check (source in ('manual','legacy','contract','billing_provider')),
  external_customer_id text,
  external_subscription_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 4. CONTRATOS COMERCIAIS
-- ============================================================

create table if not exists public.saas_contracts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.organization_subscriptions(id) on delete set null,
  plan_version_id uuid references public.saas_plan_versions(id) on delete restrict,
  contract_number text not null unique,
  status text not null default 'draft' check (status in ('draft','active','expired','terminated','renewed')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  amount numeric,
  currency text not null default 'BRL',
  billing_interval text check (billing_interval in ('monthly','yearly','custom')),
  discount_percent numeric check (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100)),
  commercial_owner_id uuid references auth.users(id) on delete set null,
  terms jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  addons jsonb not null default '[]'::jsonb,
  documents jsonb not null default '[]'::jsonb,
  renewal jsonb not null default '{}'::jsonb,
  cancellation jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 5. TRIALS
-- ============================================================

create table if not exists public.saas_trials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.organization_subscriptions(id) on delete set null,
  plan_version_id uuid not null references public.saas_plan_versions(id) on delete restrict,
  status text not null default 'scheduled' check (status in ('scheduled','trialing','converted','expired','canceled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  converted_at timestamptz,
  canceled_at timestamptz,
  source text not null default 'manual',
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create unique index if not exists idx_saas_trials_one_current on public.saas_trials(organization_id)
where status in ('scheduled','trialing');

-- ============================================================
-- 6. ADD-ONS
-- ============================================================

create table if not exists public.saas_addons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active','inactive','archived')),
  unit text,
  currency text,
  price numeric check (price is null or price >= 0),
  billing_interval text check (billing_interval in ('monthly','yearly','custom')),
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saas_addon_features (
  addon_id uuid not null references public.saas_addons(id) on delete cascade,
  feature_id uuid not null references public.product_features(id) on delete restrict,
  enabled boolean not null default true,
  limit_delta bigint,
  configuration jsonb not null default '{}'::jsonb,
  primary key(addon_id, feature_id)
);

create table if not exists public.organization_subscription_addons (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.organization_subscriptions(id) on delete cascade,
  addon_id uuid not null references public.saas_addons(id) on delete restrict,
  quantity numeric not null default 1 check (quantity > 0),
  status text not null default 'active' check (status in ('scheduled','active','suspended','canceled','expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

-- ============================================================
-- 7. OVERRIDES DE ENTITLEMENTS E LIMITES
-- ============================================================

create table if not exists public.organization_entitlement_overrides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  feature_id uuid references public.product_features(id) on delete restrict,
  feature_key text not null,
  enabled boolean,
  limit_value bigint,
  reason text,
  source_type text not null default 'manual' check (source_type in ('manual','contract','addon','migration')),
  source_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(org_id, feature_key),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

-- ============================================================
-- 8. USO E CONSUMO NORMALIZADO
-- ============================================================

create table if not exists public.organization_usage_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  usage_code text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  used_value numeric not null default 0 check (used_value >= 0),
  source text not null,
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (period_end > period_start)
);

create table if not exists public.commercial_enforcement_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feature_code text not null,
  decision text not null check (decision in ('allowed','warning','denied')),
  used_value numeric,
  limit_value numeric,
  reason text not null,
  actor_id uuid references auth.users(id) on delete set null,
  correlation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 9. AUDITORIA COMERCIAL
-- ============================================================

create table if not exists public.commercial_audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  reason text,
  actor_id uuid references auth.users(id) on delete set null,
  source text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 10. ÍNDICES
-- ============================================================

create index if not exists idx_product_features_module on public.product_features(module_id, status);
create index if not exists idx_plan_versions_plan_status on public.saas_plan_versions(plan_id, status);
create index if not exists idx_subscription_plan_version on public.organization_subscriptions(plan_version_id);
create index if not exists idx_contracts_org_status on public.saas_contracts(org_id, status);
create index if not exists idx_trials_org_status on public.saas_trials(organization_id, status);
create index if not exists idx_subscription_addons_sub on public.organization_subscription_addons(subscription_id, status);
create index if not exists idx_overrides_effective on public.organization_entitlement_overrides(org_id, feature_key, starts_at, ends_at);
create index if not exists idx_usage_org_code_period on public.organization_usage_records(organization_id, usage_code, period_start desc);
create index if not exists idx_enforcement_org_time on public.commercial_enforcement_events(organization_id, created_at desc);
create index if not exists idx_enforcement_denied on public.commercial_enforcement_events(feature_code, created_at desc) where decision = 'denied';
create index if not exists idx_commercial_audit_org_time on public.commercial_audit_logs(org_id, created_at desc);

-- ============================================================
-- 11. TRIGGERS DE UPDATED_AT
-- ============================================================

create or replace function public.touch_commercial_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists trg_product_modules_updated_at on public.product_modules;
create trigger trg_product_modules_updated_at before update on public.product_modules for each row execute function public.touch_commercial_updated_at();

drop trigger if exists trg_product_features_updated_at on public.product_features;
create trigger trg_product_features_updated_at before update on public.product_features for each row execute function public.touch_commercial_updated_at();

drop trigger if exists trg_saas_plans_updated_at on public.saas_plans;
create trigger trg_saas_plans_updated_at before update on public.saas_plans for each row execute function public.touch_commercial_updated_at();

drop trigger if exists trg_saas_plan_versions_updated_at on public.saas_plan_versions;
create trigger trg_saas_plan_versions_updated_at before update on public.saas_plan_versions for each row execute function public.touch_commercial_updated_at();

drop trigger if exists trg_saas_plan_version_features_updated_at on public.saas_plan_version_features;
create trigger trg_saas_plan_version_features_updated_at before update on public.saas_plan_version_features for each row execute function public.touch_commercial_updated_at();

drop trigger if exists trg_org_subscriptions_updated_at on public.organization_subscriptions;
create trigger trg_org_subscriptions_updated_at before update on public.organization_subscriptions for each row execute function public.touch_commercial_updated_at();

drop trigger if exists trg_saas_contracts_updated_at on public.saas_contracts;
create trigger trg_saas_contracts_updated_at before update on public.saas_contracts for each row execute function public.touch_commercial_updated_at();

drop trigger if exists trg_saas_trials_updated_at on public.saas_trials;
create trigger trg_saas_trials_updated_at before update on public.saas_trials for each row execute function public.touch_commercial_updated_at();

drop trigger if exists trg_saas_addons_updated_at on public.saas_addons;
create trigger trg_saas_addons_updated_at before update on public.saas_addons for each row execute function public.touch_commercial_updated_at();

drop trigger if exists trg_org_entitlement_overrides_updated_at on public.organization_entitlement_overrides;
create trigger trg_org_entitlement_overrides_updated_at before update on public.organization_entitlement_overrides for each row execute function public.touch_commercial_updated_at();

commit;