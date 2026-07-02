-- ============================================================
-- APF/PFS — Cérebro de contagem, fase 2.
--
-- Adiciona revisão explícita do fator antes da materialização:
-- - fator sugerido versus fator confirmado;
-- - fonte, confiança e justificativa da decisão automática;
-- - motivo obrigatório para alteração humana;
-- - PF sugerido versus PF confirmado na memória de aprendizado;
-- - bloqueio de materialização enquanto o fator estiver pendente.
-- ============================================================

-- --------------------------------------------------------------------------
-- 1. Auditoria da confirmação do fator
-- --------------------------------------------------------------------------
ALTER TABLE public.apf_process_analysis_runs
  ADD COLUMN IF NOT EXISTS confirmed_factor_source TEXT,
  ADD COLUMN IF NOT EXISTS factor_override_reason TEXT,
  ADD COLUMN IF NOT EXISTS factor_override_notes TEXT;

COMMENT ON COLUMN public.apf_process_analysis_runs.confirmed_factor_source IS
  'Fonte final do fator confirmado: fonte automática original ou human_override.';
COMMENT ON COLUMN public.apf_process_analysis_runs.factor_override_reason IS
  'Motivo estruturado obrigatório quando o usuário altera o fator sugerido.';
COMMENT ON COLUMN public.apf_process_analysis_runs.factor_override_notes IS
  'Observação livre fornecida na revisão do fator.';

ALTER TABLE public.apf_process_learning_events
  ADD COLUMN IF NOT EXISTS proposed_factor_sigla TEXT,
  ADD COLUMN IF NOT EXISTS factor_override_reason TEXT,
  ADD COLUMN IF NOT EXISTS factor_override_notes TEXT,
  ADD COLUMN IF NOT EXISTS suggested_pf_fs NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS confirmed_pf_fs NUMERIC(12,2);

COMMENT ON COLUMN public.apf_process_learning_events.proposed_factor_sigla IS
  'Fator bruto proposto antes da política de precedência do cérebro.';
COMMENT ON COLUMN public.apf_process_learning_events.suggested_factor_sigla IS
  'Fator resolvido pelo cérebro e apresentado ao usuário para confirmação.';
COMMENT ON COLUMN public.apf_process_learning_events.suggested_pf_fs IS
  'Prévia de PF Simples da seleção padrão com o fator sugerido pelo cérebro.';
COMMENT ON COLUMN public.apf_process_learning_events.confirmed_pf_fs IS
  'PF Simples da seleção e do fator efetivamente confirmados pelo usuário.';

-- --------------------------------------------------------------------------
-- 2. Leitura completa da análise para a interface de revisão
-- --------------------------------------------------------------------------
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
    'suggested_factor_sigla', run.suggested_factor_sigla,
    'factor_source', run.factor_source,
    'factor_confidence', run.factor_confidence,
    'factor_review_required', run.factor_review_required,
    'factor_reasoning', run.factor_reasoning,
    'confirmed_factor_sigla', run.confirmed_factor_sigla,
    'confirmed_factor_source', run.confirmed_factor_source,
    'factor_override_reason', run.factor_override_reason,
    'factor_override_notes', run.factor_override_notes,
    'confirmed_by', run.confirmed_by,
    'confirmed_at', run.confirmed_at,
    'hu_summary', run.hu_summary,
    'processo_central', jsonb_build_object(
      'nome', run.central_process_name,
      'justificativa', run.central_process_reasoning
    ),
    'quantidade_processos_identificados', run.process_count,
    'quantidade_processos_contaveis', run.countable_process_count,
    'quantidade_processos_em_revisao', run.review_process_count,
    'processos', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', process.id,
        'id_temporario', process.temporary_id,
        'nome_processo', process.process_name,
        'acao_negocio', process.business_action,
        'objeto_negocio', process.business_object,
        'tipo_funcional_candidato', process.candidate_function_type,
        'deve_contar_como_processo_elementar', process.should_count,
        'selected_by_default', process.selected_by_default,
        'decision_source', process.decision_source,
        'justificativa_separacao', process.separation_reason,
        'resultado_funcional_entregue', process.functional_result,
        'central', process.is_central,
        'completo', process.is_complete,
        'independente_dos_demais', process.is_independent,
        'precedente_baseline_encontrado', process.baseline_precedent_found,
        'recomendacao_para_contador_existente', process.recommendation,
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
            'aderencia', analog.adherence,
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
            'tipo', logical_file.file_type,
            'papel_no_processo', logical_file.process_role
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

-- --------------------------------------------------------------------------
-- 3. Materialização usa o fator confirmado e bloqueia pendências
-- --------------------------------------------------------------------------
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
  v_items JSONB;
  v_result JSONB;
  v_factor_sigla TEXT;
BEGIN
  SELECT run.*, project.team_id
  INTO v_run
  FROM public.apf_process_analysis_runs run
  JOIN public.projects project ON project.id = run.project_id
  WHERE run.id = p_analysis_id;

  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'Análise de processos não encontrada';
  END IF;
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

  IF v_run.status NOT IN ('ok', 'review_required') THEN
    RAISE EXCEPTION 'A análise não está pronta para materialização: %', v_run.status;
  END IF;

  IF v_run.factor_review_required
     AND v_run.confirmed_factor_sigla IS NULL THEN
    RAISE EXCEPTION 'O fator da HU precisa ser confirmado antes da materialização';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.apf_process_analysis_items process
    WHERE process.analysis_run_id = v_run.id
      AND process.review_required = true
  ) THEN
    RAISE EXCEPTION 'Ainda existem processos pendentes de decisão humana';
  END IF;

  v_factor_sigla := coalesce(
    nullif(upper(v_run.confirmed_factor_sigla), ''),
    nullif(upper(v_run.inferred_factor_sigla), '')
  );

  IF v_factor_sigla IS NULL THEN
    RAISE EXCEPTION 'Nenhum fator válido foi definido para a HU';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'baseline_item_id', process.selected_baseline_item_id,
    'hu_ref', story.code,
    'ef_description', process.process_name,
    'function_sigla', baseline.function_sigla,
    'factor_sigla', v_factor_sigla,
    'match_type', 'structured_process_analysis',
    'confidence', coalesce(process.confidence, 0.5),
    'justification', process.separation_reason,
    'evidence_literal', concat_ws(E'\n\n', story.title, story.description, story.acceptance_criteria),
    'category_sigla', baseline.category_sigla,
    'complexity', baseline.complexity,
    'elementary_process_key', public.normalize_apf_process_key(
      concat('analysis ', process.temporary_id, ' ', process.business_action, ' ', process.business_object)
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
  JOIN public.user_stories story ON story.id = v_run.story_id
  WHERE process.analysis_run_id = v_run.id
    AND process.should_count = true
    AND process.recommendation = 'send'
    AND process.review_required = false
    AND process.is_complete = true
    AND process.is_independent = true
    AND process.candidate_function_type IN ('EE', 'CE', 'SE', 'TRN')
    AND baseline.function_sigla IN ('EE', 'CE', 'SE', 'TRN');

  IF jsonb_array_length(v_items) = 0 THEN
    RAISE EXCEPTION 'Nenhum processo elegível foi aprovado para o contador';
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
    'factor_sigla', v_factor_sigla,
    'counting', v_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.materialize_apf_process_analysis(UUID, UUID)
  TO authenticated;

-- --------------------------------------------------------------------------
-- 4. RPC da Fase 2: processos e fator confirmados em uma única transação
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_apf_process_analysis_v2(
  p_analysis_id UUID,
  p_session_id UUID,
  p_decisions JSONB,
  p_factor_sigla TEXT,
  p_factor_override_reason TEXT DEFAULT NULL,
  p_factor_override_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_run RECORD;
  v_decision JSONB;
  v_process RECORD;
  v_baseline RECORD;
  v_factor RECORD;
  v_send BOOLEAN;
  v_baseline_item_id UUID;
  v_factor_sigla TEXT;
  v_factor_changed BOOLEAN;
  v_decision_source TEXT;
BEGIN
  SELECT run.*, project.team_id, project.contract_id
  INTO v_run
  FROM public.apf_process_analysis_runs run
  JOIN public.projects project ON project.id = run.project_id
  WHERE run.id = p_analysis_id;

  IF v_run.id IS NULL THEN
    RAISE EXCEPTION 'Análise de processos não encontrada';
  END IF;
  IF auth.uid() IS NOT NULL
     AND NOT (
       public.is_team_member(auth.uid(), v_run.team_id)
       OR public.has_role(auth.uid(), 'admin')
     ) THEN
    RAISE EXCEPTION 'Usuário sem acesso à análise' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(coalesce(p_decisions, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_decisions deve ser um array JSON';
  END IF;

  v_factor_sigla := nullif(upper(trim(p_factor_sigla)), '');
  IF v_factor_sigla IS NULL THEN
    RAISE EXCEPTION 'O fator confirmado é obrigatório';
  END IF;

  SELECT factor.*
  INTO v_factor
  FROM public.apf_counting_models model
  JOIN public.apf_impact_factors factor
    ON factor.model_id = model.id
   AND factor.is_active = true
  WHERE model.contract_id = v_run.contract_id
    AND model.is_active = true
    AND upper(factor.sigla) = v_factor_sigla
  ORDER BY model.updated_at DESC, factor.sort_order
  LIMIT 1;

  IF v_factor.id IS NULL THEN
    RAISE EXCEPTION 'O fator % não está ativo no modelo contratual do projeto', v_factor_sigla;
  END IF;

  v_factor_changed := v_factor_sigla IS DISTINCT FROM upper(v_run.inferred_factor_sigla);
  IF v_factor_changed
     AND nullif(trim(coalesce(p_factor_override_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da alteração do fator sugerido';
  END IF;

  FOR v_decision IN SELECT * FROM jsonb_array_elements(p_decisions)
  LOOP
    SELECT * INTO v_process
    FROM public.apf_process_analysis_items
    WHERE id = nullif(v_decision->>'process_id', '')::uuid
      AND analysis_run_id = v_run.id;

    IF v_process.id IS NULL THEN
      RAISE EXCEPTION 'Processo da análise não encontrado';
    END IF;

    v_send := coalesce((v_decision->>'send')::boolean, false);
    v_baseline_item_id := nullif(v_decision->>'baseline_item_id', '')::uuid;
    v_decision_source := CASE
      WHEN v_send IS DISTINCT FROM v_process.selected_by_default
        OR v_baseline_item_id IS DISTINCT FROM v_process.selected_baseline_item_id
        THEN 'human_override'
      WHEN v_process.selected_by_default THEN 'policy_default'
      ELSE 'human_confirmed'
    END;

    IF v_send THEN
      SELECT * INTO v_baseline
      FROM public.apf_baseline_items
      WHERE id = v_baseline_item_id
        AND baseline_id = v_run.baseline_id
        AND function_sigla IN ('EE', 'CE', 'SE', 'TRN');

      IF v_baseline.id IS NULL THEN
        RAISE EXCEPTION 'O processo deve usar um item transacional da baseline ativa';
      END IF;

      UPDATE public.apf_process_analysis_items
      SET should_count = true,
          candidate_function_type = v_baseline.function_sigla,
          selected_baseline_item_id = v_baseline.id,
          recommendation = 'send',
          review_required = false,
          is_complete = true,
          is_independent = true,
          decision_source = v_decision_source,
          updated_at = now()
      WHERE id = v_process.id;
    ELSE
      UPDATE public.apf_process_analysis_items
      SET should_count = false,
          recommendation = 'do_not_send',
          review_required = false,
          decision_source = v_decision_source,
          updated_at = now()
      WHERE id = v_process.id;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.apf_process_analysis_items
    WHERE analysis_run_id = v_run.id
      AND review_required = true
  ) THEN
    UPDATE public.apf_process_analysis_runs
    SET confirmed_factor_sigla = v_factor_sigla,
        confirmed_factor_source = CASE
          WHEN v_factor_changed THEN 'human_override'
          ELSE factor_source
        END,
        factor_override_reason = CASE
          WHEN v_factor_changed THEN nullif(trim(p_factor_override_reason), '')
          ELSE NULL
        END,
        factor_override_notes = CASE
          WHEN v_factor_changed THEN nullif(trim(p_factor_override_notes), '')
          ELSE NULL
        END,
        factor_review_required = false,
        confirmed_by = auth.uid(),
        confirmed_at = now(),
        status = 'review_required',
        status_reason = 'Ainda existem processos pendentes de decisão humana.',
        updated_at = now()
    WHERE id = v_run.id;

    RETURN public.get_apf_process_analysis(v_run.id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.apf_process_analysis_items
    WHERE analysis_run_id = v_run.id
      AND should_count = true
  ) THEN
    RAISE EXCEPTION 'Selecione ao menos um processo para enviar ao contador';
  END IF;

  UPDATE public.apf_process_analysis_runs
  SET confirmed_factor_sigla = v_factor_sigla,
      confirmed_factor_source = CASE
        WHEN v_factor_changed THEN 'human_override'
        ELSE factor_source
      END,
      factor_override_reason = CASE
        WHEN v_factor_changed THEN nullif(trim(p_factor_override_reason), '')
        ELSE NULL
      END,
      factor_override_notes = CASE
        WHEN v_factor_changed THEN nullif(trim(p_factor_override_notes), '')
        ELSE NULL
      END,
      factor_review_required = false,
      confirmed_by = auth.uid(),
      confirmed_at = now(),
      status = 'ok',
      status_reason = CASE
        WHEN v_factor_changed THEN format(
          'Análise confirmada pelo usuário com alteração do fator %s para %s.',
          v_run.inferred_factor_sigla,
          v_factor_sigla
        )
        ELSE 'Análise e fator confirmados pelo usuário.'
      END,
      review_process_count = 0,
      countable_process_count = (
        SELECT count(*)
        FROM public.apf_process_analysis_items
        WHERE analysis_run_id = v_run.id
          AND should_count = true
      ),
      updated_at = now()
  WHERE id = v_run.id;

  RETURN public.materialize_apf_process_analysis(v_run.id, p_session_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_apf_process_analysis_v2(
  UUID, UUID, JSONB, TEXT, TEXT, TEXT
) TO authenticated;

-- --------------------------------------------------------------------------
-- 5. Memória de aprendizado com fator e impacto em PF
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_apf_process_learning_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id UUID;
  v_model_id UUID;
  v_default_count INT;
  v_confirmed_count INT;
  v_default_pf_bruto NUMERIC(12,2);
  v_confirmed_pf_bruto NUMERIC(12,2);
  v_suggested_pct NUMERIC(6,2);
  v_confirmed_pct NUMERIC(6,2);
  v_confirmed_factor TEXT;
  v_decisions JSONB;
BEGIN
  IF OLD.status = 'review_required' AND NEW.status IN ('ok', 'counted') THEN
    SELECT project.team_id, model.id
    INTO v_team_id, v_model_id
    FROM public.projects project
    LEFT JOIN public.apf_counting_models model
      ON model.contract_id = project.contract_id
     AND model.is_active = true
    WHERE project.id = NEW.project_id
    ORDER BY model.updated_at DESC
    LIMIT 1;

    SELECT
      count(*) FILTER (WHERE process.selected_by_default),
      count(*) FILTER (WHERE process.should_count),
      coalesce(sum(baseline.pf_bruto) FILTER (WHERE process.selected_by_default), 0),
      coalesce(sum(baseline.pf_bruto) FILTER (WHERE process.should_count), 0),
      coalesce(jsonb_agg(jsonb_build_object(
        'process_id', process.id,
        'process_name', process.process_name,
        'central', process.is_central,
        'confidence', process.confidence,
        'selected_by_default', process.selected_by_default,
        'confirmed_selected', process.should_count,
        'baseline_item_id', process.selected_baseline_item_id,
        'decision_source', process.decision_source
      ) ORDER BY process.sort_order), '[]'::jsonb)
    INTO
      v_default_count,
      v_confirmed_count,
      v_default_pf_bruto,
      v_confirmed_pf_bruto,
      v_decisions
    FROM public.apf_process_analysis_items process
    LEFT JOIN public.apf_baseline_items baseline
      ON baseline.id = process.selected_baseline_item_id
    WHERE process.analysis_run_id = NEW.id;

    v_confirmed_factor := coalesce(
      nullif(upper(NEW.confirmed_factor_sigla), ''),
      nullif(upper(NEW.inferred_factor_sigla), '')
    );

    SELECT factor.contribution_pct
    INTO v_suggested_pct
    FROM public.apf_impact_factors factor
    WHERE factor.model_id = v_model_id
      AND factor.is_active = true
      AND upper(factor.sigla) = upper(NEW.inferred_factor_sigla)
    LIMIT 1;

    SELECT factor.contribution_pct
    INTO v_confirmed_pct
    FROM public.apf_impact_factors factor
    WHERE factor.model_id = v_model_id
      AND factor.is_active = true
      AND upper(factor.sigla) = v_confirmed_factor
    LIMIT 1;

    INSERT INTO public.apf_process_learning_events(
      project_id,
      team_id,
      story_id,
      analysis_run_id,
      event_type,
      identified_process_count,
      default_selected_process_count,
      suggested_process_count,
      confirmed_process_count,
      proposed_factor_sigla,
      suggested_factor_sigla,
      confirmed_factor_sigla,
      factor_source,
      factor_confidence,
      factor_override_reason,
      factor_override_notes,
      suggested_pf_fs,
      confirmed_pf_fs,
      process_decisions,
      decided_by
    ) VALUES (
      NEW.project_id,
      v_team_id,
      NEW.story_id,
      NEW.id,
      CASE
        WHEN upper(NEW.inferred_factor_sigla) IS DISTINCT FROM v_confirmed_factor
          THEN 'specialist_override'
        ELSE 'analysis_confirmed'
      END,
      NEW.process_count,
      coalesce(v_default_count, 0),
      coalesce(v_default_count, 0),
      coalesce(v_confirmed_count, 0),
      NEW.suggested_factor_sigla,
      NEW.inferred_factor_sigla,
      v_confirmed_factor,
      NEW.factor_source,
      NEW.factor_confidence,
      NEW.factor_override_reason,
      NEW.factor_override_notes,
      round(coalesce(v_default_pf_bruto, 0) * coalesce(v_suggested_pct, 0) / 100.0, 2),
      round(coalesce(v_confirmed_pf_bruto, 0) * coalesce(v_confirmed_pct, 0) / 100.0, 2),
      v_decisions,
      auth.uid()
    );

    NEW.confirmed_factor_sigla := v_confirmed_factor;
    NEW.confirmed_factor_source := coalesce(
      NEW.confirmed_factor_source,
      NEW.factor_source
    );
    NEW.confirmed_by := coalesce(NEW.confirmed_by, auth.uid());
    NEW.confirmed_at := coalesce(NEW.confirmed_at, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP VIEW IF EXISTS public.v_apf_process_learning_accuracy;

CREATE VIEW public.v_apf_process_learning_accuracy AS
SELECT
  date_trunc('week', event.created_at)::date AS week,
  event.team_id,
  event.project_id,
  count(*) AS total_analyses,
  sum(CASE
    WHEN event.default_selected_process_count = event.confirmed_process_count THEN 1
    ELSE 0
  END) AS exact_default_selection,
  round(avg(CASE
    WHEN event.default_selected_process_count = event.confirmed_process_count THEN 1.0
    ELSE 0.0
  END) * 100, 1) AS default_selection_accuracy_pct,
  round(
    avg(abs(event.confirmed_process_count - event.default_selected_process_count)::numeric),
    2
  ) AS default_selection_mean_absolute_error,
  round(
    avg(abs(event.confirmed_process_count - event.identified_process_count)::numeric),
    2
  ) AS candidate_fragmentation_mean_absolute_error,
  sum(CASE
    WHEN event.identified_process_count > event.confirmed_process_count THEN 1
    ELSE 0
  END) AS over_fragmented_analyses,
  sum(CASE
    WHEN event.identified_process_count < event.confirmed_process_count THEN 1
    ELSE 0
  END) AS under_fragmented_analyses,
  sum(CASE
    WHEN event.confirmed_process_count > event.default_selected_process_count THEN 1
    ELSE 0
  END) AS user_added_processes,
  sum(CASE
    WHEN event.confirmed_process_count < event.default_selected_process_count THEN 1
    ELSE 0
  END) AS user_removed_default_processes,
  sum(CASE
    WHEN event.suggested_factor_sigla IS DISTINCT FROM event.confirmed_factor_sigla THEN 1
    ELSE 0
  END) AS factor_override_count,
  round(avg(CASE
    WHEN event.suggested_factor_sigla IS NOT DISTINCT FROM event.confirmed_factor_sigla THEN 1.0
    ELSE 0.0
  END) * 100, 1) AS factor_confirmation_accuracy_pct,
  round(avg(abs(coalesce(event.confirmed_pf_fs, 0) - coalesce(event.suggested_pf_fs, 0))), 2)
    AS mean_absolute_pf_adjustment
FROM public.apf_process_learning_events event
GROUP BY 1, 2, 3;

GRANT SELECT ON public.v_apf_process_learning_accuracy TO authenticated;
