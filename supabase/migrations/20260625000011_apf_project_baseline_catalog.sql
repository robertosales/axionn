-- ============================================================
-- APF — baseline de projeto, catálogo de processos e exclusão segura.
-- ============================================================

ALTER TABLE public.apf_project_baselines
  ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'project',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_apf_project_baseline_scope'
  ) THEN
    ALTER TABLE public.apf_project_baselines
      ADD CONSTRAINT ck_apf_project_baseline_scope
      CHECK (scope_type = 'project');
  END IF;
END $$;

ALTER TABLE public.apf_baseline_items
  ADD COLUMN IF NOT EXISTS process_ref TEXT,
  ADD COLUMN IF NOT EXISTS process_name TEXT,
  ADD COLUMN IF NOT EXISTS product_reference TEXT,
  ADD COLUMN IF NOT EXISTS project_reference TEXT,
  ADD COLUMN IF NOT EXISTS measurement_reference TEXT;

UPDATE public.apf_baseline_items
SET process_ref = coalesce(
      process_ref,
      CASE
        WHEN description ~* '\mEF\s*0*[0-9]+\M' THEN
          'EF' || lpad((regexp_match(description, '(?i)\mEF\s*0*([0-9]+)\M'))[1], 3, '0')
        ELSE 'ITEM:' || replace(public.normalize_apf_text(description), ' ', '-')
      END
    ),
    process_name = coalesce(process_name, description)
WHERE process_ref IS NULL OR process_name IS NULL;

CREATE INDEX IF NOT EXISTS idx_apf_baseline_items_process_ref
  ON public.apf_baseline_items(baseline_id, process_ref);
CREATE INDEX IF NOT EXISTS idx_apf_baseline_items_process_name
  ON public.apf_baseline_items USING gin (process_name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.apf_function_type_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES public.apf_counting_models(id) ON DELETE CASCADE,
  function_sigla TEXT NOT NULL,
  complexity TEXT NOT NULL,
  weight NUMERIC(8,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_apf_function_type_weight
    UNIQUE(model_id, function_sigla, complexity),
  CONSTRAINT ck_apf_function_type_weight_positive CHECK (weight > 0)
);

CREATE INDEX IF NOT EXISTS idx_apf_function_type_weights_lookup
  ON public.apf_function_type_weights(model_id, function_sigla, complexity);

CREATE OR REPLACE FUNCTION public.apf_import_project_baseline(
  p_project_id UUID,
  p_version TEXT,
  p_label TEXT DEFAULT NULL,
  p_source_name TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_function_types JSONB DEFAULT '[]'::jsonb,
  p_impact_factors JSONB DEFAULT '[]'::jsonb,
  p_source_summary JSONB DEFAULT '{}'::jsonb,
  p_activate BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_baseline_id UUID;
  v_model_id UUID;
  v_item JSONB;
  v_type JSONB;
  v_complexity RECORD;
  v_process_count INT;
BEGIN
  v_result := public.apf_import_baseline(
    p_project_id,
    p_version,
    p_label,
    p_source_name,
    p_items,
    p_function_types,
    p_impact_factors,
    coalesce(p_source_summary, '{}'::jsonb) || jsonb_build_object('scope_type', 'project'),
    p_activate
  );

  v_baseline_id := (v_result->>'baseline_id')::uuid;
  v_model_id := (v_result->>'model_id')::uuid;

  UPDATE public.apf_project_baselines
  SET scope_type = 'project',
      deleted_at = NULL,
      deleted_by = NULL,
      source_summary = source_summary || jsonb_build_object(
        'scope_type', 'project',
        'process_count', coalesce((p_source_summary->>'process_count')::int, 0)
      )
  WHERE id = v_baseline_id;

  FOR v_item IN
    SELECT * FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  LOOP
    UPDATE public.apf_baseline_items
    SET process_ref = coalesce(nullif(v_item->>'process_ref', ''), process_ref),
        process_name = coalesce(nullif(v_item->>'process_name', ''), description),
        product_reference = nullif(v_item->>'product_reference', ''),
        project_reference = nullif(v_item->>'project_reference', ''),
        measurement_reference = nullif(v_item->>'measurement_reference', ''),
        normalized_key = public.normalize_apf_text(concat_ws(
          ' ',
          v_item->>'process_ref',
          v_item->>'process_name',
          v_item->>'description',
          v_item->>'product_reference',
          v_item->>'project_reference',
          v_item->>'measurement_reference'
        ))
    WHERE baseline_id = v_baseline_id
      AND item_ref = v_item->>'item_ref';
  END LOOP;

  DELETE FROM public.apf_function_type_weights
  WHERE model_id = v_model_id;

  FOR v_type IN
    SELECT * FROM jsonb_array_elements(coalesce(p_function_types, '[]'::jsonb))
  LOOP
    FOR v_complexity IN
      SELECT key, value
      FROM jsonb_each_text(coalesce(v_type->'weights_by_complexity', '{}'::jsonb))
    LOOP
      INSERT INTO public.apf_function_type_weights(
        model_id,
        function_sigla,
        complexity,
        weight
      ) VALUES (
        v_model_id,
        upper(v_type->>'sigla'),
        v_complexity.key,
        v_complexity.value::numeric
      )
      ON CONFLICT (model_id, function_sigla, complexity) DO UPDATE SET
        weight = excluded.weight,
        updated_at = now();
    END LOOP;
  END LOOP;

  SELECT count(DISTINCT process_ref)
  INTO v_process_count
  FROM public.apf_baseline_items
  WHERE baseline_id = v_baseline_id;

  RETURN v_result || jsonb_build_object(
    'scope_type', 'project',
    'process_count', v_process_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apf_import_project_baseline(
  UUID, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, JSONB, BOOLEAN
) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_apf_project_process_candidates(
  p_project_id UUID,
  p_story_text TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE(
  baseline_id UUID,
  process_ref TEXT,
  process_name TEXT,
  item_count INT,
  total_pf_bruto NUMERIC,
  items JSONB,
  match_score NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH active_baseline AS (
    SELECT b.id
    FROM public.apf_project_baselines b
    JOIN public.projects p ON p.id = b.project_id
    WHERE b.project_id = p_project_id
      AND b.scope_type = 'project'
      AND b.status = 'active'
      AND b.deleted_at IS NULL
      AND (
        auth.uid() IS NULL
        OR public.is_team_member(auth.uid(), p.team_id)
        OR public.has_role(auth.uid(), 'admin')
      )
    ORDER BY b.imported_at DESC NULLS LAST, b.created_at DESC
    LIMIT 1
  ), story AS (
    SELECT public.normalize_apf_text(p_story_text) AS normalized_story
  ), story_tokens AS (
    SELECT DISTINCT token
    FROM story,
      regexp_split_to_table(normalized_story, '\s+') AS token
    WHERE length(token) > 2
      AND token NOT IN (
        'para', 'com', 'dos', 'das', 'uma', 'por', 'que', 'sistema',
        'funcionalidade', 'processo', 'processos', 'gesp', 'gesp3'
      )
  ), process_groups AS (
    SELECT
      bi.baseline_id,
      bi.process_ref,
      min(bi.process_name) AS process_name,
      count(*)::int AS item_count,
      round(sum(bi.pf_bruto), 2) AS total_pf_bruto,
      public.normalize_apf_text(string_agg(concat_ws(
        ' ',
        bi.process_ref,
        bi.process_name,
        bi.description,
        bi.product_reference,
        bi.project_reference,
        bi.measurement_reference
      ), ' ')) AS corpus,
      jsonb_agg(jsonb_build_object(
        'id', bi.id,
        'item_ref', bi.item_ref,
        'process_ref', bi.process_ref,
        'process_name', bi.process_name,
        'description', bi.description,
        'module', bi.module,
        'function_sigla', bi.function_sigla,
        'baseline_factor_sigla', bi.factor_sigla,
        'category_sigla', bi.category_sigla,
        'complexity', bi.complexity,
        'pf_bruto', bi.pf_bruto,
        'pf_fs_baseline', bi.pf_fs,
        'is_measurable', bi.is_measurable,
        'notes', bi.notes,
        'product_reference', bi.product_reference,
        'project_reference', bi.project_reference,
        'measurement_reference', bi.measurement_reference
      ) ORDER BY bi.source_row, bi.description) AS items
    FROM public.apf_baseline_items bi
    JOIN active_baseline active ON active.id = bi.baseline_id
    GROUP BY bi.baseline_id, bi.process_ref
  ), scored AS (
    SELECT
      groups.*,
      coalesce((
        SELECT count(*)::numeric
        FROM story_tokens token
        WHERE groups.corpus LIKE '%' || token.token || '%'
      ) / nullif((SELECT count(*) FROM story_tokens), 0), 0) AS token_score,
      similarity(groups.corpus, (SELECT normalized_story FROM story)) AS trigram_score
    FROM process_groups groups
  )
  SELECT
    scored.baseline_id,
    scored.process_ref,
    scored.process_name,
    scored.item_count,
    scored.total_pf_bruto,
    scored.items,
    round(greatest(
      scored.token_score,
      scored.token_score * 0.75 + scored.trigram_score * 0.25
    )::numeric, 4) AS match_score
  FROM scored
  WHERE scored.token_score > 0 OR scored.trigram_score > 0.05
  ORDER BY match_score DESC, item_count DESC, process_ref
  LIMIT greatest(coalesce(p_limit, 10), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_apf_project_process_candidates(UUID, TEXT, INT)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_apf_project_baseline(p_baseline_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_baseline RECORD;
  v_session_count INT;
  v_mode TEXT;
BEGIN
  SELECT baseline.*, project.team_id
  INTO v_baseline
  FROM public.apf_project_baselines baseline
  JOIN public.projects project ON project.id = baseline.project_id
  WHERE baseline.id = p_baseline_id
    AND baseline.deleted_at IS NULL;

  IF v_baseline.id IS NULL THEN
    RAISE EXCEPTION 'Baseline não encontrada';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT (
       public.is_team_member(auth.uid(), v_baseline.team_id)
       OR public.has_role(auth.uid(), 'admin')
     ) THEN
    RAISE EXCEPTION 'Usuário sem permissão para excluir a baseline'
      USING ERRCODE = '42501';
  END IF;

  SELECT count(*)
  INTO v_session_count
  FROM public.apf_counting_sessions
  WHERE baseline_id = p_baseline_id;

  IF v_session_count = 0 THEN
    DELETE FROM public.apf_project_baselines
    WHERE id = p_baseline_id;
    v_mode := 'deleted';
  ELSE
    UPDATE public.apf_project_baselines
    SET status = 'archived',
        deleted_at = now(),
        deleted_by = auth.uid(),
        updated_at = now()
    WHERE id = p_baseline_id;
    v_mode := 'archived_for_audit';
  END IF;

  RETURN jsonb_build_object(
    'baseline_id', p_baseline_id,
    'mode', v_mode,
    'sessions_preserved', v_session_count,
    'was_active', v_baseline.status = 'active'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_apf_project_baseline(UUID)
  TO authenticated;
