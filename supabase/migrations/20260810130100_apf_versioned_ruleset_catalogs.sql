-- APF Etapa 3 / M2: typed catalogs owned by an APF profile version.
-- Critical financial policy fields intentionally have no silent defaults.

create table if not exists public.apf_profile_rulesets (
  id uuid primary key default gen_random_uuid(),
  profile_version_id uuid not null unique references public.apf_profile_versions(id) on delete restrict,
  schema_version text not null,
  algorithm_version text not null,
  rounding_mode text,
  decimal_scale smallint,
  rounding_stage text,
  billing_policy text,
  elementary_process_policy jsonb not null default '{}'::jsonb,
  prompt_policy jsonb not null default '{}'::jsonb,
  extension_rules jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apf_profile_rulesets_schema_not_blank check (btrim(schema_version) <> ''),
  constraint apf_profile_rulesets_algorithm_not_blank check (btrim(algorithm_version) <> ''),
  constraint apf_profile_rulesets_rounding_mode_check check (rounding_mode is null or rounding_mode in ('half_up', 'half_even', 'down', 'up', 'truncate')),
  constraint apf_profile_rulesets_decimal_scale_check check (decimal_scale is null or decimal_scale between 0 and 8),
  constraint apf_profile_rulesets_rounding_stage_check check (rounding_stage is null or rounding_stage in ('item', 'subtotal', 'total', 'item_and_total')),
  constraint apf_profile_rulesets_financial_policy_complete check (
    (rounding_mode is null and decimal_scale is null and rounding_stage is null)
    or (rounding_mode is not null and decimal_scale is not null and rounding_stage is not null)
  )
);

create table if not exists public.apf_profile_function_types (
  id uuid primary key default gen_random_uuid(),
  profile_version_id uuid not null references public.apf_profile_versions(id) on delete restrict,
  code text not null,
  name text not null,
  function_class text not null,
  complexity_policy jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint apf_profile_function_types_code_format check (code = upper(code) and code ~ '^[A-Z0-9_]{1,16}$'),
  constraint apf_profile_function_types_name_not_blank check (btrim(name) <> ''),
  constraint apf_profile_function_types_class_check check (function_class in ('transactional', 'logical')),
  constraint apf_profile_function_types_version_code_key unique (profile_version_id, code),
  constraint apf_profile_function_types_version_id_id_key unique (profile_version_id, id)
);

create index if not exists apf_profile_function_types_version_idx
  on public.apf_profile_function_types(profile_version_id, sort_order);

create table if not exists public.apf_profile_function_weights (
  id uuid primary key default gen_random_uuid(),
  profile_version_id uuid not null references public.apf_profile_versions(id) on delete restrict,
  function_type_id uuid not null,
  complexity text not null,
  weight numeric(12,6) not null,
  det_min integer,
  det_max integer,
  ftr_ret_min integer,
  ftr_ret_max integer,
  created_at timestamptz not null default now(),
  constraint apf_profile_function_weights_type_fk foreign key (profile_version_id, function_type_id)
    references public.apf_profile_function_types(profile_version_id, id) on delete restrict,
  constraint apf_profile_function_weights_complexity_not_blank check (btrim(complexity) <> ''),
  constraint apf_profile_function_weights_weight_check check (weight >= 0),
  constraint apf_profile_function_weights_det_check check (det_min is null or det_min >= 0),
  constraint apf_profile_function_weights_det_range_check check (det_max is null or det_min is not null and det_max >= det_min),
  constraint apf_profile_function_weights_ftr_ret_check check (ftr_ret_min is null or ftr_ret_min >= 0),
  constraint apf_profile_function_weights_ftr_ret_range_check check (ftr_ret_max is null or ftr_ret_min is not null and ftr_ret_max >= ftr_ret_min),
  constraint apf_profile_function_weights_version_type_complexity_key unique (profile_version_id, function_type_id, complexity)
);

create index if not exists apf_profile_function_weights_version_idx
  on public.apf_profile_function_weights(profile_version_id, function_type_id);

create table if not exists public.apf_profile_factors (
  id uuid primary key default gen_random_uuid(),
  profile_version_id uuid not null references public.apf_profile_versions(id) on delete restrict,
  code text not null,
  name text not null,
  contribution_pct numeric(9,6) not null,
  action_on_baseline text,
  is_non_measurable boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  constraint apf_profile_factors_code_format check (code = upper(code) and code ~ '^[A-Z0-9_]{1,24}$'),
  constraint apf_profile_factors_name_not_blank check (btrim(name) <> ''),
  constraint apf_profile_factors_contribution_check check (contribution_pct between 0 and 100),
  constraint apf_profile_factors_version_code_key unique (profile_version_id, code),
  constraint apf_profile_factors_version_id_id_key unique (profile_version_id, id)
);

create index if not exists apf_profile_factors_version_idx
  on public.apf_profile_factors(profile_version_id, sort_order);

create table if not exists public.apf_profile_maintenance_rules (
  id uuid primary key default gen_random_uuid(),
  profile_version_id uuid not null references public.apf_profile_versions(id) on delete restrict,
  code text not null,
  name text not null,
  priority integer not null,
  factor_code text,
  match_policy jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint apf_profile_maintenance_rules_factor_fk foreign key (profile_version_id, factor_code)
    references public.apf_profile_factors(profile_version_id, code) on delete restrict,
  constraint apf_profile_maintenance_rules_code_format check (code = lower(code) and code ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  constraint apf_profile_maintenance_rules_name_not_blank check (btrim(name) <> ''),
  constraint apf_profile_maintenance_rules_priority_check check (priority >= 0),
  constraint apf_profile_maintenance_rules_policy_object check (jsonb_typeof(match_policy) = 'object'),
  constraint apf_profile_maintenance_rules_version_code_key unique (profile_version_id, code),
  constraint apf_profile_maintenance_rules_version_priority_key unique (profile_version_id, priority)
);

create index if not exists apf_profile_maintenance_rules_version_idx
  on public.apf_profile_maintenance_rules(profile_version_id, priority);

create table if not exists public.apf_profile_precedence_rules (
  id uuid primary key default gen_random_uuid(),
  profile_version_id uuid not null references public.apf_profile_versions(id) on delete restrict,
  source text not null,
  priority integer not null,
  scope_policy jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint apf_profile_precedence_rules_source_check check (source in ('snapshot_ruleset', 'official_history', 'human_override', 'baseline', 'ai_proposal', 'technical_default')),
  constraint apf_profile_precedence_rules_priority_check check (priority >= 0),
  constraint apf_profile_precedence_rules_scope_object check (jsonb_typeof(scope_policy) = 'object'),
  constraint apf_profile_precedence_rules_version_source_key unique (profile_version_id, source),
  constraint apf_profile_precedence_rules_version_priority_key unique (profile_version_id, priority)
);

create index if not exists apf_profile_precedence_rules_version_idx
  on public.apf_profile_precedence_rules(profile_version_id, priority);

comment on table public.apf_profile_rulesets is
  'Typed ruleset for one APF profile version. Null rounding policy means PRECISA DE DECISAO and blocks publication.';
comment on table public.apf_profile_function_weights is
  'Version-owned copy of effective weights. Existing apf_function_type_weights remains the Legacy v1 source.';
comment on table public.apf_profile_precedence_rules is
  'Explicit source precedence. AI proposal is evidence only and never financial authority.';

