-- One-off production rollback: disable tenancy enforcement immediately.
-- Run manually in Lovable Cloud SQL Editor if Operation 9 causes any critical issue.
-- This operation intentionally calls public.set_tenancy_enforcement(false).
-- It does not remove org_id data, policies, triggers, wrappers, or RPCs.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('axionn:20260703:09_disable_tenancy_enforcement_rollback'));

DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(object_name, ', ' ORDER BY object_name)
    INTO v_missing
  FROM (
    VALUES
      ('table public.saas_runtime_settings', to_regclass('public.saas_runtime_settings') IS NOT NULL),
      ('function public.is_tenancy_enforced()', to_regprocedure('public.is_tenancy_enforced()') IS NOT NULL),
      ('function public.set_tenancy_enforcement(boolean)', to_regprocedure('public.set_tenancy_enforcement(boolean)') IS NOT NULL)
  ) AS required(object_name, present)
  WHERE NOT present;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required rollback dependencies: %', v_missing;
  END IF;

  IF NOT has_function_privilege('service_role', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Rollback blocked: service_role cannot toggle enforcement.';
  END IF;

  IF has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Rollback blocked: client role can toggle enforcement.';
  END IF;
END;
$$;

SELECT public.set_tenancy_enforcement(false);

DO $$
DECLARE
  v_enabled boolean;
  v_setting_enabled boolean;
BEGIN
  SELECT public.is_tenancy_enforced() INTO v_enabled;

  SELECT coalesce(
    (
      SELECT lower(value ->> 'enabled') = 'true'
      FROM public.saas_runtime_settings
      WHERE key = 'tenancy_enforcement'
    ),
    false
  ) INTO v_setting_enabled;

  IF v_enabled IS DISTINCT FROM false OR v_setting_enabled IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Post-rollback validation failed: enforcement flag is still enabled.';
  END IF;
END;
$$;

COMMIT;

SELECT
  public.is_tenancy_enforced() AS tenancy_enforcement_enabled,
  coalesce(
    (
      SELECT lower(value ->> 'enabled') = 'true'
      FROM public.saas_runtime_settings
      WHERE key = 'tenancy_enforcement'
    ),
    false
  ) AS tenancy_setting_enabled,
  true AS tenancy_enforcement_rollback_ok;
