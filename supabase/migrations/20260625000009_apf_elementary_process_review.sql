-- ============================================================
-- APF contratual — revisão humana de processo elementar.
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_apf_session_totals(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_story_id UUID;
BEGIN
  FOR v_story_id IN
    SELECT DISTINCT refs.story_id
    FROM public.apf_counting_items item
    CROSS JOIN LATERAL unnest(item.story_ids) AS refs(story_id)
    WHERE item.session_id = p_session_id
  LOOP
    UPDATE public.user_stories story
    SET function_points = totals.pf_fs,
        apf_pf_bruto = totals.pf_bruto,
        apf_pf_fs = totals.pf_fs
    FROM (
      SELECT
        round(coalesce(sum(coalesce(corrected_pf_bruto, pf_bruto)), 0), 2) AS pf_bruto,
        round(coalesce(sum(coalesce(corrected_pf_fs, pf_fs)), 0), 2) AS pf_fs
      FROM public.apf_counting_items
      WHERE session_id = p_session_id
        AND v_story_id = ANY(story_ids)
        AND counting_decision = 'counted'
    ) totals
    WHERE story.id = v_story_id;
  END LOOP;

  UPDATE public.apf_counting_sessions session
  SET total_pf_bruto = totals.pf_bruto,
      total_pf_fs = totals.pf_fs,
      total_functions = totals.functions,
      total_hus = totals.hus,
      updated_at = now()
  FROM (
    SELECT
      round(coalesce(sum(coalesce(corrected_pf_bruto, item.pf_bruto)), 0), 2) AS pf_bruto,
      round(coalesce(sum(coalesce(corrected_pf_fs, item.pf_fs)), 0), 2) AS pf_fs,
      count(*)::int AS functions,
      (
        SELECT count(DISTINCT refs.story_id)::int
        FROM public.apf_counting_items item2
        CROSS JOIN LATERAL unnest(item2.story_ids) AS refs(story_id)
        WHERE item2.session_id = p_session_id
      ) AS hus
    FROM public.apf_counting_items item
    WHERE item.session_id = p_session_id
      AND item.counting_decision = 'counted'
  ) totals
  WHERE session.id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_apf_elementary_process_item(
  p_item_id UUID,
  p_process_role TEXT,
  p_is_complete BOOLEAN,
  p_is_independent BOOLEAN,
  p_precedent_ref TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_role TEXT;
  v_decision TEXT;
  v_weight NUMERIC(8,2) := 0;
  v_pct NUMERIC(6,2) := 0;
  v_pf_fs NUMERIC(8,2) := 0;
  v_absorbing_id UUID;
  v_duplicate_id UUID;
BEGIN
  SELECT item.*, session.model_id, project.team_id
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

  v_role := lower(coalesce(nullif(trim(p_process_role), ''), v_item.process_role, 'central'));
  IF v_role NOT IN ('central', 'independent', 'auxiliary') THEN
    RAISE EXCEPTION 'Papel de processo elementar inválido: %', v_role;
  END IF;

  IF v_item.function_sigla = 'N/A' OR v_item.factor_sigla = 'N/A' THEN
    v_decision := 'not_countable';
  ELSIF v_role = 'auxiliary' THEN
    v_decision := 'absorbed';
  ELSIF NOT coalesce(p_is_complete, false)
        OR NOT coalesce(p_is_independent, false) THEN
    v_decision := 'review_required';
  ELSIF public.is_apf_auxiliary_action(v_item.elementary_process_name)
        AND v_item.baseline_item_id IS NULL
        AND nullif(trim(coalesce(p_precedent_ref, '')), '') IS NULL THEN
    RAISE EXCEPTION
      'Ação auxiliar ou consulta só pode ser separada com precedente oficial da baseline/equipe';
  ELSE
    v_decision := 'counted';
  END IF;

  IF v_decision = 'counted' THEN
    SELECT type.weight, factor.contribution_pct
    INTO v_weight, v_pct
    FROM public.apf_function_types type
    CROSS JOIN public.apf_impact_factors factor
    WHERE type.model_id = v_item.model_id
      AND type.sigla = v_item.function_sigla
      AND type.is_active = true
      AND factor.model_id = v_item.model_id
      AND factor.sigla = v_item.factor_sigla
      AND factor.is_active = true;

    IF v_weight IS NULL OR v_pct IS NULL THEN
      RAISE EXCEPTION 'Tipo ou fator inválido para o modelo contratual';
    END IF;

    v_pf_fs := round(v_weight * v_pct / 100.0, 2);

    IF EXISTS (
      SELECT 1
      FROM public.apf_function_types type
      WHERE type.model_id = v_item.model_id
        AND type.sigla = v_item.function_sigla
        AND type.func_class = 'transactional'
    ) THEN
      SELECT item.id
      INTO v_duplicate_id
      FROM public.apf_counting_items item
      WHERE item.session_id = v_item.session_id
        AND item.id <> p_item_id
        AND item.elementary_process_key = v_item.elementary_process_key
        AND item.factor_sigla = v_item.factor_sigla
        AND item.counting_decision = 'counted'
      ORDER BY item.created_at
      LIMIT 1;

      IF v_duplicate_id IS NOT NULL THEN
        v_decision := 'absorbed';
        v_absorbing_id := v_duplicate_id;
        v_weight := 0;
        v_pct := 0;
        v_pf_fs := 0;
      END IF;
    END IF;
  ELSIF v_decision = 'absorbed' THEN
    SELECT item.id
    INTO v_absorbing_id
    FROM public.apf_counting_items item
    WHERE item.session_id = v_item.session_id
      AND item.id <> p_item_id
      AND item.elementary_process_key = v_item.elementary_process_key
      AND item.counting_decision = 'counted'
    ORDER BY item.created_at
    LIMIT 1;
  END IF;

  UPDATE public.apf_counting_items
  SET process_role = v_role,
      process_is_complete = coalesce(p_is_complete, false),
      process_is_independent = coalesce(p_is_independent, false),
      separation_precedent_ref = nullif(trim(coalesce(p_precedent_ref, '')), ''),
      process_reasoning = coalesce(nullif(trim(coalesce(p_reason, '')), ''), process_reasoning),
      counting_decision = v_decision,
      absorbed_by_item_id = v_absorbing_id,
      pf_bruto = v_weight,
      contribution_pct = v_pct,
      pf_fs = v_pf_fs,
      corrected_pf_bruto = NULL,
      corrected_pf_fs = NULL,
      updated_at = now()
  WHERE id = p_item_id;

  UPDATE public.apf_elementary_processes
  SET process_role = v_role,
      is_complete = coalesce(p_is_complete, false),
      is_independent = coalesce(p_is_independent, false),
      precedent_ref = nullif(trim(coalesce(p_precedent_ref, '')), ''),
      decision = v_decision,
      decision_reason = coalesce(nullif(trim(coalesce(p_reason, '')), ''), decision_reason),
      validated_by = auth.uid(),
      validated_at = now(),
      updated_at = now()
  WHERE id = v_item.elementary_process_id;

  PERFORM public.recalculate_apf_session_totals(v_item.session_id);

  RETURN jsonb_build_object(
    'item_id', p_item_id,
    'elementary_process_id', v_item.elementary_process_id,
    'process_role', v_role,
    'process_is_complete', coalesce(p_is_complete, false),
    'process_is_independent', coalesce(p_is_independent, false),
    'separation_precedent_ref', nullif(trim(coalesce(p_precedent_ref, '')), ''),
    'counting_decision', v_decision,
    'absorbed_by_item_id', v_absorbing_id,
    'pf_bruto', v_weight,
    'contribution_pct', v_pct,
    'pf_fs', v_pf_fs
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_apf_elementary_process_item(
  UUID, TEXT, BOOLEAN, BOOLEAN, TEXT, TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_apf_block_unresolved_process_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_validated = true
     AND NEW.counting_decision = 'review_required' THEN
    RAISE EXCEPTION
      'O processo elementar precisa ser resolvido antes da validação da contagem';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apf_block_unresolved_process_validation
  ON public.apf_counting_items;
CREATE TRIGGER trg_apf_block_unresolved_process_validation
  BEFORE UPDATE OF is_validated, counting_decision
  ON public.apf_counting_items
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_apf_block_unresolved_process_validation();
