-- ============================================================
-- APF/PFS — particularidade contratual da fábrica de software.
--
-- Regra oficial confirmada pela área de métricas:
--   * a medição contratual é em PF Simples;
--   * todo processo elementar transacional é classificado como TRN;
--   * cada TRN possui PF Bruto contratual fixo de 4,60;
--   * o fator de impacto é aplicado sobre 4,60.
--
-- As classificações EE/CE/SE eventualmente presentes na planilha ficam
-- preservadas na baseline como metadado de origem, mas não determinam
-- tipo nem peso na contagem contratual.
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_apf_contractual_function_sigla(
  p_sigla TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN upper(coalesce(nullif(trim(p_sigla), ''), 'N/A')) IN ('EE', 'CE', 'SE', 'TRN')
      THEN 'TRN'
    ELSE upper(coalesce(nullif(trim(p_sigla), ''), 'N/A'))
  END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_apf_pfs_contractual_catalog()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_standard TEXT;
BEGIN
  SELECT model.standard::text
  INTO v_standard
  FROM public.apf_counting_models model
  WHERE model.id = NEW.model_id;

  IF v_standard = 'pfs_dpf' THEN
    INSERT INTO public.apf_function_types(
      model_id, sigla, name, func_class, weight, is_active, sort_order
    ) VALUES (
      NEW.model_id,
      'TRN',
      'Transação contratual PFS',
      'transactional',
      4.60,
      true,
      1
    )
    ON CONFLICT (model_id, sigla) DO UPDATE SET
      name = excluded.name,
      func_class = excluded.func_class,
      weight = 4.60,
      is_active = true,
      sort_order = 1;

    UPDATE public.apf_function_types
    SET is_active = false,
        updated_at = now()
    WHERE model_id = NEW.model_id
      AND sigla IN ('EE', 'CE', 'SE');

    INSERT INTO public.apf_function_type_weights(
      model_id, function_sigla, complexity, weight
    ) VALUES (
      NEW.model_id, 'TRN', 'Padrão', 4.60
    )
    ON CONFLICT (model_id, function_sigla, complexity) DO UPDATE SET
      weight = 4.60,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_apf_pfs_contractual_catalog
  ON public.apf_project_baselines;
CREATE TRIGGER trg_enforce_apf_pfs_contractual_catalog
AFTER INSERT OR UPDATE OF model_id
ON public.apf_project_baselines
FOR EACH ROW
EXECUTE FUNCTION public.enforce_apf_pfs_contractual_catalog();

-- Corrige os modelos contratuais já existentes.
INSERT INTO public.apf_function_types(
  model_id, sigla, name, func_class, weight, is_active, sort_order
)
SELECT
  model.id,
  'TRN',
  'Transação contratual PFS',
  'transactional',
  4.60,
  true,
  1
FROM public.apf_counting_models model
WHERE model.standard = 'pfs_dpf'
ON CONFLICT (model_id, sigla) DO UPDATE SET
  name = excluded.name,
  func_class = excluded.func_class,
  weight = 4.60,
  is_active = true,
  sort_order = 1;

UPDATE public.apf_function_types type
SET is_active = false,
    updated_at = now()
FROM public.apf_counting_models model
WHERE model.id = type.model_id
  AND model.standard = 'pfs_dpf'
  AND type.sigla IN ('EE', 'CE', 'SE');

INSERT INTO public.apf_function_type_weights(
  model_id, function_sigla, complexity, weight
)
SELECT model.id, 'TRN', 'Padrão', 4.60
FROM public.apf_counting_models model
WHERE model.standard = 'pfs_dpf'
ON CONFLICT (model_id, function_sigla, complexity) DO UPDATE SET
  weight = 4.60,
  updated_at = now();

-- A baseline continua sendo a fonte da identidade funcional. O peso da
-- linha EE/CE/SE deixa de prevalecer quando o modelo é PFS contratual.
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
  WITH context AS (
    SELECT
      model.standard::text AS standard,
      public.normalize_apf_contractual_function_sigla(
        coalesce(item.function_sigla, p_function_sigla)
      ) AS contractual_sigla
    FROM public.apf_counting_models model
    LEFT JOIN public.apf_baseline_items item
      ON item.id = p_baseline_item_id
    WHERE model.id = p_model_id
  )
  SELECT CASE
    WHEN context.standard = 'pfs_dpf'
      AND context.contractual_sigla = 'TRN'
      THEN 4.60::numeric
    ELSE coalesce(
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
    )
  END
  FROM context;
$$;

-- Faz o motor persistir TRN mesmo quando o item-fonte da baseline possui
-- classificação IFPUG EE/CE/SE.
DO $$
DECLARE
  v_definition TEXT;
  v_original TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'public.save_contractual_counting_items(uuid,uuid,jsonb,text)'::regprocedure
  ) INTO v_definition;
  v_original := v_definition;

  IF position('normalize_apf_contractual_function_sigla' IN v_definition) = 0 THEN
    v_definition := replace(
      v_definition,
      E'v_function_sigla := upper(coalesce(nullif(v_item->>''function_sigla'', ''''), ''N/A''));',
      E'v_function_sigla := public.normalize_apf_contractual_function_sigla(\n      coalesce(nullif(v_item->>''function_sigla'', ''''), ''N/A'')\n    );'
    );

    v_definition := replace(
      v_definition,
      E'v_function_sigla := coalesce(v_baseline_item.function_sigla, ''N/A'');',
      E'v_function_sigla := public.normalize_apf_contractual_function_sigla(\n        coalesce(v_baseline_item.function_sigla, ''N/A'')\n      );'
    );
  END IF;

  IF v_definition <> v_original THEN
    EXECUTE v_definition;
  ELSIF position('normalize_apf_contractual_function_sigla' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Não foi possível aplicar a normalização TRN em save_contractual_counting_items';
  END IF;
END $$;

-- O catálogo de candidatos continua usando a identidade e o texto da
-- baseline, mas publica o tipo e o peso contratuais para a análise.
CREATE OR REPLACE FUNCTION public.get_apf_project_process_candidates(
  p_project_id UUID,
  p_story_text TEXT,
  p_limit INT DEFAULT 6
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
  WITH candidates AS (
    SELECT *
    FROM public.get_apf_project_process_candidates_unfiltered(
      p_project_id,
      p_story_text,
      least(greatest(coalesce(p_limit, 6) * 3, 12), 24)
    )
  ), transactional AS (
    SELECT
      candidate.baseline_id,
      candidate.process_ref,
      candidate.process_name,
      candidate.match_score,
      jsonb_set(
        jsonb_set(
          jsonb_set(
            item.value,
            '{function_sigla}',
            to_jsonb('TRN'::text),
            true
          ),
          '{complexity}',
          to_jsonb('Padrão'::text),
          true
        ),
        '{pf_bruto}',
        to_jsonb(4.60::numeric),
        true
      ) AS item
    FROM candidates candidate
    CROSS JOIN LATERAL jsonb_array_elements(candidate.items) item
    WHERE item.value->>'function_sigla' IN ('EE', 'CE', 'SE', 'TRN')
      AND coalesce((item.value->>'is_measurable')::boolean, false) = true
  )
  SELECT
    transactional.baseline_id,
    transactional.process_ref,
    min(transactional.process_name) AS process_name,
    count(*)::int AS item_count,
    round(count(*)::numeric * 4.60, 2) AS total_pf_bruto,
    jsonb_agg(
      transactional.item
      ORDER BY coalesce((transactional.item->>'match_score')::numeric, 0) DESC,
        transactional.item->>'description'
    ) AS items,
    max(transactional.match_score) AS match_score
  FROM transactional
  GROUP BY transactional.baseline_id, transactional.process_ref
  ORDER BY match_score DESC, item_count ASC, process_ref
  LIMIT least(greatest(coalesce(p_limit, 6), 1), 12);
$$;

GRANT EXECUTE ON FUNCTION public.get_apf_project_process_candidates(UUID, TEXT, INT)
  TO authenticated, service_role;

-- A análise persiste somente o tipo contratual TRN. ALI/AIE continuam
-- permitidos exclusivamente na tabela de arquivos lógicos referenciados.
CREATE OR REPLACE FUNCTION public.normalize_apf_analysis_candidate_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.candidate_function_type := CASE
    WHEN upper(coalesce(NEW.candidate_function_type, '')) IN ('EE', 'CE', 'SE', 'TRN')
      THEN 'TRN'
    ELSE 'indefinido'
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_apf_analysis_analog_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.function_type := CASE
    WHEN upper(coalesce(NEW.function_type, '')) IN ('EE', 'CE', 'SE', 'TRN')
      THEN 'TRN'
    WHEN upper(coalesce(NEW.function_type, '')) IN ('ALI', 'AIE')
      THEN upper(NEW.function_type)
    ELSE 'indefinido'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_apf_analysis_analog_type
  ON public.apf_process_analysis_analogs;
CREATE TRIGGER trg_normalize_apf_analysis_analog_type
BEFORE INSERT OR UPDATE OF function_type
ON public.apf_process_analysis_analogs
FOR EACH ROW
EXECUTE FUNCTION public.normalize_apf_analysis_analog_type();

UPDATE public.apf_process_analysis_items
SET candidate_function_type = 'TRN',
    updated_at = now()
WHERE candidate_function_type IN ('EE', 'CE', 'SE');

UPDATE public.apf_process_analysis_analogs
SET function_type = 'TRN'
WHERE function_type IN ('EE', 'CE', 'SE');

-- Materialização: usa a linha da baseline para identidade e precedente,
-- mas envia TRN/4,60 ao contador contratual.
CREATE OR REPLACE FUNCTION public.materialize_apf_process_analysis(
  p_analysis_id UUID,
  p_session_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run RECORD;
  v_session RECORD;
  v_story RECORD;
  v_items JSONB;
  v_result JSONB;
BEGIN
  SELECT run.*, project.team_id
  INTO v_run
  FROM public.apf_process_analysis_runs run
  JOIN public.projects project ON project.id = run.project_id
  WHERE run.id = p_analysis_id;

  IF v_run.id IS NULL THEN RAISE EXCEPTION 'Análise de processos não encontrada'; END IF;
  IF auth.uid() IS NOT NULL
     AND NOT (
       public.is_team_member(auth.uid(), v_run.team_id)
       OR public.has_role(auth.uid(), 'admin')
     ) THEN
    RAISE EXCEPTION 'Usuário sem acesso à análise' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session
  FROM public.apf_counting_sessions
  WHERE id = p_session_id;

  IF v_session.id IS NULL
     OR v_session.project_id <> v_run.project_id
     OR v_session.baseline_id <> v_run.baseline_id THEN
    RAISE EXCEPTION 'Sessão incompatível com a análise e a baseline';
  END IF;

  IF v_run.status NOT IN ('ok', 'review_required', 'counted') THEN
    RAISE EXCEPTION 'A análise não está pronta para materialização: %', v_run.status;
  END IF;

  SELECT * INTO v_story
  FROM public.user_stories
  WHERE id = v_run.story_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'baseline_item_id', process.selected_baseline_item_id,
    'hu_ref', v_story.code,
    'ef_description', process.process_name,
    'function_sigla', 'TRN',
    'factor_sigla', v_run.inferred_factor_sigla,
    'match_type', 'structured_process_analysis',
    'confidence', coalesce(process.confidence, 0.5),
    'justification', process.separation_reason,
    'evidence_literal', concat_ws(E'\n\n', v_story.title, v_story.description, v_story.acceptance_criteria),
    'category_sigla', baseline.category_sigla,
    'complexity', 'Padrão',
    'elementary_process_key', public.normalize_apf_process_key(
      concat('baseline ', baseline.item_ref, ' ', baseline.description)
    ),
    'elementary_process_name', process.process_name,
    'process_objective', process.functional_result,
    'process_role', CASE WHEN process.is_central THEN 'central' ELSE 'independent' END,
    'process_is_complete', process.is_complete,
    'process_is_independent', process.is_independent,
    'process_reasoning', process.separation_reason,
    'separation_precedent_ref', baseline.item_ref
  ) ORDER BY process.sort_order), '[]'::jsonb)
  INTO v_items
  FROM public.apf_process_analysis_items process
  JOIN public.apf_baseline_items baseline
    ON baseline.id = process.selected_baseline_item_id
   AND baseline.baseline_id = v_run.baseline_id
  WHERE process.analysis_run_id = v_run.id
    AND process.should_count = true
    AND process.recommendation = 'send'
    AND process.review_required = false
    AND process.is_complete = true
    AND process.is_independent = true
    AND process.candidate_function_type = 'TRN'
    AND baseline.function_sigla IN ('EE', 'CE', 'SE', 'TRN');

  IF jsonb_array_length(v_items) = 0 THEN
    UPDATE public.user_stories
    SET function_points = 0,
        apf_pf_bruto = 0,
        apf_pf_fs = 0,
        ai_fp_confidence = NULL,
        ai_fp_validated = true,
        updated_at = now()
    WHERE id = v_run.story_id;

    PERFORM public.recalculate_apf_session_totals(p_session_id);

    UPDATE public.apf_process_analysis_runs
    SET status = 'counted',
        materialized_at = now(),
        updated_at = now()
    WHERE id = v_run.id;

    RETURN jsonb_build_object(
      'analysis_id', v_run.id,
      'analysis_status', 'counted',
      'counting', jsonb_build_object(
        'session_id', p_session_id,
        'story_pf_bruto', 0,
        'story_pf_fs', 0,
        'items', '[]'::jsonb,
        'inserted_items', 0,
        'deduplicated_items', 0
      )
    );
  END IF;

  v_result := public.save_contractual_counting_items(
    p_session_id,
    v_run.story_id,
    v_items,
    coalesce(v_run.provider_name, 'Structured process analysis')
  );

  UPDATE public.apf_process_analysis_runs
  SET status = 'counted',
      materialized_at = now(),
      updated_at = now()
  WHERE id = v_run.id;

  RETURN jsonb_build_object(
    'analysis_id', v_run.id,
    'analysis_status', 'counted',
    'counting', v_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.materialize_apf_process_analysis(UUID, UUID)
  TO authenticated, service_role;
