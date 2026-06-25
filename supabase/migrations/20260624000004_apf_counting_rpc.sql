-- ============================================================
-- APF contratual baseline-first: sessão, prompt, persistência e validação.
-- ============================================================

CREATE OR REPLACE FUNCTION public.open_counting_session(
  p_project_id UUID,
  p_sprint_ref TEXT DEFAULT NULL,
  p_release_ref TEXT DEFAULT NULL,
  p_redmine_ref TEXT DEFAULT NULL,
  p_baseline_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_id UUID;
  v_team_id UUID;
  v_model_id UUID;
  v_baseline_id UUID;
  v_session_id UUID;
BEGIN
  SELECT contract_id, team_id
  INTO v_contract_id, v_team_id
  FROM public.projects
  WHERE id = p_project_id;

  IF v_contract_id IS NULL THEN
    RAISE EXCEPTION 'Projeto % não encontrado ou sem contrato vinculado', p_project_id;
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT (
       public.is_team_member(auth.uid(), v_team_id)
       OR public.has_role(auth.uid(), 'admin')
     ) THEN
    RAISE EXCEPTION 'Usuário sem acesso ao projeto' USING ERRCODE = '42501';
  END IF;

  SELECT id
  INTO v_model_id
  FROM public.apf_counting_models
  WHERE contract_id = v_contract_id
    AND is_active = true
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_model_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum modelo APF ativo no contrato';
  END IF;

  v_baseline_id := p_baseline_id;
  IF v_baseline_id IS NULL THEN
    SELECT id
    INTO v_baseline_id
    FROM public.apf_project_baselines
    WHERE project_id = p_project_id
      AND model_id = v_model_id
      AND status = 'active'
    ORDER BY imported_at DESC NULLS LAST, created_at DESC
    LIMIT 1;
  END IF;

  IF v_baseline_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma baseline APF ativa para o projeto';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.apf_project_baselines
    WHERE id = v_baseline_id
      AND project_id = p_project_id
      AND model_id = v_model_id
  ) THEN
    RAISE EXCEPTION 'Baseline não pertence ao projeto/modelo informado';
  END IF;

  SELECT id
  INTO v_session_id
  FROM public.apf_counting_sessions
  WHERE project_id = p_project_id
    AND baseline_id = v_baseline_id
    AND status = 'in_progress'
    AND coalesce(sprint_ref, '') = coalesce(p_sprint_ref, '')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    INSERT INTO public.apf_counting_sessions(
      project_id,
      model_id,
      baseline_id,
      sprint_ref,
      release_ref,
      redmine_ref,
      analyst_id,
      status
    ) VALUES (
      p_project_id,
      v_model_id,
      v_baseline_id,
      p_sprint_ref,
      p_release_ref,
      p_redmine_ref,
      auth.uid(),
      'in_progress'
    )
    RETURNING id INTO v_session_id;
  ELSE
    UPDATE public.apf_counting_sessions
    SET release_ref = coalesce(p_release_ref, release_ref),
        redmine_ref = coalesce(p_redmine_ref, redmine_ref),
        updated_at = now()
    WHERE id = v_session_id;
  END IF;

  RETURN v_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_counting_session(UUID, TEXT, TEXT, TEXT, UUID)
  TO authenticated;


CREATE OR REPLACE FUNCTION public.build_apf_prompt(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_model RECORD;
  v_baseline RECORD;
  v_rules RECORD;
  v_types JSONB;
  v_factors JSONB;
  v_system TEXT;
BEGIN
  SELECT s.*, p.team_id
  INTO v_session
  FROM public.apf_counting_sessions s
  JOIN public.projects p ON p.id = s.project_id
  WHERE s.id = p_session_id;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Sessão APF não encontrada';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT (
       public.is_team_member(auth.uid(), v_session.team_id)
       OR public.has_role(auth.uid(), 'admin')
     ) THEN
    RAISE EXCEPTION 'Usuário sem acesso à sessão' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_model
  FROM public.apf_counting_models
  WHERE id = v_session.model_id;

  SELECT *
  INTO v_baseline
  FROM public.apf_project_baselines
  WHERE id = v_session.baseline_id;

  SELECT *
  INTO v_rules
  FROM public.apf_counting_rules
  WHERE model_id = v_session.model_id
  LIMIT 1;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'sigla', sigla,
    'name', name,
    'weight', weight,
    'class', func_class
  ) ORDER BY sort_order, sigla), '[]'::jsonb)
  INTO v_types
  FROM public.apf_function_types
  WHERE model_id = v_session.model_id
    AND is_active = true;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'sigla', sigla,
    'name', name,
    'contribution_pct', contribution_pct,
    'action_on_baseline', action_on_baseline,
    'is_inm', is_inm
  ) ORDER BY sort_order, sigla), '[]'::jsonb)
  INTO v_factors
  FROM public.apf_impact_factors
  WHERE model_id = v_session.model_id
    AND is_active = true;

  v_system := concat_ws(E'\n\n',
    coalesce(v_rules.rule_mission, 'Classifique elementos funcionais conforme o modelo contratual.'),
    'PRINCÍPIO: a baseline homologada e os precedentes do contrato prevalecem sobre interpretações genéricas de IFPUG.',
    coalesce(v_rules.rule_fundamental_principle, ''),
    coalesce(v_rules.rule_decision_hierarchy, ''),
    coalesce(v_rules.rule_critical_guidelines, ''),
    coalesce(v_rules.rule_elementary_process, ''),
    coalesce(v_rules.rule_granularity, ''),
    coalesce(v_rules.rule_precedence_override, ''),
    coalesce(v_rules.rule_contractual_consistency, ''),
    coalesce(v_rules.rule_closure, ''),
    'REGRA DE CÁLCULO: não retorne PF Bruto, percentual ou PF FS. O banco obtém pesos e fatores do modelo e calcula deterministicamente.',
    'REGRA DE GRANULARIDADE: não fragmente validações, histórico, preview, mensagens, carregamentos e ações auxiliares em processos separados sem precedente explícito.',
    'FORMATO OBRIGATÓRIO: retorne somente JSON válido no formato {"items":[{"baseline_item_id":"uuid ou null","hu_ref":"HU...","ef_description":"...","function_sigla":"TRN|ARQ|N/A","factor_sigla":"I|A|E|...|N/A","match_type":"baseline_exact|baseline_similar|new_function|non_measurable","confidence":0.0,"justification":"...","evidence_literal":"..."}],"gray_zones":[]}.',
    'Para item N/A, use function_sigla=N/A, factor_sigla=N/A e match_type=non_measurable.'
  );

  RETURN jsonb_build_object(
    'system_prompt', v_system,
    'model_meta', jsonb_build_object(
      'model_id', v_model.id,
      'model_name', v_model.name,
      'standard', v_model.standard,
      'function_types', v_types,
      'impact_factors', v_factors
    ),
    'baseline_meta', jsonb_build_object(
      'baseline_id', v_baseline.id,
      'version', v_baseline.version,
      'label', v_baseline.label,
      'source_file_name', v_baseline.source_file_name
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.build_apf_prompt(UUID) TO authenticated;


CREATE OR REPLACE FUNCTION public.save_contractual_counting_items(
  p_session_id UUID,
  p_story_id UUID,
  p_items JSONB,
  p_ai_model TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_story RECORD;
  v_item JSONB;
  v_baseline_item RECORD;
  v_existing RECORD;
  v_item_id UUID;
  v_function_sigla TEXT;
  v_factor_sigla TEXT;
  v_weight NUMERIC(8,2);
  v_pct NUMERIC(6,2);
  v_pf_fs NUMERIC(8,2);
  v_normalized TEXT;
  v_hu_ref TEXT;
  v_inserted INT := 0;
  v_deduplicated INT := 0;
  v_story_pf_bruto NUMERIC(10,2) := 0;
  v_story_pf_fs NUMERIC(10,2) := 0;
  v_saved_items JSONB := '[]'::jsonb;
  v_summary JSONB;
BEGIN
  SELECT s.*, p.team_id
  INTO v_session
  FROM public.apf_counting_sessions s
  JOIN public.projects p ON p.id = s.project_id
  WHERE s.id = p_session_id;

  IF v_session.id IS NULL OR v_session.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Sessão de contagem não encontrada ou encerrada';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT (
       public.is_team_member(auth.uid(), v_session.team_id)
       OR public.has_role(auth.uid(), 'admin')
     ) THEN
    RAISE EXCEPTION 'Usuário sem acesso à sessão' USING ERRCODE = '42501';
  END IF;

  SELECT id, code, title
  INTO v_story
  FROM public.user_stories
  WHERE id = p_story_id;

  IF v_story.id IS NULL THEN
    RAISE EXCEPTION 'História de usuário não encontrada';
  END IF;

  IF jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'p_items deve ser um array JSON não vazio';
  END IF;

  DELETE FROM public.apf_counting_items
  WHERE session_id = p_session_id
    AND story_id = p_story_id
    AND cardinality(story_ids) <= 1;

  UPDATE public.apf_counting_items
  SET story_ids = array_remove(story_ids, p_story_id),
      hu_refs = array_remove(hu_refs, v_story.code),
      updated_at = now()
  WHERE session_id = p_session_id
    AND p_story_id = ANY(story_ids)
    AND cardinality(story_ids) > 1;

  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_function_sigla := upper(coalesce(nullif(v_item->>'function_sigla', ''), 'N/A'));
    v_factor_sigla := upper(coalesce(nullif(v_item->>'factor_sigla', ''), 'N/A'));
    v_hu_ref := coalesce(nullif(v_item->>'hu_ref', ''), v_story.code);
    v_normalized := public.normalize_apf_text(
      coalesce(nullif(v_item->>'ef_description', ''), v_story.title)
    );

    SELECT *
    INTO v_baseline_item
    FROM public.apf_baseline_items
    WHERE id = nullif(v_item->>'baseline_item_id', '')::uuid
      AND baseline_id = v_session.baseline_id;

    IF v_baseline_item.id IS NULL THEN
      SELECT *
      INTO v_baseline_item
      FROM public.apf_baseline_items
      WHERE baseline_id = v_session.baseline_id
        AND normalized_key = v_normalized
      LIMIT 1;
    END IF;

    IF v_baseline_item.id IS NOT NULL THEN
      v_function_sigla := coalesce(v_baseline_item.function_sigla, 'N/A');
      v_factor_sigla := coalesce(v_baseline_item.factor_sigla, 'N/A');
    END IF;

    IF v_function_sigla = 'N/A' OR v_factor_sigla = 'N/A' THEN
      v_weight := 0;
      v_pct := 0;
      v_pf_fs := 0;
    ELSE
      SELECT weight
      INTO v_weight
      FROM public.apf_function_types
      WHERE model_id = v_session.model_id
        AND sigla = v_function_sigla
        AND is_active = true;

      IF v_weight IS NULL THEN
        RAISE EXCEPTION 'Tipo funcional % não existe no modelo contratual', v_function_sigla;
      END IF;

      SELECT contribution_pct
      INTO v_pct
      FROM public.apf_impact_factors
      WHERE model_id = v_session.model_id
        AND sigla = v_factor_sigla
        AND is_active = true;

      IF v_pct IS NULL THEN
        RAISE EXCEPTION 'Fator de impacto % não existe no modelo contratual', v_factor_sigla;
      END IF;

      v_pf_fs := round(v_weight * v_pct / 100.0, 2);
    END IF;

    SELECT *
    INTO v_existing
    FROM public.apf_counting_items
    WHERE session_id = p_session_id
      AND (
        (
          v_baseline_item.id IS NOT NULL
          AND baseline_item_id = v_baseline_item.id
          AND factor_sigla = v_factor_sigla
        )
        OR (
          v_baseline_item.id IS NULL
          AND baseline_item_id IS NULL
          AND normalized_key = v_normalized
          AND function_sigla = v_function_sigla
          AND factor_sigla = v_factor_sigla
        )
      )
    LIMIT 1;

    IF v_existing.id IS NOT NULL THEN
      UPDATE public.apf_counting_items
      SET story_ids = CASE
            WHEN p_story_id = ANY(story_ids) THEN story_ids
            ELSE array_append(story_ids, p_story_id)
          END,
          hu_refs = CASE
            WHEN v_hu_ref = ANY(hu_refs) THEN hu_refs
            ELSE array_append(hu_refs, v_hu_ref)
          END,
          updated_at = now()
      WHERE id = v_existing.id;

      v_item_id := v_existing.id;
      v_deduplicated := v_deduplicated + 1;
    ELSE
      INSERT INTO public.apf_counting_items(
        session_id,
        baseline_item_id,
        story_id,
        story_ids,
        hu_ref,
        hu_refs,
        ef_description,
        function_sigla,
        factor_sigla,
        category_sigla,
        complexity,
        pf_bruto,
        contribution_pct,
        pf_fs,
        justification,
        evidence_literal,
        precedent_ref,
        match_type,
        match_confidence,
        ai_confidence_score,
        normalized_key,
        source_payload,
        sort_order
      ) VALUES (
        p_session_id,
        v_baseline_item.id,
        p_story_id,
        ARRAY[p_story_id],
        v_hu_ref,
        ARRAY[v_hu_ref],
        coalesce(
          nullif(v_item->>'ef_description', ''),
          v_baseline_item.description,
          v_story.title
        ),
        v_function_sigla,
        v_factor_sigla,
        coalesce(nullif(v_item->>'category_sigla', ''), v_baseline_item.category_sigla),
        coalesce(nullif(v_item->>'complexity', ''), v_baseline_item.complexity, 'Padrão'),
        v_weight,
        v_pct,
        v_pf_fs,
        nullif(v_item->>'justification', ''),
        nullif(v_item->>'evidence_literal', ''),
        coalesce(nullif(v_item->>'precedent_ref', ''), v_baseline_item.item_ref),
        coalesce(
          nullif(v_item->>'match_type', ''),
          CASE WHEN v_baseline_item.id IS NULL THEN 'new_function' ELSE 'baseline_similar' END
        ),
        coalesce(nullif(v_item->>'confidence', '')::numeric, 0.5),
        coalesce(nullif(v_item->>'confidence', '')::numeric, 0.5),
        v_normalized,
        coalesce(v_item, '{}'::jsonb),
        (
          SELECT coalesce(max(sort_order), -1) + 1
          FROM public.apf_counting_items
          WHERE session_id = p_session_id
        )
      )
      RETURNING id INTO v_item_id;

      v_inserted := v_inserted + 1;
    END IF;

    v_saved_items := v_saved_items || jsonb_build_array(jsonb_build_object(
      'id', v_item_id,
      'baseline_item_id', v_baseline_item.id,
      'story_id', p_story_id,
      'hu_ref', v_hu_ref,
      'ef_description', coalesce(
        nullif(v_item->>'ef_description', ''),
        v_baseline_item.description,
        v_story.title
      ),
      'function_sigla', v_function_sigla,
      'factor_sigla', v_factor_sigla,
      'pf_bruto', v_weight,
      'contribution_pct', v_pct,
      'pf_fs', v_pf_fs,
      'match_type', coalesce(nullif(v_item->>'match_type', ''), 'baseline_similar'),
      'match_confidence', coalesce(nullif(v_item->>'confidence', '')::numeric, 0.5),
      'justification', v_item->>'justification',
      'evidence_literal', v_item->>'evidence_literal',
      'is_validated', false
    ));
  END LOOP;

  SELECT
    coalesce(sum(coalesce(corrected_pf_bruto, pf_bruto)), 0),
    coalesce(sum(coalesce(corrected_pf_fs, pf_fs)), 0)
  INTO v_story_pf_bruto, v_story_pf_fs
  FROM public.apf_counting_items
  WHERE session_id = p_session_id
    AND p_story_id = ANY(story_ids);

  UPDATE public.user_stories
  SET function_points = v_story_pf_fs,
      apf_pf_bruto = v_story_pf_bruto,
      apf_pf_fs = v_story_pf_fs,
      apf_function_sigla = CASE
        WHEN jsonb_array_length(v_saved_items) = 1 THEN v_saved_items->0->>'function_sigla'
        ELSE 'MIXED'
      END,
      apf_factor_sigla = CASE
        WHEN jsonb_array_length(v_saved_items) = 1 THEN v_saved_items->0->>'factor_sigla'
        ELSE 'MIXED'
      END,
      apf_counting_session_id = p_session_id,
      ai_fp_breakdown = jsonb_build_object(
        'items', v_saved_items,
        'total_pf_bruto', v_story_pf_bruto,
        'total_pf_fs', v_story_pf_fs
      ),
      ai_fp_confidence = (
        SELECT coalesce(avg(ai_confidence_score), 0.5)
        FROM public.apf_counting_items
        WHERE session_id = p_session_id
          AND p_story_id = ANY(story_ids)
      ),
      ai_fp_validated = false
  WHERE id = p_story_id;

  UPDATE public.apf_counting_sessions s
  SET total_pf_bruto = totals.pf_bruto,
      total_pf_fs = totals.pf_fs,
      total_functions = totals.functions,
      total_hus = totals.hus,
      ai_model_used = p_ai_model,
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
    WHERE session_id = p_session_id
  ) totals
  WHERE s.id = p_session_id;

  SELECT jsonb_build_object(
    'session_id', s.id,
    'inserted_items', v_inserted,
    'deduplicated_items', v_deduplicated,
    'story_pf_bruto', round(v_story_pf_bruto, 2),
    'story_pf_fs', round(v_story_pf_fs, 2),
    'total_pf_bruto', s.total_pf_bruto,
    'total_pf_fs', s.total_pf_fs,
    'total_functions', s.total_functions,
    'total_hus', s.total_hus,
    'items', v_saved_items
  )
  INTO v_summary
  FROM public.apf_counting_sessions s
  WHERE s.id = p_session_id;

  RETURN v_summary;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_contractual_counting_items(UUID, UUID, JSONB, TEXT)
  TO authenticated;


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
  v_weight NUMERIC(8,2);
  v_pct NUMERIC(6,2);
  v_pf_fs NUMERIC(8,2);
  v_corrected BOOLEAN;
  v_story_id UUID;
BEGIN
  SELECT i.*, s.model_id, p.team_id
  INTO v_item
  FROM public.apf_counting_items i
  JOIN public.apf_counting_sessions s ON s.id = i.session_id
  JOIN public.projects p ON p.id = s.project_id
  WHERE i.id = p_item_id;

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
    OR v_pf_fs <> v_item.pf_fs;

  UPDATE public.apf_counting_items
  SET is_validated = true,
      validated_by = auth.uid(),
      validated_at = now(),
      corrected_function_sigla = CASE WHEN v_corrected THEN upper(p_function_sigla) ELSE NULL END,
      corrected_factor_sigla = CASE WHEN v_corrected THEN upper(p_factor_sigla) ELSE NULL END,
      corrected_pf_bruto = CASE WHEN v_corrected THEN v_weight ELSE NULL END,
      corrected_pf_fs = CASE WHEN v_corrected THEN v_pf_fs ELSE NULL END,
      analyst_note = concat_ws(' | ', nullif(p_reason, ''), nullif(p_notes, '')),
      updated_at = now()
  WHERE id = p_item_id;

  FOREACH v_story_id IN ARRAY v_item.story_ids
  LOOP
    UPDATE public.user_stories u
    SET function_points = totals.pf_fs,
        apf_pf_bruto = totals.pf_bruto,
        apf_pf_fs = totals.pf_fs,
        ai_fp_validated = NOT EXISTS (
          SELECT 1
          FROM public.apf_counting_items ci
          WHERE ci.session_id = v_item.session_id
            AND v_story_id = ANY(ci.story_ids)
            AND ci.is_validated = false
        )
    FROM (
      SELECT
        round(coalesce(sum(coalesce(corrected_pf_bruto, pf_bruto)), 0), 2) AS pf_bruto,
        round(coalesce(sum(coalesce(corrected_pf_fs, pf_fs)), 0), 2) AS pf_fs
      FROM public.apf_counting_items
      WHERE session_id = v_item.session_id
        AND v_story_id = ANY(story_ids)
    ) totals
    WHERE u.id = v_story_id;
  END LOOP;

  UPDATE public.apf_counting_sessions s
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
  WHERE s.id = v_item.session_id;

  RETURN jsonb_build_object(
    'item_id', p_item_id,
    'was_corrected', v_corrected,
    'function_sigla', upper(p_function_sigla),
    'factor_sigla', upper(p_factor_sigla),
    'pf_bruto', v_weight,
    'contribution_pct', v_pct,
    'pf_fs', v_pf_fs
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_apf_counting_item(UUID, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;
