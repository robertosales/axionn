-- APF Etapa 3 / M1: additive profile and TR versioning foundation.
-- This migration does not migrate data or change the current APF runtime.

create table if not exists public.apf_profiles (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete restrict,
  base_model_id uuid references public.apf_counting_models(id) on delete set null,
  profile_code text not null,
  name text not null,
  description text,
  purpose text,
  status text not null default 'active',
  is_default boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retired_at timestamptz,
  retired_by uuid references auth.users(id) on delete restrict,
  constraint apf_profiles_code_format check (profile_code = lower(profile_code) and profile_code ~ '^[a-z0-9][a-z0-9_-]{1,62}$'),
  constraint apf_profiles_name_not_blank check (btrim(name) <> ''),
  constraint apf_profiles_status_check check (status in ('active', 'retired')),
  constraint apf_profiles_retirement_check check (
    (status = 'active' and retired_at is null and retired_by is null)
    or (status = 'retired' and retired_at is not null and retired_by is not null)
  ),
  constraint apf_profiles_contract_code_key unique (contract_id, profile_code),
  constraint apf_profiles_contract_id_id_key unique (contract_id, id)
);

create unique index if not exists apf_profiles_one_active_default_idx
  on public.apf_profiles(contract_id)
  where is_default and status = 'active';
create index if not exists apf_profiles_contract_status_idx
  on public.apf_profiles(contract_id, status);
create index if not exists apf_profiles_base_model_idx
  on public.apf_profiles(base_model_id) where base_model_id is not null;

comment on table public.apf_profiles is
  'Logical APF configuration identity scoped to one contract. Financial proof lives in published versions and future execution snapshots.';
comment on column public.apf_profiles.base_model_id is
  'Optional legacy model used only as a source for controlled capture/migration; it is not execution proof for versioned counting.';

create table if not exists public.apf_profile_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.apf_profiles(id) on delete restrict,
  version_no integer not null,
  status text not null default 'draft',
  revision bigint not null default 1,
  effective_from timestamptz,
  effective_until timestamptz,
  tr_reference text,
  tr_document_uri text,
  change_summary text,
  configuration_hash text,
  canonicalization_version text,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  published_by uuid references auth.users(id) on delete restrict,
  published_at timestamptz,
  retired_by uuid references auth.users(id) on delete restrict,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint apf_profile_versions_number_check check (version_no > 0),
  constraint apf_profile_versions_revision_check check (revision > 0),
  constraint apf_profile_versions_status_check check (status in ('draft', 'in_review', 'approved', 'published', 'retired')),
  constraint apf_profile_versions_effective_range_check check (effective_until is null or effective_from is null or effective_until > effective_from),
  constraint apf_profile_versions_hash_check check (configuration_hash is null or configuration_hash ~ '^[0-9a-f]{64}$'),
  constraint apf_profile_versions_profile_number_key unique (profile_id, version_no),
  constraint apf_profile_versions_profile_id_id_key unique (profile_id, id)
);

create index if not exists apf_profile_versions_profile_status_idx
  on public.apf_profile_versions(profile_id, status);
create index if not exists apf_profile_versions_effective_idx
  on public.apf_profile_versions(profile_id, effective_from, effective_until)
  where status = 'published';
create index if not exists apf_profile_versions_hash_idx
  on public.apf_profile_versions(configuration_hash)
  where configuration_hash is not null;

comment on table public.apf_profile_versions is
  'Governed, temporal and append-only-after-publication APF/TR configuration version.';
comment on column public.apf_profile_versions.configuration_hash is
  'SHA-256 of the canonical semantic version document. Populated only by the controlled publication flow.';
