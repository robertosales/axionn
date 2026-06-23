-- ============================================================
-- MIGRATION: 20260623000002_apf_learning_engine_stage2_metrics.sql
-- Motor de Aprendizado APF — Estágio 2: Padrões + Métricas
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TABLE: apf_knowledge_patterns
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.apf_knowledge_patterns (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                    uuid        REFERENCES public.teams(id) ON DELETE CASCADE,

  pattern_name               text        NOT NULL,
  pattern_description        text,
  domain                     text,
  hu_pattern_keywords        text[],

  canonical_functional_type  text        NOT NULL,
  canonical_complexity       text        NOT NULL,
  confidence                 numeric(4,3) NOT NULL DEFAULT 0.500,

  evidence_count             integer     NOT NULL DEFAULT 0,
  correction_rate            numeric(4,3),

  pattern_embedding          vector(1536),

  status                     text        NOT NULL DEFAULT 'auto'
                             CHECK (status IN ('auto', 'validated', 'rejected')),
  validated_by               uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at               timestamptz,

  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.apf_knowledge_patterns IS
  'Memória organizacional explícita. Padrões auto-gerados via consolidate_apf_patterns() e validados por especialistas.';

CREATE INDEX IF NOT EXISTS idx_apf_kp_team   ON public.apf_knowledge_patterns(team_id);
CREATE INDEX IF NOT EXISTS idx_apf_kp_domain ON public.apf_knowledge_patterns(domain);
CREATE INDEX IF NOT EXISTS idx_apf_kp_status ON public.apf_knowledge_patterns(status);

CREATE OR REPLACE FUNCTION public.fn_set_updated_at_apf_kp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS trg_set_updated_at_apf_kp ON public.apf_knowledge_patterns;
CREATE TRIGGER trg_set_updated_at_apf_kp
  BEFORE UPDATE ON public.apf_knowledge_patterns
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at_apf_kp();

-- ────────────────────────────────────────────────────────────
-- 2. TABLE: apf_learning_metrics
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.apf_learning_metrics (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id               uuid        REFERENCES public.teams(id) ON DELETE CASCADE,
  provider_id           uuid        REFERENCES public.ai_providers(id) ON DELETE SET NULL,
  domain                text,
  week_start            date        NOT NULL,

  total_items           integer     NOT NULL DEFAULT 0,
  corrected_items       integer     NOT NULL DEFAULT 0,
  correction_rate       numeric(5,4),
  type_accuracy         numeric(5,4),
  complexity_accuracy   numeric(5,4),
  top_correction_reason text,
  correction_by_reason  jsonb,

  rag_total             integer     NOT NULL DEFAULT 0,
  rag_hits              integer     NOT NULL DEFAULT 0,
  rag_accuracy_with     numeric(5,4),
  rag_accuracy_without  numeric(5,4),
  rag_accuracy_delta    numeric(5,4),

  created_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (team_id, provider_id, domain, week_start)
);

CREATE INDEX IF NOT EXISTS idx_apf_lm_team ON public.apf_learning_metrics(team_id, week_start);
CREATE INDEX IF NOT EXISTS idx_apf_lm_week ON public.apf_learning_metrics(week_start DESC);

-- ────────────────────────────────────────────────────────────
-- 3. RPC: consolidate_apf_patterns (roda semanalmente via cron)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consolidate_apf_patterns(
  p_team_id       uuid    DEFAULT NULL,
  p_min_evidence  integer DEFAULT 3,
  p_lookback_days integer DEFAULT 90
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer := 0;
  v_rec   record;
BEGIN
  FOR v_rec IN
    SELECT
      validated_functional_type,
      validated_complexity,
      project_domain,
      team_id,
      COUNT(*) AS evidence_count,
      ROUND(SUM(CASE WHEN was_corrected THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0), 4) AS ai_error_rate
    FROM public.apf_validation_events
    WHERE hu_embedding IS NOT NULL
      AND (p_team_id IS NULL OR team_id = p_team_id)
      AND created_at >= now() - (p_lookback_days || ' days')::interval
    GROUP BY validated_functional_type, validated_complexity, project_domain, team_id
    HAVING COUNT(*) >= p_min_evidence
  LOOP
    INSERT INTO public.apf_knowledge_patterns (
      team_id, domain,
      canonical_functional_type, canonical_complexity,
      evidence_count, correction_rate, confidence,
      pattern_name, status
    )
    VALUES (
      v_rec.team_id, v_rec.project_domain,
      v_rec.validated_functional_type, v_rec.validated_complexity,
      v_rec.evidence_count, v_rec.ai_error_rate,
      COALESCE(1.0 - v_rec.ai_error_rate, 0.5),
      v_rec.validated_functional_type || ' ' || v_rec.validated_complexity
        || COALESCE(' — ' || v_rec.project_domain, ''),
      'auto'
    )
    ON CONFLICT DO NOTHING;

    UPDATE public.apf_knowledge_patterns
    SET
      evidence_count = v_rec.evidence_count,
      correction_rate = v_rec.ai_error_rate,
      confidence = COALESCE(1.0 - v_rec.ai_error_rate, 0.5),
      updated_at = now()
    WHERE canonical_functional_type = v_rec.validated_functional_type
      AND canonical_complexity      = v_rec.validated_complexity
      AND (team_id = v_rec.team_id OR (team_id IS NULL AND v_rec.team_id IS NULL))
      AND (domain  = v_rec.project_domain OR (domain IS NULL AND v_rec.project_domain IS NULL))
      AND status != 'rejected';

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('processed_groups', v_count, 'run_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.consolidate_apf_patterns TO service_role;

-- ────────────────────────────────────────────────────────────
-- 4. RPC: compute_learning_metrics (roda semanalmente via cron)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_learning_metrics(
  p_week_start date DEFAULT date_trunc('week', CURRENT_DATE)::date
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inserted integer := 0;
  v_rec      record;
BEGIN
  FOR v_rec IN
    SELECT
      team_id,
      provider_id,
      project_domain AS domain,
      COUNT(*) AS total_items,
      SUM(CASE WHEN was_corrected THEN 1 ELSE 0 END) AS corrected_items,
      ROUND(SUM(CASE WHEN was_corrected THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0), 4) AS correction_rate,
      ROUND(SUM(CASE WHEN ai_functional_type = validated_functional_type THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0), 4) AS type_accuracy,
      ROUND(SUM(CASE WHEN ai_complexity = validated_complexity THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0), 4) AS complexity_accuracy,
      SUM(CASE WHEN rag_was_used THEN 1 ELSE 0 END) AS rag_total,
      SUM(CASE WHEN rag_was_used AND rag_case_count > 0 THEN 1 ELSE 0 END) AS rag_hits,
      ROUND(SUM(CASE WHEN rag_was_used AND NOT was_corrected THEN 1 ELSE 0 END)::numeric / NULLIF(SUM(CASE WHEN rag_was_used THEN 1 ELSE 0 END),0), 4) AS rag_acc_with,
      ROUND(SUM(CASE WHEN NOT rag_was_used AND NOT was_corrected THEN 1 ELSE 0 END)::numeric / NULLIF(SUM(CASE WHEN NOT rag_was_used THEN 1 ELSE 0 END),0), 4) AS rag_acc_without,
      MODE() WITHIN GROUP (ORDER BY correction_reason_code::text) FILTER (WHERE correction_reason_code IS NOT NULL) AS top_reason
    FROM public.apf_validation_events
    WHERE created_at >= p_week_start
      AND created_at <  p_week_start + interval '7 days'
    GROUP BY team_id, provider_id, project_domain
  LOOP
    INSERT INTO public.apf_learning_metrics (
      team_id, provider_id, domain, week_start,
      total_items, corrected_items, correction_rate,
      type_accuracy, complexity_accuracy,
      top_correction_reason,
      rag_total, rag_hits,
      rag_accuracy_with, rag_accuracy_without,
      rag_accuracy_delta
    )
    VALUES (
      v_rec.team_id, v_rec.provider_id, v_rec.domain, p_week_start,
      v_rec.total_items, v_rec.corrected_items, v_rec.correction_rate,
      v_rec.type_accuracy, v_rec.complexity_accuracy,
      v_rec.top_reason,
      v_rec.rag_total, v_rec.rag_hits,
      v_rec.rag_acc_with, v_rec.rag_acc_without,
      COALESCE(v_rec.rag_acc_with, 0) - COALESCE(v_rec.rag_acc_without, 0)
    )
    ON CONFLICT (team_id, provider_id, domain, week_start)
    DO UPDATE SET
      total_items           = EXCLUDED.total_items,
      corrected_items       = EXCLUDED.corrected_items,
      correction_rate       = EXCLUDED.correction_rate,
      type_accuracy         = EXCLUDED.type_accuracy,
      complexity_accuracy   = EXCLUDED.complexity_accuracy,
      top_correction_reason = EXCLUDED.top_correction_reason,
      rag_total             = EXCLUDED.rag_total,
      rag_hits              = EXCLUDED.rag_hits,
      rag_accuracy_with     = EXCLUDED.rag_accuracy_with,
      rag_accuracy_without  = EXCLUDED.rag_accuracy_without,
      rag_accuracy_delta    = EXCLUDED.rag_accuracy_delta;

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('week_start', p_week_start, 'rows_upserted', v_inserted, 'run_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_learning_metrics TO service_role;

-- ────────────────────────────────────────────────────────────
-- 5. Views para o Dashboard
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_apf_accuracy_trend AS
SELECT
  date_trunc('week', created_at)::date AS week,
  team_id,
  provider_id,
  COUNT(*) AS total_items,
  SUM(CASE WHEN was_corrected THEN 1 ELSE 0 END) AS corrected_items,
  ROUND(SUM(CASE WHEN NOT was_corrected THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0) * 100, 1) AS accuracy_pct,
  ROUND(SUM(CASE WHEN ai_functional_type = validated_functional_type THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0) * 100, 1) AS type_accuracy_pct,
  ROUND(SUM(CASE WHEN ai_complexity = validated_complexity THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*),0) * 100, 1) AS complexity_accuracy_pct
FROM public.apf_validation_events
GROUP BY 1, 2, 3
ORDER BY 1 DESC;

CREATE OR REPLACE VIEW public.v_apf_confusion_matrix AS
SELECT
  ai_functional_type,
  validated_functional_type,
  ai_complexity,
  validated_complexity,
  COUNT(*) AS occurrences,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER (PARTITION BY ai_functional_type) * 100, 1) AS pct_of_ai_type
FROM public.apf_validation_events
WHERE was_corrected = true
GROUP BY 1, 2, 3, 4
ORDER BY ai_functional_type, occurrences DESC;

CREATE OR REPLACE VIEW public.v_apf_confidence_calibration AS
SELECT
  ROUND(ai_confidence_score, 1) AS confidence_bucket,
  COUNT(*) AS total,
  ROUND(AVG(CASE WHEN NOT was_corrected THEN 1.0 ELSE 0.0 END), 3) AS actual_accuracy,
  ROUND(AVG(CASE WHEN NOT was_corrected THEN 1.0 ELSE 0.0 END) - ROUND(ai_confidence_score, 1), 3) AS calibration_error
FROM public.apf_validation_events
WHERE ai_confidence_score IS NOT NULL
GROUP BY 1
ORDER BY 1;

-- ────────────────────────────────────────────────────────────
-- 6. RLS — apf_knowledge_patterns
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.apf_knowledge_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apf_kp_select_team_or_admin"
  ON public.apf_knowledge_patterns FOR SELECT
  USING (
    team_id IS NULL
    OR public.is_team_member(auth.uid(), team_id)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "apf_kp_manage_service_role"
  ON public.apf_knowledge_patterns
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "apf_kp_validate_member"
  ON public.apf_knowledge_patterns FOR UPDATE
  USING (
    public.is_team_member(auth.uid(), team_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- ────────────────────────────────────────────────────────────
-- 7. RLS — apf_learning_metrics
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.apf_learning_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apf_lm_select_team_or_admin"
  ON public.apf_learning_metrics FOR SELECT
  USING (
    public.is_team_member(auth.uid(), team_id)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "apf_lm_manage_service_role"
  ON public.apf_learning_metrics
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────
-- 8. Grants
-- ────────────────────────────────────────────────────────────
GRANT SELECT ON public.apf_knowledge_patterns        TO authenticated;
GRANT SELECT ON public.apf_learning_metrics          TO authenticated;
GRANT SELECT ON public.v_apf_accuracy_trend          TO authenticated;
GRANT SELECT ON public.v_apf_confusion_matrix        TO authenticated;
GRANT SELECT ON public.v_apf_confidence_calibration  TO authenticated;
GRANT ALL    ON public.apf_knowledge_patterns        TO service_role;
GRANT ALL    ON public.apf_learning_metrics          TO service_role;
