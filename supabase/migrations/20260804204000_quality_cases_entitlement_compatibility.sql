-- Keep the effective entitlement resolver and the versioned commercial catalog
-- aligned. The current resolver reads saas_plan_entitlements, while Quality was
-- originally seeded only into saas_plan_version_features.

insert into public.saas_plan_entitlements (
  plan_id,
  feature_key,
  enabled,
  limit_value,
  metadata
)
select
  plan.id,
  'quality.cases.view',
  true,
  null,
  jsonb_build_object(
    'source', 'quality_catalog_compatibility',
    'migrated_at', now()
  )
from public.saas_plans plan
where plan.code in ('core', 'intelligence', 'enterprise')
  and plan.status = 'active'
on conflict (plan_id, feature_key) do update
set enabled = excluded.enabled,
    limit_value = excluded.limit_value,
    metadata = public.saas_plan_entitlements.metadata || excluded.metadata,
    updated_at = now();

-- Prevent a previously cached negative result from continuing to hide Quality.
delete from public.organization_entitlement_cache;
