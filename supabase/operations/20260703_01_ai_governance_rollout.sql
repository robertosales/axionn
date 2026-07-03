-- Axion SaaS remote rollout — Operation 1
-- Installs AI usage governance and rate limits without changing tenancy enforcement.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('axionn:saas-rollout:01-ai-governance'));

DO $$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_agg(required.object_name ORDER BY required.object_name)
  INTO v_missing
  FROM (
    VALUES
      ('public.companies'),
      ('public.organizations'),
      ('public.teams'),
      ('public.ai_providers'),
      ('public.licenses'),
      ('public.contracts'),
      ('public.contract_teams'),
      ('public.contract_room_teams'),
      ('public.projects'),
      ('public.user_roles'),
      ('public.user_contracts'),
      ('public.contract_members'),
      ('public.organization_members')
  ) AS required(object_name)
  WHERE to_regclass(required.object_name) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Dependências ausentes para governança de IA: %', array_to_string(v_missing, ', ');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      VALUES
        ('ai_calls_used'),
        ('pf_used_month'),
        ('quota_reset_at'),
        ('ai_calls_quota'),
        ('valid_until'),
        ('status'),
        ('plan')
    ) required(column_name)
    WHERE NOT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = 'licenses'
        AND c.column_name = required.column_name
    )
  ) THEN
    RAISE EXCEPTION 'A tabela public.licenses não possui todas as colunas necessárias para governança de IA';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  user_id uuid,
  provider_id uuid REFERENCES public.ai_providers(id) ON DELETE SET NULL,
  feature text NOT NULL,
  status text NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'success', 'failed')),
  units integer NOT NULL DEFAULT 1 CHECK (units > 0),
  error_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_company_created
  ON public.ai_usage_events(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_org_created
  ON public.ai_usage_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_team_created
  ON public.ai_usage_events(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_user_created
  ON public.ai_usage_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_status_created
  ON public.ai_usage_events(status, created_at DESC);

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_usage_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ai_usage_events TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_ai_usage(
  p_team_id uuid,
  p_user_id uuid,
  p_feature text,
  p_request_id uuid DEFAULT gen_random_uuid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_team_company_id uuid;
  v_team_contract_id uuid;
  v_contract_id uuid;
  v_company_id uuid;
  v_org_id uuid;
  v_license public.licenses%ROWTYPE;
  v_is_member boolean := false;
  v_remaining integer;
BEGIN
  IF p_team_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AI_TEAM_REQUIRED';
  END IF;

  IF nullif(trim(p_feature), '') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AI_FEATURE_REQUIRED';
  END IF;

  SELECT t.company_id, t.contract_id
  INTO v_team_company_id, v_team_contract_id
  FROM public.teams t
  WHERE t.id = p_team_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AI_TEAM_NOT_FOUND';
  END IF;

  v_contract_id := v_team_contract_id;

  IF v_contract_id IS NULL THEN
    SELECT ct.contract_id
    INTO v_contract_id
    FROM public.contract_teams ct
    WHERE ct.team_id = p_team_id
    ORDER BY ct.created_at DESC
    LIMIT 1;
  END IF;

  IF v_contract_id IS NULL THEN
    SELECT crt.contract_id
    INTO v_contract_id
    FROM public.contract_room_teams crt
    WHERE crt.team_id = p_team_id
      AND crt.is_active = true
    ORDER BY crt.created_at DESC
    LIMIT 1;
  END IF;

  IF v_contract_id IS NULL THEN
    SELECT p.contract_id
    INTO v_contract_id
    FROM public.projects p
    WHERE p.team_id = p_team_id
      AND p.contract_id IS NOT NULL
    ORDER BY p.created_at DESC
    LIMIT 1;
  END IF;

  IF v_contract_id IS NOT NULL THEN
    SELECT c.company_id, c.org_id
    INTO v_company_id, v_org_id
    FROM public.contracts c
    WHERE c.id = v_contract_id;
  END IF;

  v_company_id := coalesce(v_team_company_id, v_company_id);

  IF p_user_id IS NOT NULL THEN
    SELECT (
      EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.team_id = p_team_id AND tm.user_id = p_user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = p_user_id AND ur.role = 'admin'
      )
      OR (
        v_contract_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.user_contracts uc
          WHERE uc.contract_id = v_contract_id AND uc.user_id = p_user_id
        )
      )
      OR (
        v_contract_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.contract_members cm
          WHERE cm.contract_id = v_contract_id AND cm.user_id = p_user_id
        )
      )
      OR (
        v_org_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.org_id = v_org_id AND om.user_id = p_user_id
        )
      )
    ) INTO v_is_member;

    IF NOT v_is_member THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AI_TEAM_ACCESS_DENIED';
    END IF;
  END IF;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AI_COMPANY_REQUIRED';
  END IF;

  SELECT l.*
  INTO v_license
  FROM public.licenses l
  WHERE l.company_id = v_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AI_LICENSE_REQUIRED';
  END IF;

  IF lower(coalesce(v_license.status, '')) NOT IN ('active', 'trial') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AI_LICENSE_INACTIVE';
  END IF;

  IF v_license.valid_until < current_date THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AI_LICENSE_EXPIRED';
  END IF;

  IF v_license.quota_reset_at <= now() THEN
    UPDATE public.licenses
    SET ai_calls_used = 0,
        pf_used_month = 0,
        quota_reset_at = date_trunc('month', now()) + interval '1 month',
        updated_at = now()
    WHERE id = v_license.id
    RETURNING * INTO v_license;
  END IF;

  IF v_license.ai_calls_quota IS NOT NULL
     AND v_license.ai_calls_used >= v_license.ai_calls_quota THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AI_QUOTA_EXCEEDED';
  END IF;

  UPDATE public.licenses
  SET ai_calls_used = ai_calls_used + 1,
      updated_at = now()
  WHERE id = v_license.id
  RETURNING * INTO v_license;

  INSERT INTO public.ai_usage_events (
    request_id, company_id, org_id, team_id, user_id, feature, status, units
  ) VALUES (
    p_request_id, v_company_id, v_org_id, p_team_id, p_user_id, trim(p_feature), 'reserved', 1
  );

  v_remaining := CASE
    WHEN v_license.ai_calls_quota IS NULL THEN NULL
    ELSE greatest(v_license.ai_calls_quota - v_license.ai_calls_used, 0)
  END;

  RETURN jsonb_build_object(
    'request_id', p_request_id,
    'company_id', v_company_id,
    'org_id', v_org_id,
    'team_id', p_team_id,
    'license_id', v_license.id,
    'plan', v_license.plan,
    'quota', v_license.ai_calls_quota,
    'used', v_license.ai_calls_used,
    'remaining', v_remaining,
    'mode', 'enforced'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_ai_usage(
  p_request_id uuid,
  p_status text,
  p_provider_id uuid DEFAULT NULL,
  p_error_code text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_status NOT IN ('success', 'failed') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AI_USAGE_STATUS_INVALID';
  END IF;

  UPDATE public.ai_usage_events
  SET status = p_status,
      provider_id = p_provider_id,
      error_code = nullif(trim(p_error_code), ''),
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
      completed_at = now()
  WHERE request_id = p_request_id
    AND status = 'reserved';
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_usage(uuid, uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_ai_usage(uuid, text, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_usage(uuid, uuid, text, uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_ai_usage(uuid, text, uuid, text, jsonb)
  TO service_role;

DO $$
DECLARE
  v_signature regprocedure;
BEGIN
  FOR v_signature IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'get_service_role_key',
        'get_ai_provider_key',
        'get_ai_provider_key_by_id',
        'get_project_api_url'
      )
  LOOP
    EXECUTE format('revoke all on function %s from public, anon, authenticated', v_signature);
    EXECUTE format('grant execute on function %s to service_role', v_signature);
  END LOOP;
END;
$$;

CREATE TABLE IF NOT EXISTS public.ai_usage_rate_limits (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  per_user_per_minute integer NOT NULL DEFAULT 10 CHECK (per_user_per_minute > 0),
  per_company_per_minute integer NOT NULL DEFAULT 60 CHECK (per_company_per_minute > 0),
  max_concurrent integer NOT NULL DEFAULT 5 CHECK (max_concurrent > 0),
  reservation_ttl_minutes integer NOT NULL DEFAULT 10
    CHECK (reservation_ttl_minutes BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_usage_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_ai_usage_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user integer := 10;
  v_company integer := 60;
  v_concurrent integer := 5;
  v_ttl integer := 10;
BEGIN
  IF new.company_id IS NULL THEN
    RAISE EXCEPTION 'AI_COMPANY_REQUIRED';
  END IF;

  SELECT per_user_per_minute, per_company_per_minute, max_concurrent, reservation_ttl_minutes
  INTO v_user, v_company, v_concurrent, v_ttl
  FROM public.ai_usage_rate_limits
  WHERE company_id = new.company_id;

  v_user := coalesce(v_user, 10);
  v_company := coalesce(v_company, 60);
  v_concurrent := coalesce(v_concurrent, 5);
  v_ttl := coalesce(v_ttl, 10);

  IF new.user_id IS NOT NULL AND (
    SELECT count(*) FROM public.ai_usage_events
    WHERE company_id = new.company_id
      AND user_id = new.user_id
      AND created_at >= now() - interval '1 minute'
  ) >= v_user THEN
    RAISE EXCEPTION 'AI_RATE_LIMITED_USER';
  END IF;

  IF (
    SELECT count(*) FROM public.ai_usage_events
    WHERE company_id = new.company_id
      AND created_at >= now() - interval '1 minute'
  ) >= v_company THEN
    RAISE EXCEPTION 'AI_RATE_LIMITED_COMPANY';
  END IF;

  IF (
    SELECT count(*) FROM public.ai_usage_events
    WHERE company_id = new.company_id
      AND status = 'reserved'
      AND created_at >= now() - make_interval(mins => v_ttl)
  ) >= v_concurrent THEN
    RAISE EXCEPTION 'AI_CONCURRENCY_LIMITED';
  END IF;

  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_ai_usage_rate_limit()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_ai_usage_rate_limit() TO service_role;

DROP TRIGGER IF EXISTS trg_ai_usage_rate_limit ON public.ai_usage_events;
CREATE TRIGGER trg_ai_usage_rate_limit
BEFORE INSERT ON public.ai_usage_events
FOR EACH ROW EXECUTE FUNCTION public.enforce_ai_usage_rate_limit();

DO $$
BEGIN
  IF to_regclass('public.ai_usage_events') IS NULL
     OR to_regclass('public.ai_usage_rate_limits') IS NULL THEN
    RAISE EXCEPTION 'Objetos de governança de IA não foram criados';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.ai_usage_events'::regclass
      AND tgname = 'trg_ai_usage_rate_limit'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'Trigger de rate limit de IA não foi criado';
  END IF;

  IF has_function_privilege('anon', 'public.reserve_ai_usage(uuid,uuid,text,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.reserve_ai_usage(uuid,uuid,text,uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.reserve_ai_usage(uuid,uuid,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'ACL incorreta em reserve_ai_usage';
  END IF;
END;
$$;

COMMIT;

SELECT
  to_regclass('public.ai_usage_events') IS NOT NULL
  AND to_regclass('public.ai_usage_rate_limits') IS NOT NULL
  AND NOT has_function_privilege('anon', 'public.reserve_ai_usage(uuid,uuid,text,uuid)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.reserve_ai_usage(uuid,uuid,text,uuid)', 'EXECUTE')
  AS ai_governance_rollout_ok;
