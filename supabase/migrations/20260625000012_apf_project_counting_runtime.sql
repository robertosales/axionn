-- ============================================================
-- APF — pesos da baseline de projeto e recálculo auditável de HU.
-- ============================================================

CREATE OR REPLACE FUNCTION public.resolve_apf_item_weight(
  p_model_id UUID,
  p_baseline_item_id UUID,
  p_function_sigla TEXT,
  p_complexity TEXT DEFAULT NULL
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT item.pf_bruto
     FROM public.apf_baseline_items item
     WHERE item.id = p_baseline_item_id),
    (SELECT weight.weight
     FROM public.apf_function_type_weights weight
     WHERE weight.model_id = p_model_id
       AND weight.function_sigla = upper(p_function_sigla)
       AND public.normalize_apf_text(weight.complexity)
         = public.normalize_apf_text(coalesce(p_complexity, 'Padrão'))
     LIMIT 1),
    (SELECT type.weight
     FROM public.apf_function_types type
     WHERE type.model_id = p_model_id
       AND type.sigla = upper(p_function_sigla)
       AND type.is_active = true
     LIMIT 1)
  );
$$;

DO $$
DECLARE
  v_definition TEXT;
  v_original TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'public.save_contractual_counting_items(uuid,uuid,jsonb,text)'::regprocedure
  ) INTO v_definition;
  v_original := v_definition;

  v_definition := replace(
    v_definition,
    E'IF v_baseline_item.id IS NOT NULL THEN\n      v_function_sigla := coalesce(v_baseline_item.function_sigla, ''N/A'');\n      v_factor_sigla := coalesce(v_baseline_item.factor_sigla, ''N/A'');\n    END IF;',
    E'IF v_baseline_item.id IS NOT NULL THEN\n      v_function_sigla := coalesce(v_baseline_item.function_sigla, ''N/A'');\n      IF v_factor_sigla = ''N/A'' THEN\n        v_factor_sigla := coalesce(v_baseline_item.factor_sigla, ''N/A'');\n      END IF;\n    END IF;'
  );

  v_definition := replace(
    v_definition,
    E'SELECT func_class::text, weight\n      INTO v_function_class, v_weight\n      FROM public.apf_function_types\n      WHERE model_id = v_session.model_id\n        AND sigla = v_function_sigla\n        AND is_active = true;',
    E'SELECT type.func_class::text, public.resolve_apf_item_weight(\n        v_session.model_id,\n        v_baseline_item.id,\n        v_function_sigla,\n        coalesce(v_baseline_item.complexity, v_item->>''complexity'')\n      )\n      INTO v_function_class, v_weight\n      FROM public.apf_function_types type\n      WHERE type.model_id = v_session.model_id\n        AND type.sigla = v_function_sigla\n        AND type.is_active = true;'
  );

  IF v_definition = v_original THEN
    RAISE EXCEPTION 'Não foi possível atualizar save_contractual_counting_items';
  END IF;
  EXECUTE v_definition;
END $$;

DO $$
DECLARE
  v_definition TEXT;
  v_original TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'public.validate_apf_counting_item(uuid,text,text,text,text)'::regprocedure
  ) INTO v_definition;
  v_original := v_definition;

  v_definition := replace(
    v_definition,
    E'SELECT weight\n    INTO v_weight\n    FROM public.apf_function_types\n    WHERE model_id = v_item.model_id\n      AND sigla = upper(p_function_sigla)\n      AND is_active = true;',
    E'SELECT public.resolve_apf_item_weight(\n      v_item.model_id,\n      v_item.baseline_item_id,\n      upper(p_function_sigla),\n      v_item.complexity\n    ) INTO v_weight;'
  );

  IF v_definition = v_original THEN
    RAISE EXCEPTION 'Não foi possível atualizar validate_apf_counting_item';
  END IF;
  EXECUTE v_definition;
END $$;

DO $$
DECLARE
  v_definition TEXT;
  v_original TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'public.resolve_apf_elementary_process_item(uuid,text,boolean,boolean,text,text)'::regprocedure
  ) INTO v_definition;
  v_original := v_definition;

  v_definition := replace(
    v_definition,
    E'SELECT type.weight, factor.contribution_pct\n    INTO v_weight, v_pct\n    FROM public.apf_function_types type\n    CROSS JOIN public.apf_impact_factors factor',
    E'SELECT public.resolve_apf_item_weight(\n      v_item.model_id,\n      v_item.baseline_item_id,\n      v_item.function_sigla,\n      v_item.complexity\n    ), factor.contribution_pct\n    INTO v_weight, v_pct\n    FROM public.apf_function_types type\n    CROSS JOIN public.apf_impact_factors factor'
  );

  IF v_definition = v_original THEN
    RAISE EXCEPTION 'Não foi possível atualizar resolve_apf_elementary_process_item';
  END IF;
  EXECUTE v_definition;
END $$;

CREATE TABLE IF NOT EXISTS public.apf_recalculation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.apf_counting_sessions(id) ON DELETE SET NULL,
  story_id UUID NOT NULL REFERENCES public.user_stories(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  baseline_id UUID REFERENCES public.apf_project_baselines(id) ON DELETE SET NULL,
  previous_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason TEXT,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apf_recalculation_story
  ON public.apf_recalculation_events(story_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.reset_apf_story_counting(
  p_session_id UUID,
  p_story_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_story RECORD;
  v_snapshot JSONB;
  v_removed INT;
BEGIN
  SELECT session.*, project.team_id
  INTO v_session
  FROM public.apf_counting_sessions session
  JOIN public.projects project ON project.id = session.project_id
  WHERE session.id = p_session_id;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Sessão de contagem não encontrada';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT (
       public.is_team_member(auth.uid(), v_session.team_id)
       OR public.has_role(auth.uid(), 'admin')
     ) THEN
    RAISE EXCEPTION 'Usuário sem acesso à sessão' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_story
  FROM public.user_stories
  WHERE id = p_story_id;

  IF v_story.id IS NULL THEN
    RAISE EXCEPTION 'História de usuário não encontrada';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(item) ORDER BY item.sort_order), '[]'::jsonb)
  INTO v_snapshot
  FROM public.apf_counting_items item
  WHERE item.session_id = p_session_id
    AND p_story_id = ANY(item.story_ids);

  INSERT INTO public.apf_recalculation_events(
    session_id, story_id, project_id, baseline_id, previous_snapshot, reason
  ) VALUES (
    p_session_id,
    p_story_id,
    v_session.project_id,
    v_session.baseline_id,
    v_snapshot,
    nullif(trim(coalesce(p_reason, '')), '')
  );

  DELETE FROM public.apf_counting_items
  WHERE session_id = p_session_id
    AND p_story_id = ANY(story_ids)
    AND cardinality(story_ids) <= 1;
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  UPDATE public.apf_counting_items
  SET story_ids = array_remove(story_ids, p_story_id),
      hu_refs = array_remove(hu_refs, v_story.code),
      updated_at = now()
  WHERE session_id = p_session_id
    AND p_story_id = ANY(story_ids)
    AND cardinality(story_ids) > 1;

  DELETE FROM public.apf_elementary_processes process
  WHERE process.session_id = p_session_id
    AND NOT EXISTS (
      SELECT 1 FROM public.apf_counting_items item
      WHERE item.elementary_process_id = process.id
    );

  UPDATE public.user_stories
  SET function_points = NULL,
      apf_pf_bruto = NULL,
      apf_pf_fs = NULL,
      apf_function_sigla = NULL,
      apf_factor_sigla = NULL,
      apf_counting_session_id = NULL,
      ai_fp_breakdown = NULL,
      ai_fp_confidence = NULL,
      ai_fp_validated = false
  WHERE id = p_story_id;

  PERFORM public.recalculate_apf_session_totals(p_session_id);

  RETURN jsonb_build_object(
    'session_id', p_session_id,
    'story_id', p_story_id,
    'removed_items', v_removed,
    'previous_items', jsonb_array_length(v_snapshot)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_apf_story_counting(UUID, UUID, TEXT)
  TO authenticated;
