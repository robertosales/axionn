-- ============================================================
-- APF — persistência validada da análise estruturada.
-- A função impede ALI/AIE como processo e valida todos os vínculos
-- contra a baseline ativa antes de liberar materialização.
-- ============================================================

CREATE OR REPLACE FUNCTION public.persist_apf_process_analysis(
  p_project_id UUID,
  p_story_id UUID,
  p_baseline_id UUID,
  p_provider_id UUID,
  p_provider_name TEXT,
  p_model_name TEXT,
  p_validation_mode TEXT,
  p_input_hash TEXT,
  p_prompt_version TEXT,
  p_schema_version TEXT,
  p_factor_sigla TEXT,
  p_raw_response TEXT,
  p_analysis JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project RECORD;
  v_story RECORD;
  v_baseline RECORD;
  v_existing UUID;
  v_run_id UUID;
  v_process JSONB;
  v_analog JSONB;
  v_file JSONB;
  v_item JSONB;
  v_process_id UUID;
  v_baseline_item RECORD;
  v_selected_item RECORD;
  v_status TEXT;
  v_candidate_type TEXT;
  v_recommendation TEXT;
  v_should_count BOOLEAN;
  v_independent BOOLEAN;
  v_review BOOLEAN;
  v_process_count INT := 0;
  v_countable_count INT := 0;
  v_review_count INT := 0;
  v_central_count INT := 0;
BEGIN
  SELECT * INTO v_project FROM public.projects WHERE id = p_project_id;
  IF v_project.id IS NULL THEN RAISE EXCEPTION 'Projeto não encontrado'; END IF;
  IF auth.uid() IS NOT NULL
     AND NOT (
       public.is_team_member(auth.uid(), v_project.team_id)
       OR public.has_role(auth.uid(), 'admin')
     ) THEN
    RAISE EXCEPTION 'Usuário sem acesso ao projeto' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_story
  FROM public.user_stories
  WHERE id = p_story_id AND team_id = v_project.team_id;
  IF v_story.id IS NULL THEN RAISE EXCEPTION 'HU não pertence ao time do projeto'; END IF;

  SELECT * INTO v_baseline
  FROM public.apf_project_baselines
  WHERE id = p_baseline_id
    AND project_id = p_project_id
    AND status = 'active'
    AND deleted_at IS NULL;
  IF v_baseline.id IS NULL THEN RAISE EXCEPTION 'Baseline ativa incompatível'; END IF;

  IF p_validation_mode NOT IN ('assisted', 'automatic') THEN
    RAISE EXCEPTION 'Modo de validação inválido';
  END IF;
  IF jsonb_typeof(coalesce(p_analysis, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'A análise deve ser um objeto JSON';
  END IF;
  IF jsonb_typeof(coalesce(p_analysis->'processos', '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'processos deve ser um array';
  END IF;
  IF jsonb_array_length(coalesce(p_analysis->'processos', '[]'::jsonb)) > 20 THEN
    RAISE EXCEPTION 'A análise excedeu o limite de 20 processos';
  END IF;

  SELECT id INTO v_existing
  FROM public.apf_process_analysis_runs
  WHERE story_id = p_story_id
    AND baseline_id = p_baseline_id
    AND input_hash = p_input_hash
    AND prompt_version = p_prompt_version
    AND schema_version = p_schema_version
  ORDER BY created_at DESC
  LIMIT 1;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  v_status := CASE
    WHEN p_analysis->>'status_analise' = 'ok' THEN 'ok'
    ELSE 'review_required'
  END;

  INSERT INTO public.apf_process_analysis_runs(
    project_id, story_id, baseline_id, provider_id, provider_name, model_name,
    validation_mode, status, status_reason, input_hash, prompt_version,
    schema_version, inferred_factor_sigla, hu_summary,
    central_process_name, central_process_reasoning,
    raw_response, normalized_response, finished_at
  ) VALUES (
    p_project_id, p_story_id, p_baseline_id, p_provider_id,
    nullif(p_provider_name, ''), nullif(p_model_name, ''), p_validation_mode,
    v_status, nullif(p_analysis->>'motivo_status', ''), p_input_hash,
    p_prompt_version, p_schema_version, upper(p_factor_sigla),
    nullif(p_analysis->>'hu_resumo', ''),
    nullif(p_analysis#>>'{processo_central,nome}', ''),
    nullif(p_analysis#>>'{processo_central,justificativa}', ''),
    p_raw_response, p_analysis, now()
  ) RETURNING id INTO v_run_id;

  FOR v_process IN
    SELECT value FROM jsonb_array_elements(coalesce(p_analysis->'processos', '[]'::jsonb))
  LOOP
    v_process_count := v_process_count + 1;
    v_candidate_type := upper(coalesce(nullif(v_process->>'tipo_funcional_candidato', ''), 'INDEFINIDO'));
    IF v_candidate_type NOT IN ('EE', 'CE', 'SE', 'TRN', 'INDEFINIDO') THEN
      v_candidate_type := 'INDEFINIDO';
    END IF;

    v_should_count := coalesce((v_process->>'deve_contar_como_processo_elementar')::boolean, false);
    v_independent := coalesce((v_process->>'independente_dos_demais')::boolean, false);
    v_recommendation := CASE v_process->>'recomendacao_para_contador_existente'
      WHEN 'enviar' THEN 'send'
      WHEN 'nao_enviar' THEN 'do_not_send'
      ELSE 'send_with_validation'
    END;

    v_selected_item := NULL;
    IF nullif(v_process->>'selected_baseline_item_id', '') IS NOT NULL THEN
      SELECT * INTO v_selected_item
      FROM public.apf_baseline_items
      WHERE id = (v_process->>'selected_baseline_item_id')::uuid
        AND baseline_id = p_baseline_id
        AND function_sigla IN ('EE', 'CE', 'SE', 'TRN');
    END IF;

    v_review := v_should_count AND (
      NOT v_independent
      OR v_candidate_type = 'INDEFINIDO'
      OR v_selected_item.id IS NULL
      OR v_recommendation <> 'send'
      OR coalesce(jsonb_array_length(v_process->'duvidas_ou_riscos'), 0) > 0
    );

    IF v_should_count AND NOT v_review THEN
      v_countable_count := v_countable_count + 1;
    ELSIF v_review THEN
      v_review_count := v_review_count + 1;
      v_status := 'review_required';
      v_recommendation := 'send_with_validation';
    END IF;

    IF coalesce((v_process->>'central')::boolean, false) THEN
      v_central_count := v_central_count + 1;
    END IF;

    INSERT INTO public.apf_process_analysis_items(
      analysis_run_id, temporary_id, process_name, business_action,
      business_object, candidate_function_type, should_count,
      separation_reason, functional_result, is_central, is_complete,
      is_independent, baseline_precedent_found, recommendation,
      review_required, confidence, risks, counter_signals,
      selected_baseline_item_id, sort_order
    ) VALUES (
      v_run_id,
      coalesce(nullif(v_process->>'id_temporario', ''), 'P' || v_process_count),
      coalesce(nullif(v_process->>'nome_processo', ''), 'Processo ' || v_process_count),
      nullif(v_process->>'acao_negocio', ''),
      nullif(v_process->>'objeto_negocio', ''),
      v_candidate_type,
      v_should_count,
      nullif(v_process->>'justificativa_separacao', ''),
      nullif(v_process->>'resultado_funcional_entregue', ''),
      coalesce((v_process->>'central')::boolean, false),
      v_should_count,
      v_independent,
      coalesce((v_process->>'precedente_baseline_encontrado')::boolean, false),
      v_recommendation,
      v_review,
      coalesce(nullif(v_process->>'confidence', '')::numeric, 0.5),
      coalesce(v_process->'duvidas_ou_riscos', '[]'::jsonb),
      coalesce(v_process->'sinais_para_o_contador_existente', '{}'::jsonb),
      v_selected_item.id,
      v_process_count - 1
    ) RETURNING id INTO v_process_id;

    FOR v_analog IN
      SELECT value FROM jsonb_array_elements(coalesce(v_process->'baseline_analogas', '[]'::jsonb))
    LOOP
      v_baseline_item := NULL;
      IF nullif(v_analog->>'baseline_item_id', '') IS NOT NULL THEN
        SELECT * INTO v_baseline_item
        FROM public.apf_baseline_items
        WHERE id = (v_analog->>'baseline_item_id')::uuid
          AND baseline_id = p_baseline_id;
      END IF;

      INSERT INTO public.apf_process_analysis_analogs(
        analysis_process_id, baseline_item_id, baseline_item_name,
        function_type, adherence, adherence_reason, is_primary
      ) VALUES (
        v_process_id,
        v_baseline_item.id,
        coalesce(v_baseline_item.description, nullif(v_analog->>'item_baseline', ''), 'Referência não localizada'),
        CASE
          WHEN v_baseline_item.function_sigla IN ('EE','CE','SE','TRN','ALI','AIE')
            THEN v_baseline_item.function_sigla
          ELSE 'indefinido'
        END,
        CASE v_analog->>'aderencia'
          WHEN 'alta' THEN 'high'
          WHEN 'media' THEN 'medium'
          ELSE 'low'
        END,
        nullif(v_analog->>'motivo_aderencia', ''),
        v_selected_item.id IS NOT NULL AND v_baseline_item.id = v_selected_item.id
      );
    END LOOP;

    FOR v_file IN
      SELECT value FROM jsonb_array_elements(coalesce(v_process->'arquivos_logicos_referenciados', '[]'::jsonb))
    LOOP
      v_baseline_item := NULL;
      IF nullif(v_file->>'baseline_item_id', '') IS NOT NULL THEN
        SELECT * INTO v_baseline_item
        FROM public.apf_baseline_items
        WHERE id = (v_file->>'baseline_item_id')::uuid
          AND baseline_id = p_baseline_id
          AND function_sigla IN ('ALI', 'AIE');
      END IF;

      INSERT INTO public.apf_process_analysis_logical_files(
        analysis_process_id, baseline_item_id, file_name, file_type, process_role
      ) VALUES (
        v_process_id,
        v_baseline_item.id,
        coalesce(v_baseline_item.description, nullif(v_file->>'nome', ''), 'Arquivo não identificado'),
        coalesce(v_baseline_item.function_sigla,
          CASE upper(coalesce(v_file->>'tipo', ''))
            WHEN 'ALI' THEN 'ALI'
            WHEN 'AIE' THEN 'AIE'
            ELSE 'unknown'
          END),
        CASE v_file->>'papel_no_processo'
          WHEN 'mantido' THEN 'maintained'
          WHEN 'consultado' THEN 'read'
          WHEN 'ambos' THEN 'both'
          ELSE 'unknown'
        END
      );
    END LOOP;
  END LOOP;

  IF v_process_count > 0 AND v_central_count <> 1 THEN
    v_status := 'review_required';
    v_review_count := greatest(v_review_count, 1);
  END IF;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(coalesce(p_analysis->'itens_absorvidos_no_processo_central', '[]'::jsonb))
  LOOP
    INSERT INTO public.apf_process_analysis_absorbed_items(
      analysis_run_id, description, absorption_reason
    ) VALUES (
      v_run_id,
      coalesce(nullif(v_item->>'descricao', ''), 'Item absorvido'),
      coalesce(nullif(v_item->>'motivo_absorcao', ''), 'Sem resultado funcional independente')
    );
  END LOOP;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(coalesce(p_analysis->'itens_nao_contaveis_como_processo', '[]'::jsonb))
  LOOP
    INSERT INTO public.apf_process_analysis_non_countable_items(
      analysis_run_id, description, reason
    ) VALUES (
      v_run_id,
      coalesce(nullif(v_item->>'descricao', ''), 'Item não contável'),
      coalesce(nullif(v_item->>'motivo', ''), 'Não caracteriza processo elementar')
    );
  END LOOP;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(coalesce(p_analysis->'pendencias_de_detalhamento', '[]'::jsonb))
  LOOP
    INSERT INTO public.apf_process_analysis_pending_details(analysis_run_id, description)
    VALUES (v_run_id, trim(both '"' FROM v_item::text));
  END LOOP;

  UPDATE public.apf_process_analysis_runs
  SET status = v_status,
      process_count = v_process_count,
      countable_process_count = v_countable_count,
      review_process_count = v_review_count,
      status_reason = CASE
        WHEN v_status = 'review_required'
          THEN coalesce(status_reason, 'A análise possui processos que exigem validação humana.')
        ELSE coalesce(status_reason, 'Análise validada estruturalmente.')
      END,
      updated_at = now()
  WHERE id = v_run_id;

  RETURN v_run_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.persist_apf_process_analysis(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) TO authenticated;
