-- ============================================================
-- APF — endurecimento da camada de análise de processos.
--
-- 1. O retrieval de processos devolve somente EE/CE/SE/TRN.
-- 2. A resposta da análise usa os enums públicos em português.
-- 3. A materialização deduplica pela linha homologada da baseline.
-- 4. Uma análise sem processos contáveis é concluída com zero PF.
-- 5. O tipo indefinido é normalizado antes das constraints.
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_apf_analysis_candidate_type()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.candidate_function_type := CASE
    WHEN upper(coalesce(NEW.candidate_function_type, '')) IN ('EE', 'CE', 'SE', 'TRN')
      THEN upper(NEW.candidate_function_type)
    ELSE 'indefinido'
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_apf_analysis_candidate_type
  ON public.apf_process_analysis_items;
CREATE TRIGGER trg_normalize_apf_analysis_candidate_type
BEFORE INSERT OR UPDATE OF candidate_function_type
ON public.apf_process_analysis_items
FOR EACH ROW
EXECUTE FUNCTION public.normalize_apf_analysis_candidate_type();

-- Preserva a implementação de ranking da migration 14 e publica uma visão
-- estritamente transacional para os consumidores da análise.
DO $$
BEGIN
  IF to_regprocedure(
    'public.get_apf_project_process_candidates_unfiltered(uuid,text,integer)'
  ) IS NULL THEN
    ALTER FUNCTION public.get_apf_project_process_candidates(UUID, TEXT, INT)
      RENAME TO get_apf_project_process_candidates_unfiltered;
  END IF;
END $$;

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
      item.value AS item
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
    round(sum(coalesce((transactional.item->>'pf_bruto')::numeric, 0)), 2)
      AS total_pf_bruto,
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
  TO authenticated;

CREATE OR REPLACE FUNCTION public.get_apf_process_analysis(p_analysis_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', run.id,
    'project_id', run.project_id,
    'story_id', run.story_id,
    'baseline_id', run.baseline_id,
    'status', run.status,
    'status_reason', run.status_reason,
    'validation_mode', run.validation_mode,
    'inferred_factor_sigla', run.inferred_factor_sigla,
    'hu_summary', run.hu_summary,
    'processo_central', jsonb_build_object(
      'nome', run.central_process_name,
      'justificativa', run.central_process_reasoning
    ),
    'quantidade_processos_identificados', run.process_count,
    'processos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', process.id,
        'id_temporario', process.temporary_id,
        'nome_processo', process.process_name,
        'acao_negocio', process.business_action,
        'objeto_negocio', process.business_object,
        'tipo_funcional_candidato', process.candidate_function_type,
        'deve_contar_como_processo_elementar', process.should_count,
        'justificativa_separacao', process.separation_reason,
        'resultado_funcional_entregue', process.functional_result,
        'central', process.is_central,
        'completo', process.is_complete,
        'independente_dos_demais', process.is_independent,
        'precedente_baseline_encontrado', process.baseline_precedent_found,
        'recomendacao_para_contador_existente', CASE process.recommendation
          WHEN 'send' THEN 'enviar'
          WHEN 'do_not_send' THEN 'nao_enviar'
          ELSE 'enviar_com_validacao'
        END,
        'requer_validacao_humana', process.review_required,
        'confianca', process.confidence,
        'duvidas_ou_riscos', process.risks,
        'sinais_para_o_contador_existente', process.counter_signals,
        'selected_baseline_item_id', process.selected_baseline_item_id,
        'baseline_analogas', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'id', analog.id,
            'baseline_item_id', analog.baseline_item_id,
            'item_baseline', analog.baseline_item_name,
            'tipo', analog.function_type,
            'aderencia', CASE analog.adherence
              WHEN 'high' THEN 'alta'
              WHEN 'medium' THEN 'media'
              ELSE 'baixa'
            END,
            'motivo_aderencia', analog.adherence_reason,
            'principal', analog.is_primary
          ) ORDER BY analog.is_primary DESC, analog.created_at)
          FROM public.apf_process_analysis_analogs analog
          WHERE analog.analysis_process_id = process.id
        ), '[]'::jsonb),
        'arquivos_logicos_referenciados', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'id', logical_file.id,
            'baseline_item_id', logical_file.baseline_item_id,
            'nome', logical_file.file_name,
            'tipo', CASE logical_file.file_type
              WHEN 'ALI' THEN 'ALI'
              WHEN 'AIE' THEN 'AIE'
              ELSE 'desconhecido'
            END,
            'papel_no_processo', CASE logical_file.process_role
              WHEN 'maintained' THEN 'mantido'
              WHEN 'read' THEN 'consultado'
              WHEN 'both' THEN 'ambos'
              ELSE 'desconhecido'
            END
          ) ORDER BY logical_file.created_at)
          FROM public.apf_process_analysis_logical_files logical_file
          WHERE logical_file.analysis_process_id = process.id
        ), '[]'::jsonb)
      ) ORDER BY process.sort_order, process.created_at)
      FROM public.apf_process_analysis_items process
      WHERE process.analysis_run_id = run.id
    ), '[]'::jsonb),
    'itens_absorvidos_no_processo_central', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'descricao', item.description,
        'motivo_absorcao', item.absorption_reason
      ) ORDER BY item.created_at)
      FROM public.apf_process_analysis_absorbed_items item
      WHERE item.analysis_run_id = run.id
    ), '[]'::jsonb),
    'itens_nao_contaveis_como_processo', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'descricao', item.description,
        'motivo', item.reason
      ) ORDER BY item.created_at)
      FROM public.apf_process_analysis_non_countable_items item
      WHERE item.analysis_run_id = run.id
    ), '[]'::jsonb),
    'pendencias_de_detalhamento', coalesce((
      SELECT jsonb_agg(item.description ORDER BY item.created_at)
      FROM public.apf_process_analysis_pending_details item
      WHERE item.analysis_run_id = run.id
    ), '[]'::jsonb),
    'prompt_version', run.prompt_version,
    'schema_version', run.schema_version,
    'provider_name', run.provider_name,
    'model_name', run.model_name,
    'created_at', run.created_at,
    'finished_at', run.finished_at,
    'materialized_at', run.materialized_at
  )
  FROM public.apf_process_analysis_runs run
  JOIN public.projects project ON project.id = run.project_id
  WHERE run.id = p_analysis_id
    AND (
      auth.uid() IS NULL
      OR public.is_team_member(auth.uid(), project.team_id)
      OR public.has_role(auth.uid(), 'admin')
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_apf_process_analysis(UUID) TO authenticated;

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

  SELECT * INTO v_session FROM public.apf_counting_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL
     OR v_session.project_id <> v_run.project_id
     OR v_session.baseline_id <> v_run.baseline_id THEN
    RAISE EXCEPTION 'Sessão incompatível com a análise e a baseline';
  END IF;
  IF v_run.status NOT IN ('ok', 'review_required', 'counted') THEN
    RAISE EXCEPTION 'A análise não está pronta para materialização: %', v_run.status;
  END IF;

  SELECT * INTO v_story FROM public.user_stories WHERE id = v_run.story_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'baseline_item_id', process.selected_baseline_item_id,
    'hu_ref', v_story.code,
    'ef_description', process.process_name,
    'function_sigla', baseline.function_sigla,
    'factor_sigla', v_run.inferred_factor_sigla,
    'match_type', 'structured_process_analysis',
    'confidence', coalesce(process.confidence, 0.5),
    'justification', process.separation_reason,
    'evidence_literal', concat_ws(E'\n\n', v_story.title, v_story.description, v_story.acceptance_criteria),
    'category_sigla', baseline.category_sigla,
    'complexity', baseline.complexity,
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
    AND process.candidate_function_type IN ('EE', 'CE', 'SE', 'TRN')
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
    SET status = 'counted', materialized_at = now(), updated_at = now()
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
  SET status = 'counted', materialized_at = now(), updated_at = now()
  WHERE id = v_run.id;

  RETURN jsonb_build_object(
    'analysis_id', v_run.id,
    'analysis_status', 'counted',
    'counting', v_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.materialize_apf_process_analysis(UUID, UUID)
  TO authenticated;
