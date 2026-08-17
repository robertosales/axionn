-- APF evidence dossiers - Phase 1 persistence foundation.
-- The dossier owns the tenant boundary and freezes every mutable contractual
-- reference needed to reproduce a homologated document.

create table public.apf_evidence_dossiers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  sprint_id uuid references public.sprints(id) on delete set null,
  user_story_id uuid references public.user_stories(id) on delete restrict,
  counting_session_id uuid references public.apf_counting_sessions(id) on delete restrict,
  baseline_id uuid references public.apf_project_baselines(id) on delete restrict,
  counting_model_id uuid references public.apf_counting_models(id) on delete restrict,
  previous_dossier_id uuid references public.apf_evidence_dossiers(id) on delete restrict,
  dossier_code text not null,
  title text not null,
  counting_type text not null check (counting_type in ('project', 'impact', 'corrective', 'recount')),
  status text not null default 'draft' check (status in (
    'draft', 'collecting_evidence', 'under_review', 'validated',
    'homologated', 'superseded', 'cancelled'
  )),
  contract_snapshot jsonb not null default '{}'::jsonb,
  baseline_snapshot jsonb not null default '{}'::jsonb,
  ruleset_snapshot jsonb not null default '{}'::jsonb,
  total_impacted_pf numeric(12,4) not null default 0,
  total_homologated_pf numeric(12,4),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  validated_by uuid references auth.users(id) on delete restrict,
  validated_at timestamptz,
  homologated_by uuid references auth.users(id) on delete restrict,
  homologated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, dossier_code)
);

create table public.apf_acceptance_criteria (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.apf_evidence_dossiers(id) on delete cascade,
  stable_id text not null,
  sort_order integer not null default 0,
  original_text text not null,
  source_type text not null default 'manual' check (source_type in ('user_story', 'gitlab_issue', 'file', 'manual')),
  source_ref text,
  expected_behavior text,
  decision text check (decision is null or decision in ('meets', 'partially_meets', 'does_not_meet', 'not_applicable')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dossier_id, stable_id)
);

create table public.apf_evidence_sources (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.apf_evidence_dossiers(id) on delete cascade,
  source_type text not null check (source_type in ('merge_request', 'commit', 'file', 'endpoint', 'database', 'test', 'attachment', 'link')),
  category text not null check (category in ('api', 'code', 'interface', 'database', 'integration', 'test', 'document')),
  repository text,
  commit_sha text,
  merge_request_ref text,
  file_path text,
  symbol_ref text,
  permanent_url text,
  summary text not null,
  content_hash text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified', 'failed', 'stale')),
  collected_at timestamptz not null default now(),
  collected_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.apf_evidence_catalog_entries (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.apf_evidence_dossiers(id) on delete cascade,
  evidence_source_id uuid not null references public.apf_evidence_sources(id) on delete restrict,
  stable_id text not null,
  display_title text not null,
  display_summary text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (dossier_id, stable_id),
  unique (dossier_id, evidence_source_id)
);

create table public.apf_traceability_links (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.apf_evidence_dossiers(id) on delete cascade,
  acceptance_criterion_id uuid not null references public.apf_acceptance_criteria(id) on delete cascade,
  evidence_source_id uuid not null references public.apf_evidence_sources(id) on delete cascade,
  counting_item_id uuid references public.apf_counting_items(id) on delete set null,
  functional_result text not null default 'pending' check (functional_result in ('pending', 'meets', 'partially_meets', 'does_not_meet', 'not_applicable')),
  apf_treatment text,
  justification text,
  suggested_by_ai boolean not null default false,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (acceptance_criterion_id, evidence_source_id, counting_item_id)
);

create table public.apf_audit_scenarios (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.apf_evidence_dossiers(id) on delete cascade,
  title text not null,
  description text not null,
  alternative_classification text,
  rationale text not null,
  pf_delta numeric(12,4) not null default 0,
  financial_effect numeric(14,2),
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected', 'mitigated')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.apf_dossier_versions (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.apf_evidence_dossiers(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null,
  rendered_markdown text not null,
  content_hash text not null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (dossier_id, version_number),
  unique (dossier_id, content_hash)
);

create table public.apf_dossier_events (
  id bigint generated always as identity primary key,
  dossier_id uuid not null references public.apf_evidence_dossiers(id) on delete restrict,
  event_type text not null check (event_type in ('created', 'evidence_collected', 'reviewed', 'changed', 'validated', 'homologated', 'exported', 'superseded', 'cancelled')),
  actor_id uuid references auth.users(id) on delete set null default auth.uid(),
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index apf_dossiers_org_status_idx on public.apf_evidence_dossiers (organization_id, status, updated_at desc);
create index apf_dossiers_hu_idx on public.apf_evidence_dossiers (user_story_id);
create index apf_criteria_dossier_idx on public.apf_acceptance_criteria (dossier_id, sort_order);
create index apf_evidence_dossier_idx on public.apf_evidence_sources (dossier_id, category, verification_status);
create index apf_traceability_dossier_idx on public.apf_traceability_links (dossier_id, acceptance_criterion_id);
create index apf_events_dossier_idx on public.apf_dossier_events (dossier_id, created_at desc);

create or replace function public.apf_can_access_dossier(p_dossier_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.apf_evidence_dossiers dossier
    where dossier.id = p_dossier_id
      and public.is_organization_member(dossier.organization_id, auth.uid())
  );
$$;

revoke all on function public.apf_can_access_dossier(uuid) from public, anon;
grant execute on function public.apf_can_access_dossier(uuid) to authenticated, service_role;

create or replace function public.apf_touch_dossier_record()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.apf_reject_immutable_version_change()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'apf_dossier_version_is_immutable' using errcode = '55000';
end;
$$;

create trigger apf_dossiers_touch before update on public.apf_evidence_dossiers
for each row execute function public.apf_touch_dossier_record();
create trigger apf_criteria_touch before update on public.apf_acceptance_criteria
for each row execute function public.apf_touch_dossier_record();
create trigger apf_traceability_touch before update on public.apf_traceability_links
for each row execute function public.apf_touch_dossier_record();
create trigger apf_audit_scenarios_touch before update on public.apf_audit_scenarios
for each row execute function public.apf_touch_dossier_record();
create trigger apf_versions_immutable before update or delete on public.apf_dossier_versions
for each row execute function public.apf_reject_immutable_version_change();
create trigger apf_events_immutable before update or delete on public.apf_dossier_events
for each row execute function public.apf_reject_immutable_version_change();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'apf_evidence_dossiers', 'apf_acceptance_criteria', 'apf_evidence_sources',
    'apf_evidence_catalog_entries', 'apf_traceability_links', 'apf_audit_scenarios',
    'apf_dossier_versions', 'apf_dossier_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public, anon', table_name);
    execute format('grant select, insert, update on public.%I to authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
  end loop;
end $$;

grant usage, select on sequence public.apf_dossier_events_id_seq to authenticated, service_role;

create policy apf_dossiers_select on public.apf_evidence_dossiers for select to authenticated
using (public.is_organization_member(organization_id, auth.uid()));
create policy apf_dossiers_insert on public.apf_evidence_dossiers for insert to authenticated
with check (public.is_organization_member(organization_id, auth.uid()) and created_by = auth.uid());
create policy apf_dossiers_update on public.apf_evidence_dossiers for update to authenticated
using (public.is_organization_member(organization_id, auth.uid()) and status <> 'homologated')
with check (public.is_organization_member(organization_id, auth.uid()));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'apf_acceptance_criteria', 'apf_evidence_sources', 'apf_evidence_catalog_entries',
    'apf_traceability_links', 'apf_audit_scenarios', 'apf_dossier_versions', 'apf_dossier_events'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.apf_can_access_dossier(dossier_id)) with check (public.apf_can_access_dossier(dossier_id))',
      table_name || '_tenant_access', table_name
    );
  end loop;
end $$;

comment on table public.apf_evidence_dossiers is 'Auditable APF evidence dossier with frozen contractual references.';
comment on table public.apf_dossier_versions is 'Immutable, deterministic dossier snapshots used for re-export.';
