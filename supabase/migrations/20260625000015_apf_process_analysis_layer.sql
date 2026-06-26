-- ============================================================
-- APF — camada autônoma de análise de processos elementares.
--
-- A análise é persistida e validada antes de qualquer item chegar
-- ao motor de contagem. ALI/AIE só podem ser arquivos referenciados.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apf_process_analysis_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES public.user_stories(id) ON DELETE CASCADE,
  baseline_id UUID NOT NULL REFERENCES public.apf_project_baselines(id) ON DELETE RESTRICT,
  provider_id UUID,
  provider_name TEXT,
  model_name TEXT,
  validation_mode TEXT NOT NULL DEFAULT 'assisted',
  status TEXT NOT NULL DEFAULT 'processing',
  status_reason TEXT,
  input_hash TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  inferred_factor_sigla TEXT NOT NULL,
  hu_summary TEXT,
  central_process_name TEXT,
  central_process_reasoning TEXT,
  raw_response TEXT,
  normalized_response JSONB,
  process_count INT NOT NULL DEFAULT 0,
  countable_process_count INT NOT NULL DEFAULT 0,
  review_process_count INT NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  materialized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_apf_process_analysis_mode
    CHECK (validation_mode IN ('assisted', 'automatic')),
  CONSTRAINT ck_apf_process_analysis_status
    CHECK (status IN ('processing', 'ok', 'review_required', 'counted', 'error', 'superseded')),
  CONSTRAINT uq_apf_process_analysis_input
    UNIQUE(story_id, baseline_id, input_hash, prompt_version, schema_version)
);

CREATE TABLE IF NOT EXISTS public.apf_process_analysis_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id UUID NOT NULL REFERENCES public.apf_process_analysis_runs(id) ON DELETE CASCADE,
  temporary_id TEXT NOT NULL,
  process_name TEXT NOT NULL,
  business_action TEXT,
  business_object TEXT,
  candidate_function_type TEXT NOT NULL DEFAULT 'indefinido',
  should_count BOOLEAN NOT NULL DEFAULT false,
  separation_reason TEXT,
  functional_result TEXT,
  is_central BOOLEAN NOT NULL DEFAULT false,
  is_complete BOOLEAN NOT NULL DEFAULT false,
  is_independent BOOLEAN NOT NULL DEFAULT false,
  baseline_precedent_found BOOLEAN NOT NULL DEFAULT false,
  recommendation TEXT NOT NULL DEFAULT 'send_with_validation',
  review_required BOOLEAN NOT NULL DEFAULT true,
  confidence NUMERIC(5,4),
  risks JSONB NOT NULL DEFAULT '[]'::jsonb,
  counter_signals JSONB NOT NULL DEFAULT '{}'::jsonb,
  selected_baseline_item_id UUID REFERENCES public.apf_baseline_items(id) ON DELETE SET NULL,
  counting_item_id UUID REFERENCES public.apf_counting_items(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_apf_process_analysis_item UNIQUE(analysis_run_id, temporary_id),
  CONSTRAINT ck_apf_analysis_candidate_type
    CHECK (candidate_function_type IN ('EE', 'CE', 'SE', 'TRN', 'indefinido')),
  CONSTRAINT ck_apf_analysis_recommendation
    CHECK (recommendation IN ('send', 'do_not_send', 'send_with_validation'))
);

CREATE TABLE IF NOT EXISTS public.apf_process_analysis_analogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_process_id UUID NOT NULL REFERENCES public.apf_process_analysis_items(id) ON DELETE CASCADE,
  baseline_item_id UUID REFERENCES public.apf_baseline_items(id) ON DELETE SET NULL,
  baseline_item_name TEXT NOT NULL,
  function_type TEXT NOT NULL DEFAULT 'indefinido',
  adherence TEXT NOT NULL DEFAULT 'low',
  adherence_reason TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_apf_analysis_analog_type
    CHECK (function_type IN ('EE', 'CE', 'SE', 'TRN', 'ALI', 'AIE', 'indefinido')),
  CONSTRAINT ck_apf_analysis_adherence
    CHECK (adherence IN ('high', 'medium', 'low'))
);

CREATE TABLE IF NOT EXISTS public.apf_process_analysis_logical_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_process_id UUID NOT NULL REFERENCES public.apf_process_analysis_items(id) ON DELETE CASCADE,
  baseline_item_id UUID REFERENCES public.apf_baseline_items(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'unknown',
  process_role TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_apf_analysis_logical_file_type
    CHECK (file_type IN ('ALI', 'AIE', 'unknown')),
  CONSTRAINT ck_apf_analysis_logical_file_role
    CHECK (process_role IN ('maintained', 'read', 'both', 'unknown'))
);

CREATE TABLE IF NOT EXISTS public.apf_process_analysis_absorbed_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id UUID NOT NULL REFERENCES public.apf_process_analysis_runs(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  absorption_reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.apf_process_analysis_non_countable_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id UUID NOT NULL REFERENCES public.apf_process_analysis_runs(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.apf_process_analysis_pending_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id UUID NOT NULL REFERENCES public.apf_process_analysis_runs(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apf_process_analysis_story
  ON public.apf_process_analysis_runs(story_id, baseline_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apf_process_analysis_status
  ON public.apf_process_analysis_runs(project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apf_process_analysis_items_run
  ON public.apf_process_analysis_items(analysis_run_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_apf_process_analysis_analogs_process
  ON public.apf_process_analysis_analogs(analysis_process_id, is_primary DESC);

ALTER TABLE public.apf_process_analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apf_process_analysis_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apf_process_analysis_analogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apf_process_analysis_logical_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apf_process_analysis_absorbed_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apf_process_analysis_non_countable_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apf_process_analysis_pending_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS apf_process_analysis_runs_select ON public.apf_process_analysis_runs;
CREATE POLICY apf_process_analysis_runs_select
ON public.apf_process_analysis_runs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects project
    WHERE project.id = apf_process_analysis_runs.project_id
      AND (
        public.is_team_member(auth.uid(), project.team_id)
        OR public.has_role(auth.uid(), 'admin')
      )
  )
);

DROP POLICY IF EXISTS apf_process_analysis_items_select ON public.apf_process_analysis_items;
CREATE POLICY apf_process_analysis_items_select
ON public.apf_process_analysis_items FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.apf_process_analysis_runs run
    JOIN public.projects project ON project.id = run.project_id
    WHERE run.id = apf_process_analysis_items.analysis_run_id
      AND (
        public.is_team_member(auth.uid(), project.team_id)
        OR public.has_role(auth.uid(), 'admin')
      )
  )
);

DROP POLICY IF EXISTS apf_process_analysis_analogs_select ON public.apf_process_analysis_analogs;
CREATE POLICY apf_process_analysis_analogs_select
ON public.apf_process_analysis_analogs FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.apf_process_analysis_items process
    JOIN public.apf_process_analysis_runs run ON run.id = process.analysis_run_id
    JOIN public.projects project ON project.id = run.project_id
    WHERE process.id = apf_process_analysis_analogs.analysis_process_id
      AND (
        public.is_team_member(auth.uid(), project.team_id)
        OR public.has_role(auth.uid(), 'admin')
      )
  )
);

DROP POLICY IF EXISTS apf_process_analysis_logical_files_select ON public.apf_process_analysis_logical_files;
CREATE POLICY apf_process_analysis_logical_files_select
ON public.apf_process_analysis_logical_files FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.apf_process_analysis_items process
    JOIN public.apf_process_analysis_runs run ON run.id = process.analysis_run_id
    JOIN public.projects project ON project.id = run.project_id
    WHERE process.id = apf_process_analysis_logical_files.analysis_process_id
      AND (
        public.is_team_member(auth.uid(), project.team_id)
        OR public.has_role(auth.uid(), 'admin')
      )
  )
);

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'apf_process_analysis_absorbed_items',
    'apf_process_analysis_non_countable_items',
    'apf_process_analysis_pending_details'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', v_table, v_table);
    EXECUTE format(
      'CREATE POLICY %I_select ON public.%I FOR SELECT USING (
        EXISTS (
          SELECT 1
          FROM public.apf_process_analysis_runs run
          JOIN public.projects project ON project.id = run.project_id
          WHERE run.id = %I.analysis_run_id
            AND (public.is_team_member(auth.uid(), project.team_id)
              OR public.has_role(auth.uid(), ''admin''))
        )
      )',
      v_table, v_table, v_table
    );
  END LOOP;
END $$;

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

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'baseline_item_id', process.selected_baseline_item_id,
    'hu_ref', story.code,
    'ef_description', process.process_name,
    'function_sigla', baseline.function_sigla,
    'factor_sigla', v_run.inferred_factor_sigla,
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
    'counting', v_result
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.materialize_apf_process_analysis(UUID, UUID)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_apf_process_analysis(
  p_analysis_id UUID,
  p_session_id UUID,
  p_decisions JSONB
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
  v_send BOOLEAN;
  v_baseline_item_id UUID;
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
  IF jsonb_typeof(coalesce(p_decisions, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'p_decisions deve ser um array JSON';
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
          updated_at = now()
      WHERE id = v_process.id;
    ELSE
      UPDATE public.apf_process_analysis_items
      SET should_count = false,
          recommendation = 'do_not_send',
          review_required = false,
          updated_at = now()
      WHERE id = v_process.id;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.apf_process_analysis_items
    WHERE analysis_run_id = v_run.id
      AND review_required = true
  ) THEN
    UPDATE public.apf_process_analysis_runs
    SET status = 'review_required',
        status_reason = 'Ainda existem processos pendentes de decisão humana.',
        updated_at = now()
    WHERE id = v_run.id;

    RETURN public.get_apf_process_analysis(v_run.id);
  END IF;

  UPDATE public.apf_process_analysis_runs
  SET status = 'ok',
      status_reason = 'Análise confirmada pelo usuário.',
      review_process_count = 0,
      countable_process_count = (
        SELECT count(*) FROM public.apf_process_analysis_items
        WHERE analysis_run_id = v_run.id
          AND recommendation = 'send'
      ),
      updated_at = now()
  WHERE id = v_run.id;

  RETURN public.materialize_apf_process_analysis(v_run.id, p_session_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_apf_process_analysis(UUID, UUID, JSONB)
  TO authenticated;
