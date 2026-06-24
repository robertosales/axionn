-- ============================================================
-- APF contratual: validação humana e evento de aprendizado atômicos.
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_apf_counting_item(
  p_item_id UUID,
  p_function_sigla TEXT,
  p_factor_sigla TEXT,
  p_reason TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_story RECORD;
  v_weight NUMERIC(8,2);
  v_pct NUMERIC(6,2);
  v_pf_fs NUMERIC(8,2);
  v_corrected BOOLEAN;
  v_story_id UUID;
  v_event_id UUID;
BEGIN
  SELECT
    item.*,
    session.model_id,
    session.project_id,
    project.team_id
  INTO v_item
  FROM public.apf_counting_items item
  JOIN public.apf_counting_sessions session ON session.id = item.session_id
  JOIN public.projects project ON project.id = session.project_id
  WHERE item.id = p_item_id;

  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'Item de contagem não encontrado';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT (
       public.is_team_member(auth.uid(), v_item.team_id)
       OR public.has_role(auth.uid(), 'admin')
     ) THEN
    RAISE EXCEPTION 'Usuário sem acesso ao item' USING ERRCODE = '42501';
  END IF;

  IF upper(p_function_sigla) = 'N/A' OR upper(p_factor_sigla) = 'N/A' THEN
    v_weight := 0;
    v_pct := 0;
    v_pf_fs := 0;
  ELSE
    SELECT weight
    INTO v_weight
    FROM public.apf_function_types
    WHERE model_id = v_item.model_id
      AND sigla = upper(p_function_sigla)
      AND is_active = true;

    SELECT contribution_pct
    INTO v_pct
    FROM public.apf_impact_factors
    WHERE model_id = v_item.model_id
      AND sigla = upper(p_factor_sigla)
      AND is_active = true;

    IF v_weight IS NULL OR v_pct IS NULL THEN
      RAISE EXCEPTION 'Tipo ou fator inválido para o modelo';
    END IF;

    v_pf_fs := round(v_weight * v_pct / 100.0, 2);
  END IF;

  v_corrected := upper(p_function_sigla) <> v_item.function_sigla
    OR upper(p_factor_sigla) <> v_item.factor_sigla
    OR v_weight <> v_item.pf_bruto
    OR v_pf_fs <> v_item.pf_fs;

  IF v_corrected AND nullif(trim(coalesce(p_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'O motivo da correção é obrigatório';
  END IF;

  IF p_reason IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_enum enum_value
       JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
       WHERE enum_type.typname = 'apf_correction_reason'
         AND enum_value.enumlabel = p_reason
     ) THEN
    RAISE EXCEPTION 'Motivo de correção inválido: %', p_reason;
  END IF;

  UPDATE public.apf_counting_items
  SET is_validated = true,
      validated_by = auth.uid(),
      validated_at = now(),
      corrected_function_sigla = CASE
        WHEN v_corrected THEN upper(p_function_sigla)
        ELSE NULL
      END,
      corrected_factor_sigla = CASE
        WHEN v_corrected THEN upper(p_factor_sigla)
        ELSE NULL
      END,
      corrected_pf_bruto = CASE WHEN v_corrected THEN v_weight ELSE NULL END,
      corrected_pf_fs = CASE WHEN v_corrected THEN v_pf_fs ELSE NULL END,
      analyst_note = concat_ws(
        ' | ',
        nullif(trim(coalesce(p_reason, '')), ''),
        nullif(trim(coalesce(p_notes, '')), '')
      ),
      updated_at = now()
  WHERE id = p_item_id;

  SELECT story.id, story.code, story.title, story.description, story.acceptance_criteria
  INTO v_story
  FROM public.user_stories story
  WHERE story.id = coalesce(v_item.story_id, v_item.story_ids[1]);

  INSERT INTO public.apf_validation_events(
    counting_item_id,
    session_id,
    project_id,
    team_id,
    baseline_item_id,
    hu_text,
    hu_title,
    ai_functional_type,
    ai_factor_sigla,
    ai_complexity,
    ai_pf_bruto,
    ai_pf_bruto_exact,
    ai_pf_fs,
    ai_confidence_score,
    ai_reasoning,
    rag_was_used,
    rag_case_count,
    validated_functional_type,
    validated_factor_sigla,
    validated_complexity,
    validated_pf_bruto,
    validated_pf_bruto_exact,
    validated_pf_fs,
    was_corrected_contractual,
    correction_reason_code,
    correction_notes,
    corrected_by
  ) VALUES (
    p_item_id,
    v_item.session_id,
    v_item.project_id,
    v_item.team_id,
    v_item.baseline_item_id,
    concat_ws(
      E'\n\n',
      coalesce(v_story.code, v_item.hu_ref),
      coalesce(v_story.title, v_item.ef_description),
      nullif(v_story.description, ''),
      nullif(v_story.acceptance_criteria, '')
    ),
    coalesce(v_story.title, v_item.ef_description),
    v_item.function_sigla,
    v_item.factor_sigla,
    coalesce(v_item.complexity, 'Padrão'),
    round(v_item.pf_bruto)::int,
    v_item.pf_bruto,
    v_item.pf_fs,
    v_item.ai_confidence_score,
    v_item.justification,
    v_item.precedent_ref IS NOT NULL,
    CASE WHEN v_item.precedent_ref IS NULL THEN 0 ELSE 1 END,
    upper(p_function_sigla),
    upper(p_factor_sigla),
    coalesce(v_item.complexity, 'Padrão'),
    round(v_weight)::int,
    v_weight,
    v_pf_fs,
    v_corrected,
    CASE
      WHEN v_corrected THEN p_reason::public.apf_correction_reason
      ELSE NULL
    END,
    CASE WHEN v_corrected THEN nullif(trim(coalesce(p_notes, '')), '') ELSE NULL END,
    CASE WHEN v_corrected THEN auth.uid() ELSE NULL END
  )
  RETURNING id INTO v_event_id;

  FOREACH v_story_id IN ARRAY v_item.story_ids
  LOOP
    UPDATE public.user_stories user_story
    SET function_points = totals.pf_fs,
        apf_pf_bruto = totals.pf_bruto,
        apf_pf_fs = totals.pf_fs,
        ai_fp_validated = NOT EXISTS (
          SELECT 1
          FROM public.apf_counting_items pending
          WHERE pending.session_id = v_item.session_id
            AND v_story_id = ANY(pending.story_ids)
            AND pending.is_validated = false
        )
    FROM (
      SELECT
        round(coalesce(sum(coalesce(corrected_pf_bruto, pf_bruto)), 0), 2) AS pf_bruto,
        round(coalesce(sum(coalesce(corrected_pf_fs, pf_fs)), 0), 2) AS pf_fs
      FROM public.apf_counting_items
      WHERE session_id = v_item.session_id
        AND v_story_id = ANY(story_ids)
    ) totals
    WHERE user_story.id = v_story_id;
  END LOOP;

  UPDATE public.apf_counting_sessions session
  SET total_pf_bruto = totals.pf_bruto,
      total_pf_fs = totals.pf_fs,
      total_functions = totals.functions,
      total_hus = totals.hus,
      updated_at = now()
  FROM (
    SELECT
      round(coalesce(sum(coalesce(corrected_pf_bruto, pf_bruto)), 0), 2) AS pf_bruto,
      round(coalesce(sum(coalesce(corrected_pf_fs, pf_fs)), 0), 2) AS pf_fs,
      count(*) FILTER (
        WHERE coalesce(corrected_pf_fs, pf_fs) > 0
      )::int AS functions,
      coalesce(sum(cardinality(story_ids)), 0)::int AS hus
    FROM public.apf_counting_items
    WHERE session_id = v_item.session_id
  ) totals
  WHERE session.id = v_item.session_id;

  RETURN jsonb_build_object(
    'item_id', p_item_id,
    'event_id', v_event_id,
    'was_corrected', v_corrected,
    'function_sigla', upper(p_function_sigla),
    'factor_sigla', upper(p_factor_sigla),
    'pf_bruto', v_weight,
    'contribution_pct', v_pct,
    'pf_fs', v_pf_fs
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_apf_counting_item(
  UUID, TEXT, TEXT, TEXT, TEXT
) TO authenticated;
