-- Fase 1.3 + 2.1 + 2.3: Commercial audit trigger, assert_feature_access, cache invalidation triggers
-- Executar exclusivamente pelo Lovable
begin;

-- ============================================================
-- 1. COMMERCIAL AUDIT TRIGGER (Fase 1.3)
-- ============================================================

create or replace function public.log_commercial_audit()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_actor uuid := auth.uid();
  v_org_id uuid;
  v_entity_type text;
  v_entity_id uuid;
  v_action text;
  v_before jsonb;
  v_after jsonb;
begin
  -- Determine entity type and extract org_id
  case tg_table_name
    when 'organization_subscriptions' then
      v_entity_type := 'subscription';
      if tg_op = 'DELETE' then
        v_org_id := old.org_id;
        v_entity_id := old.id;
      else
        v_org_id := new.org_id;
        v_entity_id := new.id;
      end if;
    when 'organization_entitlement_overrides' then
      v_entity_type := 'entitlement_override';
      if tg_op = 'DELETE' then
        v_org_id := old.org_id;
        v_entity_id := old.id;
      else
        v_org_id := new.org_id;
        v_entity_id := new.id;
      end if;
    when 'saas_contracts' then
      v_entity_type := 'contract';
      if tg_op = 'DELETE' then
        v_org_id := old.org_id;
        v_entity_id := old.id;
      else
        v_org_id := new.org_id;
        v_entity_id := new.id;
      end if;
    when 'saas_trials' then
      v_entity_type := 'trial';
      if tg_op = 'DELETE' then
        v_org_id := old.organization_id;
        v_entity_id := old.id;
      else
        v_org_id := new.organization_id;
        v_entity_id := new.id;
      end if;
    else
      v_entity_type := tg_table_name;
      if tg_op = 'DELETE' then
        v_entity_id := old.id;
      else
        v_entity_id := new.id;
      end if;
  end case;

  -- Determine action
  v_action := case tg_op
    when 'INSERT' then 'insert'
    when 'UPDATE' then 'update'
    when 'DELETE' then 'delete'
  end;

  -- Capture before/after
  if tg_op = 'INSERT' then
    v_before := null;
    v_after := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
  else
    v_before := to_jsonb(old);
    v_after := null;
  end if;

  -- Only audit if meaningful change or new/old exists
  insert into public.commercial_audit_logs (org_id, entity_type, entity_id, action, before_data, after_data, actor_id, source)
  values (v_org_id, v_entity_type, v_entity_id, v_action, v_before, v_after, v_actor, tg_table_name);

  return coalesce(new, old);
end $$;

-- Attach triggers
drop trigger if exists trg_org_subscriptions_audit on public.organization_subscriptions;
create trigger trg_org_subscriptions_audit
  after insert or update or delete on public.organization_subscriptions
  for each row execute function public.log_commercial_audit();

drop trigger if exists trg_org_overrides_audit on public.organization_entitlement_overrides;
create trigger trg_org_overrides_audit
  after insert or update or delete on public.organization_entitlement_overrides
  for each row execute function public.log_commercial_audit();

drop trigger if exists trg_saas_contracts_audit on public.saas_contracts;
create trigger trg_saas_contracts_audit
  after insert or update or delete on public.saas_contracts
  for each row execute function public.log_commercial_audit();

drop trigger if exists trg_saas_trials_audit on public.saas_trials;
create trigger trg_saas_trials_audit
  after insert or update or delete on public.saas_trials
  for each row execute function public.log_commercial_audit();

-- ============================================================
-- 2. CACHE INVALIDATION TRIGGERS (Fase 2.3)
-- ============================================================

-- Invalidate cache when plan version features change
create or replace function public.invalidate_entitlement_cache_on_plan_feature_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_plan_id uuid;
  v_sub record;
begin
  -- Find which plans are affected
  if tg_op = 'DELETE' then
    select pv.plan_id into v_plan_id from public.saas_plan_versions pv where pv.id = old.plan_version_id;
  else
    select pv.plan_id into v_plan_id from public.saas_plan_versions pv where pv.id = new.plan_version_id;
  end if;

  -- Invalidate cache for all orgs subscribed to this plan
  for v_sub in
    select org_id from public.organization_subscriptions where plan_id = v_plan_id
  loop
    update public.organization_entitlement_cache
    set computed_at = '2000-01-01T00:00:00Z'
    where org_id = v_sub.org_id;
  end loop;

  return coalesce(new, old);
end $$;

drop trigger if exists trg_plan_version_features_cache_inval on public.saas_plan_version_features;
create trigger trg_plan_version_features_cache_inval
  after insert or update or delete on public.saas_plan_version_features
  for each row execute function public.invalidate_entitlement_cache_on_plan_feature_change();

-- Invalidate cache when trial status changes
create or replace function public.invalidate_entitlement_cache_on_trial_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_org_id uuid;
begin
  if tg_op = 'DELETE' then
    v_org_id := old.organization_id;
  else
    v_org_id := new.organization_id;
  end if;

  update public.organization_entitlement_cache
  set computed_at = '2000-01-01T00:00:00Z'
  where org_id = v_org_id;

  return coalesce(new, old);
end $$;

drop trigger if exists trg_trials_cache_inval on public.saas_trials;
create trigger trg_trials_cache_inval
  after insert or update or delete on public.saas_trials
  for each row execute function public.invalidate_entitlement_cache_on_trial_change();

-- Invalidate cache when contract changes (affects entitlements indirectly)
create or replace function public.invalidate_entitlement_cache_on_contract_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_org_id uuid;
begin
  if tg_op = 'DELETE' then
    v_org_id := old.org_id;
  else
    v_org_id := new.org_id;
  end if;

  if v_org_id is not null then
    update public.organization_entitlement_cache
    set computed_at = '2000-01-01T00:00:00Z'
    where org_id = v_org_id;
  end if;

  return coalesce(new, old);
end $$;

drop trigger if exists trg_contracts_cache_inval on public.saas_contracts;
create trigger trg_contracts_cache_inval
  after insert or update or delete on public.saas_contracts
  for each row execute function public.invalidate_entitlement_cache_on_contract_change();

-- ============================================================
-- 3. ASSERT_FEATURE_ACCESS (Fase 2.1)
-- ============================================================

create or replace function public.assert_feature_access(
  p_org_id uuid,
  p_feature_code text,
  p_increment numeric default 0
) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_ent record;
  v_used numeric := 0;
  v_decision text := 'allowed';
  v_reason text := 'within_limit';
begin
  -- Resolve effective entitlements
  select * into v_ent
  from public.get_effective_organization_entitlements(p_org_id) e
  where e.feature_key = p_feature_code;

  -- Check subscription status
  if v_ent.feature_key is null or not v_ent.enabled or v_ent.subscription_status not in ('active', 'trialing') then
    v_decision := 'denied';
    v_reason := 'entitlement_denied';
  else
    -- Check usage limits (if limit-based feature)
    if v_ent.limit_value is not null and p_increment > 0 then
      select coalesce(r.used_value, 0) into v_used
      from public.organization_usage_records r
      where r.organization_id = p_org_id
        and r.usage_code = p_feature_code
        and r.period_start <= now()
        and r.period_end > now()
      order by r.calculated_at desc
      limit 1;

      if v_used + p_increment > v_ent.limit_value then
        v_decision := 'denied';
        v_reason := 'limit_exceeded';
      elsif v_ent.limit_value > 0 and (v_used + p_increment) / v_ent.limit_value >= 0.8 then
        v_decision := 'warning';
        v_reason := 'limit_near';
      end if;
    end if;
  end if;

  -- Record enforcement event
  insert into public.commercial_enforcement_events (organization_id, feature_code, decision, used_value, limit_value, reason, actor_id)
  values (p_org_id, p_feature_code, v_decision, v_used, v_ent.limit_value, v_reason, auth.uid());

  -- Raise exception if denied
  if v_decision = 'denied' then
    raise exception using
      errcode = 'P0001',
      message = 'feature_access_denied',
      detail = format('Feature: %s, Reason: %s', p_feature_code, v_reason);
  end if;
end $$;

comment on function public.assert_feature_access(uuid, text, numeric) is
  'Central enforcement: checks entitlement + subscription status + usage limits. Raises exception if denied.';

-- ============================================================
-- DONE
-- ============================================================

commit;
