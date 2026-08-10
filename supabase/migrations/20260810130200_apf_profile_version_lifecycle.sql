-- APF Etapa 3 / M3: canonical hashing, lifecycle invariants and immutability.

create or replace function public.apf_canonical_jsonb(p_value jsonb)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_type text := jsonb_typeof(p_value);
  v_result text;
begin
  case v_type
    when 'null' then return 'null';
    when 'boolean' then return p_value::text;
    when 'number' then return p_value::text;
    when 'string' then return to_jsonb(normalize(p_value #>> '{}', NFC))::text;
    when 'array' then
      select '[' || coalesce(string_agg(public.apf_canonical_jsonb(item.value), ',' order by item.ordinality), '') || ']'
      into v_result
      from jsonb_array_elements(p_value) with ordinality as item(value, ordinality);
      return v_result;
    when 'object' then
      select '{' || coalesce(string_agg(to_jsonb(normalize(entry.key, NFC))::text || ':' || public.apf_canonical_jsonb(entry.value), ',' order by normalize(entry.key, NFC) collate "C"), '') || '}'
      into v_result
      from jsonb_each(p_value) as entry(key, value)
      where entry.key <> all (array['created_at','updated_at','created_by','random_id','request_id']);
      return v_result;
    else
      raise exception using errcode = '22023', message = 'apf_canonical_jsonb_invalid_value';
  end case;
end;
$$;

comment on function public.apf_canonical_jsonb(jsonb) is
  'APF canonical JSON v1. Object keys are C-sorted, arrays preserve semantic order, and financial decimals must be supplied as normalized strings.';

create or replace function public.apf_profile_version_document(p_version_id uuid)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'canonicalizationVersion', 'apf-c14n-v1',
    'profile', jsonb_build_object(
      'code', profile.profile_code,
      'purpose', profile.purpose
    ),
    'version', jsonb_build_object(
      'number', version.version_no,
      'effectiveFrom', version.effective_from,
      'effectiveUntil', version.effective_until,
      'trReference', version.tr_reference
    ),
    'ruleset', jsonb_build_object(
      'schemaVersion', ruleset.schema_version,
      'algorithmVersion', ruleset.algorithm_version,
      'roundingMode', ruleset.rounding_mode,
      'decimalScale', ruleset.decimal_scale,
      'roundingStage', ruleset.rounding_stage,
      'billingPolicy', ruleset.billing_policy,
      'elementaryProcessPolicy', ruleset.elementary_process_policy,
      'promptPolicy', ruleset.prompt_policy,
      'extensionRules', ruleset.extension_rules
    ),
    'functionTypes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', type.code,
        'name', type.name,
        'class', type.function_class,
        'complexityPolicy', type.complexity_policy,
        'active', type.is_active,
        'sortOrder', type.sort_order
      ) order by type.sort_order, type.code collate "C")
      from public.apf_profile_function_types type
      where type.profile_version_id = version.id
    ), '[]'::jsonb),
    'weights', coalesce((
      select jsonb_agg(jsonb_build_object(
        'functionType', type.code,
        'complexity', weight.complexity,
        'weight', weight.weight::text,
        'detMin', weight.det_min,
        'detMax', weight.det_max,
        'ftrRetMin', weight.ftr_ret_min,
        'ftrRetMax', weight.ftr_ret_max
      ) order by type.code collate "C", weight.complexity collate "C")
      from public.apf_profile_function_weights weight
      join public.apf_profile_function_types type on type.id = weight.function_type_id
      where weight.profile_version_id = version.id
    ), '[]'::jsonb),
    'factors', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', factor.code,
        'name', factor.name,
        'contributionPct', factor.contribution_pct::text,
        'actionOnBaseline', factor.action_on_baseline,
        'nonMeasurable', factor.is_non_measurable,
        'active', factor.is_active,
        'sortOrder', factor.sort_order
      ) order by factor.sort_order, factor.code collate "C")
      from public.apf_profile_factors factor
      where factor.profile_version_id = version.id
    ), '[]'::jsonb),
    'maintenanceRules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', rule.code,
        'name', rule.name,
        'priority', rule.priority,
        'factorCode', rule.factor_code,
        'matchPolicy', rule.match_policy,
        'active', rule.is_active
      ) order by rule.priority, rule.code collate "C")
      from public.apf_profile_maintenance_rules rule
      where rule.profile_version_id = version.id
    ), '[]'::jsonb),
    'precedenceRules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'source', rule.source,
        'priority', rule.priority,
        'scopePolicy', rule.scope_policy,
        'active', rule.is_active
      ) order by rule.priority, rule.source collate "C")
      from public.apf_profile_precedence_rules rule
      where rule.profile_version_id = version.id
    ), '[]'::jsonb)
  )
  from public.apf_profile_versions version
  join public.apf_profiles profile on profile.id = version.profile_id
  join public.apf_profile_rulesets ruleset on ruleset.profile_version_id = version.id
  where version.id = p_version_id;
$$;

create or replace function public.apf_calculate_profile_version_hash(p_version_id uuid)
returns text
language plpgsql
stable
set search_path = public, pg_temp
as $$
declare
  v_document jsonb;
begin
  v_document := public.apf_profile_version_document(p_version_id);
  if v_document is null then
    raise exception using errcode = '22023', message = 'apf_profile_version_document_incomplete';
  end if;
  return encode(public.digest(public.apf_canonical_jsonb(v_document), 'sha256'), 'hex');
end;
$$;

create or replace function public.apf_touch_versioned_configuration()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  if tg_table_name = 'apf_profile_versions' then
    new.revision := old.revision + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists apf_profiles_touch on public.apf_profiles;
create trigger apf_profiles_touch before update on public.apf_profiles
for each row execute function public.apf_touch_versioned_configuration();
drop trigger if exists apf_profile_versions_touch on public.apf_profile_versions;
create trigger apf_profile_versions_touch before update on public.apf_profile_versions
for each row execute function public.apf_touch_versioned_configuration();
drop trigger if exists apf_profile_rulesets_touch on public.apf_profile_rulesets;
create trigger apf_profile_rulesets_touch before update on public.apf_profile_rulesets
for each row execute function public.apf_touch_versioned_configuration();

create or replace function public.apf_enforce_profile_version_immutability()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and old.status in ('published', 'retired') then
    raise exception using errcode = '55000', message = 'apf_published_version_delete_forbidden';
  end if;
  if tg_op = 'UPDATE' and old.status = 'retired' then
    raise exception using errcode = '55000', message = 'apf_retired_version_update_forbidden';
  end if;
  if tg_op = 'UPDATE' and old.status = 'published' then
    if new.status <> 'retired'
       or (to_jsonb(new) - array['status','retired_at','retired_by','updated_at','updated_by','revision'])
          is distinct from
          (to_jsonb(old) - array['status','retired_at','retired_by','updated_at','updated_by','revision']) then
      raise exception using errcode = '55000', message = 'apf_published_version_update_forbidden';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists apf_profile_versions_immutable on public.apf_profile_versions;
create trigger apf_profile_versions_immutable
before update or delete on public.apf_profile_versions
for each row execute function public.apf_enforce_profile_version_immutability();

create or replace function public.apf_enforce_version_child_immutability()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_old_version_id uuid;
  v_new_version_id uuid;
begin
  if tg_op <> 'INSERT' then v_old_version_id := old.profile_version_id; end if;
  if tg_op <> 'DELETE' then v_new_version_id := new.profile_version_id; end if;
  if exists (
    select 1 from public.apf_profile_versions version
    where version.id in (v_old_version_id, v_new_version_id)
      and version.status in ('published', 'retired')
  ) then
    raise exception using errcode = '55000', message = 'apf_published_version_configuration_immutable';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'apf_profile_rulesets', 'apf_profile_function_types', 'apf_profile_function_weights',
    'apf_profile_factors', 'apf_profile_maintenance_rules', 'apf_profile_precedence_rules'
  ] loop
    execute format('drop trigger if exists apf_version_child_immutable on public.%I', v_table);
    execute format(
      'create trigger apf_version_child_immutable before insert or update or delete on public.%I for each row execute function public.apf_enforce_version_child_immutability()',
      v_table
    );
  end loop;
end $$;

create or replace function public.apf_validate_profile_version_publication()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_ruleset public.apf_profile_rulesets%rowtype;
begin
  if new.status <> 'published' or old.status = 'published' then return new; end if;
  if old.status <> 'approved' then
    raise exception using errcode = '22023', message = 'apf_profile_version_must_be_approved';
  end if;
  if new.effective_from is null then
    raise exception using errcode = '22023', message = 'apf_measurement_effective_from_required';
  end if;
  select * into v_ruleset from public.apf_profile_rulesets where profile_version_id = new.id;
  if not found or v_ruleset.rounding_mode is null or v_ruleset.decimal_scale is null or v_ruleset.rounding_stage is null then
    raise exception using errcode = '22023', message = 'apf_profile_version_financial_policy_incomplete';
  end if;
  if not exists (select 1 from public.apf_profile_function_types where profile_version_id = new.id and is_active)
     or not exists (select 1 from public.apf_profile_function_weights where profile_version_id = new.id)
     or not exists (select 1 from public.apf_profile_factors where profile_version_id = new.id and is_active) then
    raise exception using errcode = '22023', message = 'apf_profile_version_catalog_incomplete';
  end if;
  new.canonicalization_version := 'apf-c14n-v1';
  new.configuration_hash := public.apf_calculate_profile_version_hash(new.id);
  return new;
end;
$$;

drop trigger if exists apf_profile_versions_validate_publication on public.apf_profile_versions;
create trigger apf_profile_versions_validate_publication
before update of status on public.apf_profile_versions
for each row execute function public.apf_validate_profile_version_publication();

create or replace function public.apf_prevent_published_effective_overlap()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status <> 'published' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.profile_id::text, 0));
  if exists (
    select 1 from public.apf_profile_versions existing
    where existing.profile_id = new.profile_id
      and existing.id <> new.id
      and existing.status = 'published'
      and tstzrange(existing.effective_from, existing.effective_until, '[)')
          && tstzrange(new.effective_from, new.effective_until, '[)')
  ) then
    raise exception using errcode = '23P01', message = 'apf_profile_version_effective_overlap';
  end if;
  return new;
end;
$$;

drop trigger if exists apf_profile_versions_no_overlap on public.apf_profile_versions;
create trigger apf_profile_versions_no_overlap
before insert or update of status, effective_from, effective_until on public.apf_profile_versions
for each row execute function public.apf_prevent_published_effective_overlap();

revoke all on function public.apf_profile_version_document(uuid) from public, anon, authenticated;
revoke all on function public.apf_calculate_profile_version_hash(uuid) from public, anon, authenticated;
revoke all on function public.apf_touch_versioned_configuration() from public, anon, authenticated;
revoke all on function public.apf_enforce_profile_version_immutability() from public, anon, authenticated;
revoke all on function public.apf_enforce_version_child_immutability() from public, anon, authenticated;
revoke all on function public.apf_validate_profile_version_publication() from public, anon, authenticated;
revoke all on function public.apf_prevent_published_effective_overlap() from public, anon, authenticated;
grant execute on function public.apf_profile_version_document(uuid) to service_role;
grant execute on function public.apf_calculate_profile_version_hash(uuid) to service_role;
