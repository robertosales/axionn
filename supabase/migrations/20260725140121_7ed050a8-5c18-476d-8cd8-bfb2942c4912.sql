-- ============================================================================
-- PR 5 (OKR v2) — Key Results + Motor Canônico
-- Idempotente. Nenhum DELETE físico. Toda mutação de KR passa por RPC.
-- ============================================================================
BEGIN;

-- 1. Colunas complementares em okr_key_results ----------------------------
ALTER TABLE public.okr_key_results
  ADD COLUMN IF NOT EXISTS lock_version   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS archived_at    timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archive_reason text,
  ADD COLUMN IF NOT EXISTS allow_overachievement boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_okr_key_results_objective_lifecycle
  ON public.okr_key_results (objective_id, lifecycle_status);

-- 2. Motor canônico: progresso do KR --------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_okr_kr_progress_v2(
  p_direction   text,
  p_baseline    numeric,
  p_current     numeric,
  p_target      numeric,
  p_target_min  numeric,
  p_target_max  numeric,
  p_allow_overachievement boolean DEFAULT true
) RETURNS TABLE(
  raw_progress numeric,
  calculated_progress numeric,
  calculation_status text,
  calculation_reason text
)
LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
DECLARE
  v_raw numeric;
  v_dir text := COALESCE(lower(p_direction), 'increase');
BEGIN
  -- Sem dados suficientes -> no_data (não confundir com zero).
  IF p_current IS NULL OR p_baseline IS NULL THEN
    IF v_dir = 'range' THEN
      RETURN QUERY SELECT NULL::numeric, NULL::numeric, 'no_data', 'Sem baseline ou medição';
      RETURN;
    END IF;
    IF p_current IS NULL OR p_baseline IS NULL THEN
      RETURN QUERY SELECT NULL::numeric, NULL::numeric, 'no_data', 'Sem baseline ou medição';
      RETURN;
    END IF;
  END IF;

  IF v_dir = 'range' THEN
    IF p_target_min IS NULL OR p_target_max IS NULL OR p_target_min > p_target_max THEN
      RETURN QUERY SELECT NULL::numeric, NULL::numeric, 'invalid_config', 'Faixa mínima/máxima inválida';
      RETURN;
    END IF;
    IF p_current BETWEEN p_target_min AND p_target_max THEN
      RETURN QUERY SELECT 100::numeric, 100::numeric, 'ok', 'Dentro da faixa';
      RETURN;
    END IF;
    DECLARE v_target numeric; v_denom numeric;
    BEGIN
      v_target := CASE
        WHEN p_baseline < p_target_min THEN p_target_min
        WHEN p_baseline > p_target_max THEN p_target_max
        WHEN p_current < p_target_min THEN p_target_min
        ELSE p_target_max END;
      v_denom := abs(v_target - p_baseline);
      IF v_denom = 0 THEN
        RETURN QUERY SELECT 0::numeric, 0::numeric, 'ok', 'Fora da faixa esperada';
        RETURN;
      END IF;
      v_raw := (1 - abs(v_target - p_current) / v_denom) * 100;
      RETURN QUERY SELECT v_raw, GREATEST(0, LEAST(100, v_raw)), 'ok', NULL;
      RETURN;
    END;
  END IF;

  IF v_dir = 'boolean' THEN
    v_raw := CASE WHEN COALESCE(p_current, 0) >= COALESCE(p_target, 1) THEN 100 ELSE 0 END;
    RETURN QUERY SELECT v_raw, v_raw, 'ok', NULL;
    RETURN;
  END IF;

  IF p_target IS NULL THEN
    RETURN QUERY SELECT NULL::numeric, NULL::numeric, 'invalid_config', 'Meta não configurada';
    RETURN;
  END IF;

  IF p_baseline = p_target THEN
    v_raw := CASE
      WHEN v_dir = 'decrease' AND p_current <= p_target THEN 100
      WHEN v_dir = 'increase' AND p_current >= p_target THEN 100
      ELSE 0 END;
    RETURN QUERY SELECT v_raw, v_raw, 'ok', 'Baseline igual à meta';
    RETURN;
  END IF;

  IF v_dir = 'decrease' THEN
    v_raw := ((p_baseline - p_current) / (p_baseline - p_target)) * 100;
  ELSE
    v_raw := ((p_current - p_baseline) / (p_target - p_baseline)) * 100;
  END IF;

  RETURN QUERY SELECT
    v_raw,
    CASE
      WHEN p_allow_overachievement THEN GREATEST(0, v_raw)
      ELSE GREATEST(0, LEAST(100, v_raw))
    END,
    'ok',
    NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_okr_kr_progress_v2(text,numeric,numeric,numeric,numeric,numeric,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_okr_kr_progress_v2(text,numeric,numeric,numeric,numeric,numeric,boolean) TO authenticated, service_role;

-- 3. Motor canônico: saúde do Objective -----------------------------------
CREATE OR REPLACE FUNCTION public.resolve_okr_objective_health_v2(
  p_progress numeric,
  p_expected_progress numeric,
  p_lifecycle_status text
) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
DECLARE v_gap numeric;
BEGIN
  IF p_lifecycle_status = 'completed' THEN RETURN 'completed'; END IF;
  IF p_progress IS NULL THEN RETURN 'no_data'; END IF;
  v_gap := p_progress - COALESCE(p_expected_progress, 0);
  IF v_gap >= -10 THEN RETURN 'on_track'; END IF;
  IF v_gap >= -25 THEN RETURN 'attention'; END IF;
  RETURN 'at_risk';
END;
$$;
REVOKE ALL ON FUNCTION public.resolve_okr_objective_health_v2(numeric,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_okr_objective_health_v2(numeric,numeric,text) TO authenticated, service_role;

-- 4. Motor canônico: recálculo do Objective -------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_okr_objective_v2(p_objective_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total_weight numeric := 0;
  v_agg numeric := 0;
  v_count int := 0;
  v_measured int := 0;
  v_has_weights boolean := false;
  v_progress numeric;
  v_expected numeric;
  v_lifecycle text;
  v_start date; v_end date;
  v_today date := current_date;
  r record;
BEGIN
  SELECT lifecycle_status, start_date, end_date
    INTO v_lifecycle, v_start, v_end
    FROM public.okr_objectives WHERE id = p_objective_id;
  IF NOT FOUND THEN RETURN; END IF;

  FOR r IN
    SELECT calculated_progress, weight
    FROM public.okr_key_results
    WHERE objective_id = p_objective_id
      AND lifecycle_status IN ('active','completed')
  LOOP
    v_count := v_count + 1;
    IF r.weight IS NOT NULL AND r.weight > 0 THEN
      v_has_weights := true;
      v_total_weight := v_total_weight + r.weight;
    END IF;
    IF r.calculated_progress IS NOT NULL THEN
      v_measured := v_measured + 1;
    END IF;
  END LOOP;

  IF v_measured = 0 THEN
    v_progress := NULL;
  ELSIF v_has_weights AND abs(v_total_weight - 100) < 0.01 THEN
    SELECT COALESCE(SUM(COALESCE(calculated_progress,0) * weight / 100.0), 0)
      INTO v_progress
      FROM public.okr_key_results
      WHERE objective_id = p_objective_id
        AND lifecycle_status IN ('active','completed')
        AND calculated_progress IS NOT NULL;
  ELSE
    SELECT AVG(calculated_progress)
      INTO v_progress
      FROM public.okr_key_results
      WHERE objective_id = p_objective_id
        AND lifecycle_status IN ('active','completed')
        AND calculated_progress IS NOT NULL;
  END IF;

  IF v_start IS NOT NULL AND v_end IS NOT NULL AND v_end > v_start THEN
    v_expected := LEAST(100, GREATEST(0,
      (v_today - v_start)::numeric * 100.0 / NULLIF((v_end - v_start),0)::numeric));
  ELSE
    v_expected := NULL;
  END IF;

  UPDATE public.okr_objectives SET
    calculated_progress = v_progress,
    progress            = COALESCE(ROUND(v_progress)::int, 0),
    calculated_health   = public.resolve_okr_objective_health_v2(v_progress, v_expected, v_lifecycle),
    updated_at          = now()
  WHERE id = p_objective_id;
END;
$$;
REVOKE ALL ON FUNCTION public.recalculate_okr_objective_v2(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recalculate_okr_objective_v2(uuid) TO authenticated, service_role;

-- 5. RPC create_okr_key_result_v2 -----------------------------------------
CREATE OR REPLACE FUNCTION public.create_okr_key_result_v2(
  p_org_id uuid,
  p_objective_id uuid,
  p_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_org uuid; v_lifecycle text;
  v_calc record;
  v_direction text := COALESCE(NULLIF(p_payload->>'direction',''), 'increase');
  v_unit text := COALESCE(NULLIF(p_payload->>'unit',''), '%');
  v_title text := trim(COALESCE(p_payload->>'title',''));
  v_baseline numeric := NULLIF(p_payload->>'baseline_value','')::numeric;
  v_target numeric := NULLIF(p_payload->>'target_value','')::numeric;
  v_target_min numeric := NULLIF(p_payload->>'target_min','')::numeric;
  v_target_max numeric := NULLIF(p_payload->>'target_max','')::numeric;
  v_current numeric := NULLIF(p_payload->>'current_value','')::numeric;
  v_weight numeric := NULLIF(p_payload->>'weight','')::numeric;
  v_owner uuid := COALESCE(NULLIF(p_payload->>'owner_id','')::uuid, auth.uid());
  v_update_type text := COALESCE(NULLIF(p_payload->>'update_type',''), 'manual');
  v_freq text := COALESCE(NULLIF(p_payload->>'frequency',''), 'weekly');
  v_metric_code text := NULLIF(p_payload->>'metric_code','');
  v_start date := NULLIF(p_payload->>'start_date','')::date;
  v_end date := NULLIF(p_payload->>'end_date','')::date;
  v_allow_over boolean := COALESCE((p_payload->>'allow_overachievement')::boolean, true);
BEGIN
  PERFORM public._okr_v2_guard(p_org_id, 'okr.create');

  IF v_title = '' THEN
    RAISE EXCEPTION 'OKR_V2_KR_TITLE_REQUIRED' USING ERRCODE='22023';
  END IF;

  SELECT organization_id, lifecycle_status INTO v_org, v_lifecycle
    FROM public.okr_objectives WHERE id = p_objective_id FOR UPDATE;
  IF v_org IS NULL OR v_org <> p_org_id THEN
    RAISE EXCEPTION 'OKR_V2_OBJECTIVE_NOT_FOUND' USING ERRCODE='22023';
  END IF;
  IF v_lifecycle IN ('archived','cancelled','completed') THEN
    RAISE EXCEPTION 'OKR_V2_OBJECTIVE_LOCKED: lifecycle=%', v_lifecycle USING ERRCODE='42501';
  END IF;

  SELECT * INTO v_calc FROM public.calculate_okr_kr_progress_v2(
    v_direction, v_baseline, v_current, v_target, v_target_min, v_target_max, v_allow_over
  );

  INSERT INTO public.okr_key_results (
    objective_id, title, description, unit, direction,
    baseline_value, current_value, target_value, target, current,
    target_min, target_max, weight, owner_id,
    update_type, frequency, metric_code, start_date, end_date,
    allow_overachievement,
    raw_progress, calculated_progress, calculated_health, measurement_quality,
    formula_version, lifecycle_status, created_by, updated_by
  ) VALUES (
    p_objective_id, v_title, p_payload->>'description', v_unit, v_direction,
    v_baseline, v_current, v_target, COALESCE(v_target, 100), COALESCE(v_current, 0),
    v_target_min, v_target_max, v_weight, v_owner,
    v_update_type, v_freq, v_metric_code, v_start, v_end,
    v_allow_over,
    v_calc.raw_progress, v_calc.calculated_progress,
    CASE WHEN v_calc.calculated_progress IS NULL THEN 'no_data' ELSE 'on_track' END,
    CASE WHEN v_calc.calculated_progress IS NULL THEN 'no_data' ELSE 'ok' END,
    '2.0', 'active', auth.uid(), auth.uid()
  ) RETURNING id INTO v_id;

  PERFORM public.recalculate_okr_objective_v2(p_objective_id);

  INSERT INTO public.okr_audit_log (objective_id, actor_id, action, payload, created_at)
  VALUES (p_objective_id, auth.uid(), 'kr.created',
          jsonb_build_object('kr_id', v_id, 'title', v_title), now())
  ON CONFLICT DO NOTHING;

  RETURN v_id;
END;
$$;

-- 6. RPC update_okr_key_result_v2 -----------------------------------------
CREATE OR REPLACE FUNCTION public.update_okr_key_result_v2(
  p_org_id uuid,
  p_key_result_id uuid,
  p_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_objective uuid;
  v_org uuid;
  v_kr_lifecycle text;
  v_lock int; v_expected int;
  v_direction text; v_unit text;
  v_baseline numeric; v_current numeric; v_target numeric;
  v_tmin numeric; v_tmax numeric; v_over boolean;
  v_calc record;
BEGIN
  PERFORM public._okr_v2_guard(p_org_id, 'okr.edit');

  SELECT kr.objective_id, o.organization_id, kr.lifecycle_status, kr.lock_version,
         kr.direction, kr.unit, kr.baseline_value, kr.current_value, kr.target_value,
         kr.target_min, kr.target_max, kr.allow_overachievement
    INTO v_objective, v_org, v_kr_lifecycle, v_lock,
         v_direction, v_unit, v_baseline, v_current, v_target, v_tmin, v_tmax, v_over
    FROM public.okr_key_results kr
    JOIN public.okr_objectives o ON o.id = kr.objective_id
    WHERE kr.id = p_key_result_id
    FOR UPDATE OF kr;

  IF v_org IS NULL OR v_org <> p_org_id THEN
    RAISE EXCEPTION 'OKR_V2_KR_NOT_FOUND' USING ERRCODE='22023';
  END IF;
  IF v_kr_lifecycle IN ('archived','cancelled') THEN
    RAISE EXCEPTION 'OKR_V2_KR_LOCKED: %', v_kr_lifecycle USING ERRCODE='42501';
  END IF;

  v_expected := NULLIF(p_payload->>'lock_version','')::int;
  IF v_expected IS NOT NULL AND v_expected <> v_lock THEN
    RAISE EXCEPTION 'OKR_V2_KR_LOCK_CONFLICT: esperado=%, atual=%', v_expected, v_lock
      USING ERRCODE='40001';
  END IF;

  -- Sobrescreve com valores do payload quando presentes
  IF p_payload ? 'direction'   THEN v_direction := COALESCE(NULLIF(p_payload->>'direction',''), v_direction); END IF;
  IF p_payload ? 'unit'        THEN v_unit := COALESCE(NULLIF(p_payload->>'unit',''), v_unit); END IF;
  IF p_payload ? 'baseline_value' THEN v_baseline := NULLIF(p_payload->>'baseline_value','')::numeric; END IF;
  IF p_payload ? 'current_value'  THEN v_current  := NULLIF(p_payload->>'current_value','')::numeric; END IF;
  IF p_payload ? 'target_value'   THEN v_target   := NULLIF(p_payload->>'target_value','')::numeric; END IF;
  IF p_payload ? 'target_min'     THEN v_tmin     := NULLIF(p_payload->>'target_min','')::numeric; END IF;
  IF p_payload ? 'target_max'     THEN v_tmax     := NULLIF(p_payload->>'target_max','')::numeric; END IF;
  IF p_payload ? 'allow_overachievement' THEN v_over := (p_payload->>'allow_overachievement')::boolean; END IF;

  SELECT * INTO v_calc FROM public.calculate_okr_kr_progress_v2(
    v_direction, v_baseline, v_current, v_target, v_tmin, v_tmax, v_over
  );

  UPDATE public.okr_key_results SET
    title          = COALESCE(NULLIF(p_payload->>'title',''), title),
    description    = CASE WHEN p_payload ? 'description' THEN p_payload->>'description' ELSE description END,
    unit           = v_unit,
    direction      = v_direction,
    baseline_value = v_baseline,
    current_value  = v_current,
    target_value   = v_target,
    target         = COALESCE(v_target, target),
    "current"      = COALESCE(v_current, "current"),
    target_min     = v_tmin,
    target_max     = v_tmax,
    weight         = CASE WHEN p_payload ? 'weight' THEN NULLIF(p_payload->>'weight','')::numeric ELSE weight END,
    owner_id       = COALESCE(NULLIF(p_payload->>'owner_id','')::uuid, owner_id),
    update_type    = COALESCE(NULLIF(p_payload->>'update_type',''), update_type),
    frequency      = COALESCE(NULLIF(p_payload->>'frequency',''), frequency),
    metric_code    = CASE WHEN p_payload ? 'metric_code' THEN NULLIF(p_payload->>'metric_code','') ELSE metric_code END,
    start_date     = CASE WHEN p_payload ? 'start_date' THEN NULLIF(p_payload->>'start_date','')::date ELSE start_date END,
    end_date       = CASE WHEN p_payload ? 'end_date'   THEN NULLIF(p_payload->>'end_date','')::date   ELSE end_date END,
    allow_overachievement = v_over,
    raw_progress          = v_calc.raw_progress,
    calculated_progress   = v_calc.calculated_progress,
    measurement_quality   = CASE WHEN v_calc.calculated_progress IS NULL THEN 'no_data' ELSE 'ok' END,
    formula_version = '2.0',
    lock_version    = lock_version + 1,
    updated_by      = auth.uid(),
    updated_at      = now()
  WHERE id = p_key_result_id;

  PERFORM public.recalculate_okr_objective_v2(v_objective);

  INSERT INTO public.okr_audit_log (objective_id, actor_id, action, payload, created_at)
  VALUES (v_objective, auth.uid(), 'kr.updated',
          jsonb_build_object('kr_id', p_key_result_id) || p_payload, now())
  ON CONFLICT DO NOTHING;

  RETURN p_key_result_id;
END;
$$;

-- 7. RPC archive_okr_key_result_v2 (implementação real) -------------------
CREATE OR REPLACE FUNCTION public.archive_okr_key_result_v2(
  p_org_id uuid,
  p_key_result_id uuid,
  p_reason text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_objective uuid; v_org uuid; v_lifecycle text;
BEGIN
  PERFORM public._okr_v2_guard(p_org_id, 'okr.archive');

  SELECT kr.objective_id, o.organization_id, kr.lifecycle_status
    INTO v_objective, v_org, v_lifecycle
    FROM public.okr_key_results kr
    JOIN public.okr_objectives o ON o.id = kr.objective_id
    WHERE kr.id = p_key_result_id
    FOR UPDATE OF kr;

  IF v_org IS NULL OR v_org <> p_org_id THEN
    RAISE EXCEPTION 'OKR_V2_KR_NOT_FOUND' USING ERRCODE='22023';
  END IF;
  IF v_lifecycle = 'archived' THEN
    RETURN p_key_result_id;
  END IF;

  UPDATE public.okr_key_results SET
    lifecycle_status = 'archived',
    archived_at      = now(),
    archived_by      = auth.uid(),
    archive_reason   = p_reason,
    lock_version     = lock_version + 1,
    updated_by       = auth.uid(),
    updated_at       = now()
  WHERE id = p_key_result_id;

  PERFORM public.recalculate_okr_objective_v2(v_objective);

  INSERT INTO public.okr_audit_log (objective_id, actor_id, action, payload, created_at)
  VALUES (v_objective, auth.uid(), 'kr.archived',
          jsonb_build_object('kr_id', p_key_result_id, 'reason', p_reason), now())
  ON CONFLICT DO NOTHING;

  RETURN p_key_result_id;
END;
$$;

-- 8. RPC list_okr_key_results_v2 ------------------------------------------
CREATE OR REPLACE FUNCTION public.list_okr_key_results_v2(
  p_org_id uuid,
  p_objective_id uuid,
  p_include_archived boolean DEFAULT false
) RETURNS TABLE (
  id uuid,
  objective_id uuid,
  title text,
  description text,
  unit text,
  direction text,
  baseline_value numeric,
  current_value numeric,
  target_value numeric,
  target_min numeric,
  target_max numeric,
  weight numeric,
  owner_id uuid,
  update_type text,
  frequency text,
  metric_code text,
  start_date date,
  end_date date,
  allow_overachievement boolean,
  raw_progress numeric,
  calculated_progress numeric,
  calculated_health text,
  measurement_quality text,
  lifecycle_status text,
  formula_version text,
  lock_version integer,
  last_measured_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public._okr_v2_guard(p_org_id, 'okr.view');
  RETURN QUERY
    SELECT kr.id, kr.objective_id, kr.title, kr.description, kr.unit, kr.direction,
           kr.baseline_value, kr.current_value, kr.target_value, kr.target_min, kr.target_max,
           kr.weight, kr.owner_id, kr.update_type, kr.frequency, kr.metric_code,
           kr.start_date, kr.end_date, kr.allow_overachievement,
           kr.raw_progress, kr.calculated_progress, kr.calculated_health, kr.measurement_quality,
           kr.lifecycle_status, kr.formula_version, kr.lock_version, kr.last_measured_at,
           kr.archived_at, kr.created_at, kr.updated_at
      FROM public.okr_key_results kr
      JOIN public.okr_objectives o ON o.id = kr.objective_id
     WHERE o.organization_id = p_org_id
       AND kr.objective_id = p_objective_id
       AND (p_include_archived OR kr.lifecycle_status <> 'archived')
     ORDER BY kr.created_at ASC;
END;
$$;

-- 9. Substitui upsert_okr_key_result_v2 (PR2 stub) para roteamento -------
CREATE OR REPLACE FUNCTION public.upsert_okr_key_result_v2(
  p_org_id uuid,
  p_objective_id uuid,
  p_payload jsonb,
  p_key_result_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_key_result_id IS NULL THEN
    RETURN public.create_okr_key_result_v2(p_org_id, p_objective_id, p_payload);
  ELSE
    RETURN public.update_okr_key_result_v2(p_org_id, p_key_result_id, p_payload);
  END IF;
END;
$$;

-- 10. publish_okr_objective_v2 — reforçar exigência de pelo menos 1 KR ---
CREATE OR REPLACE FUNCTION public.publish_okr_objective_v2(
  p_org_id uuid,
  p_objective_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_owner uuid; v_lifecycle text; v_org uuid; v_cycle_status text; v_kr_count int;
BEGIN
  PERFORM public._okr_v2_guard(p_org_id, 'okr.edit');

  SELECT o.organization_id, o.owner_id, o.lifecycle_status, c.status
    INTO v_org, v_owner, v_lifecycle, v_cycle_status
  FROM public.okr_objectives o
  LEFT JOIN public.okr_cycles c ON c.id = o.cycle_id
  WHERE o.id = p_objective_id
  FOR UPDATE;

  IF v_org IS NULL OR v_org <> p_org_id THEN
    RAISE EXCEPTION 'OKR_V2_OBJECTIVE_NOT_FOUND' USING ERRCODE='22023';
  END IF;
  IF v_lifecycle NOT IN ('draft','ready') THEN
    RAISE EXCEPTION 'OKR_V2_OBJECTIVE_ALREADY_PUBLISHED: %', v_lifecycle USING ERRCODE='22023';
  END IF;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'OKR_V2_OWNER_REQUIRED_FOR_PUBLISH' USING ERRCODE='22023';
  END IF;
  IF v_cycle_status NOT IN ('planning','active') THEN
    RAISE EXCEPTION 'OKR_V2_CYCLE_NOT_OPEN: %', v_cycle_status USING ERRCODE='22023';
  END IF;

  SELECT COUNT(*) INTO v_kr_count FROM public.okr_key_results
    WHERE objective_id = p_objective_id AND lifecycle_status = 'active';
  IF v_kr_count = 0 THEN
    RAISE EXCEPTION 'OKR_V2_PUBLISH_REQUIRES_KR' USING ERRCODE='22023';
  END IF;

  UPDATE public.okr_objectives SET
    lifecycle_status = 'active',
    published_at     = now(),
    published_by     = auth.uid(),
    lock_version     = lock_version + 1,
    updated_by       = auth.uid(),
    updated_at       = now()
  WHERE id = p_objective_id;

  INSERT INTO public.okr_audit_log (objective_id, actor_id, action, payload, created_at)
  VALUES (p_objective_id, auth.uid(), 'objective.published', '{}'::jsonb, now())
  ON CONFLICT DO NOTHING;

  RETURN p_objective_id;
END;
$$;

-- 11. GRANTs ---------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_okr_key_result_v2(uuid,uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_okr_key_result_v2(uuid,uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_okr_key_result_v2(uuid,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_okr_key_results_v2(uuid,uuid,boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_okr_key_result_v2(uuid,uuid,jsonb,uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_okr_key_result_v2(uuid,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_okr_key_result_v2(uuid,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_okr_key_result_v2(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_okr_key_results_v2(uuid,uuid,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_okr_key_result_v2(uuid,uuid,jsonb,uuid) TO authenticated;

COMMIT;