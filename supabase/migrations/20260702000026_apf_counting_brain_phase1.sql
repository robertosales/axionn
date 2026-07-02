-- ============================================================
-- APF/PFS — Cérebro de contagem, fase 1.
--
-- Objetivos:
-- 1. Evitar supercontagem: quando houver múltiplos processos candidatos,
--    apenas um fica pré-selecionado e a análise exige revisão humana.
-- 2. Remover A como fallback genérico. O fator passa a respeitar:
--    histórico oficial > precedentes validados do projeto > evidência textual
--    > inclusão conservadora.
-- 3. Registrar a diferença entre a seleção sugerida e a decisão humana para
--    alimentar o aprendizado de granularidade de processos.
-- ============================================================

-- --------------------------------------------------------------------------
-- 1. Metadados de decisão e explicabilidade
-- --------------------------------------------------------------------------
ALTER TABLE public.apf_process_analysis_runs
  ADD COLUMN IF NOT EXISTS suggested_factor_sigla TEXT,
  ADD COLUMN IF NOT EXISTS factor_source TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS factor_confidence NUMERIC(5,4),
  ADD COLUMN IF NOT EXISTS factor_review_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS factor_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_factor_sigla TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

ALTER TABLE public.apf_process_analysis_items
  ADD COLUMN IF NOT EXISTS selected_by_default BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS decision_source TEXT NOT NULL DEFAULT 'ai';

COMMENT ON COLUMN public.apf_process_analysis_runs.suggested_factor_sigla IS
  'Fator originalmente sugerido pelo cliente/IA antes da política de precedência.';
COMMENT ON COLUMN public.apf_process_analysis_runs.factor_source IS
  'Fonte que decidiu o fator: official_history, validated_precedent, explicit_rule, conservative_default ou legacy.';
COMMENT ON COLUMN public.apf_process_analysis_items.selected_by_default IS
  'Indica o único processo pré-selecionado pela política conservadora.';

-- --------------------------------------------------------------------------
-- 2. Memória estruturada de decisões de granularidade
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.apf_process_learning_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES public.user_stories(id) ON DELETE CASCADE,
  analysis_run_id UUID NOT NULL REFERENCES public.apf_process_analysis_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'analysis_confirmed',
  suggested_process_count INT NOT NULL DEFAULT 0,
  confirmed_process_count INT NOT NULL DEFAULT 0,
  suggested_factor_sigla TEXT,
  confirmed_factor_sigla TEXT,
  factor_source TEXT,
  factor_confidence NUMERIC(5,4),
  process_decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  corrected BOOLEAN GENERATED ALWAYS AS (
    suggested_process_count IS DISTINCT FROM confirmed_process_count
    OR suggested_factor_sigla IS DISTINCT FROM confirmed_factor_sigla
  ) STORED,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_apf_process_learning_event_type
    CHECK (event_type IN ('analysis_confirmed', 'official_import', 'specialist_override'))
);

CREATE INDEX IF NOT EXISTS idx_apf_process_learning_project
  ON public.apf_process_learning_events(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apf_process_learning_story
  ON public.apf_process_learning_events(story_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apf_process_learning_corrected
  ON public.apf_process_learning_events(corrected, created_at DESC);

ALTER TABLE public.apf_process_learning_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS apf_process_learning_select ON public.apf_process_learning_events;
CREATE POLICY apf_process_learning_select
ON public.apf_process_learning_events FOR SELECT
USING (
  public.is_team_member(auth.uid(), team_id)
  OR public.has_role(auth.uid(), 'admin')
);

GRANT SELECT ON public.apf_process_learning_events TO authenticated;
GRANT ALL ON public.apf_process_learning_events TO service_role;

-- --------------------------------------------------------------------------
-- 3. Resolução determinística do fator com memória e precedência
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_apf_factor_decision(
  p_project_id UUID,
  p_story_id UUID,
  p_proposed_factor TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_story_text TEXT;
  v_history public.apf_metric_factor_history%ROWTYPE;
  v_precedent_factor TEXT;
  v_precedent_count INT := 0;
  v_precedent_similarity NUMERIC := 0;
  v_factor TEXT;
  v_source TEXT;
  v_confidence NUMERIC(5,4);
  v_review BOOLEAN := false;
  v_reason TEXT;
BEGIN
  SELECT public.normalize_apf_text(concat_ws(
    E'\n', story.code, story.title, story.description, story.acceptance_criteria
  ))
  INTO v_story_text
  FROM public.user_stories story
  JOIN public.projects project
    ON project.id = p_project_id
   AND project.team_id = story.team_id
  WHERE story.id = p_story_id;

  IF v_story_text IS NULL THEN
    RAISE EXCEPTION 'HU não encontrada ou incompatível com o projeto';
  END IF;

  -- Fonte 1: medição oficial da área de métricas.
  SELECT *
  INTO v_history
  FROM public.get_apf_metric_history_for_story(p_project_id, p_story_id);

  IF v_history.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'factor_sigla', upper(v_history.factor_sigla),
      'source', 'official_history',
      'confidence', 1.0000,
      'review_required', false,
      'reasoning', format(
        'Precedente oficial %s: fator %s, PF Bruto %s e PF Simples %s.',
        v_history.reference_code,
        v_history.factor_sigla,
        to_char(v_history.pf_bruto, 'FM999990.00'),
        to_char(v_history.pf_fs, 'FM999990.00')
      )
    );
  END IF;

  -- Fonte 2: decisões humanas anteriores do mesmo projeto.
  SELECT
    upper(event.validated_factor_sigla),
    count(*)::int,
    avg(similarity(public.normalize_apf_text(event.hu_text), v_story_text))
  INTO v_precedent_factor, v_precedent_count, v_precedent_similarity
  FROM public.apf_validation_events event
  WHERE event.project_id = p_project_id
    AND event.validated_factor_sigla IS NOT NULL
    AND upper(event.validated_factor_sigla) IN ('I', 'A', 'A75', 'A90', 'E', 'COR', 'COR50', 'PMD')
    AND similarity(public.normalize_apf_text(event.hu_text), v_story_text) >= 0.25
  GROUP BY upper(event.validated_factor_sigla)
  ORDER BY
    avg(similarity(public.normalize_apf_text(event.hu_text), v_story_text)) DESC,
    count(*) DESC
  LIMIT 1;

  IF v_precedent_factor IS NOT NULL
     AND v_precedent_count >= 2
     AND v_precedent_similarity >= 0.35 THEN
    RETURN jsonb_build_object(
      'factor_sigla', v_precedent_factor,
      'source', 'validated_precedent',
      'confidence', least(0.9500, 0.6500 + (v_precedent_count * 0.0300) + (v_precedent_similarity * 0.1500)),
      'review_required', false,
      'reasoning', format(
        '%s precedente(s) validado(s) do projeto sustentam o fator %s; similaridade média %s.',
        v_precedent_count,
        v_precedent_factor,
        to_char(v_precedent_similarity, 'FM0.00')
      )
    );
  END IF;

  -- Fonte 3: regras explícitas. A só é escolhida quando há evidência de
  -- alteração de capacidade existente; não é mais fallback genérico.
  IF v_story_text ~ '(corrigir|correcao|erro|bug|defeito)' THEN
    v_factor := 'COR50';
    v_source := 'explicit_rule';
    v_confidence := 0.8500;
    v_reason := 'A HU contém evidência explícita de correção de defeito.';
  ELSIF v_story_text ~ '(excluir|exclusao|remover|retirar|desativar)' THEN
    v_factor := 'E';
    v_source := 'explicit_rule';
    v_confidence := 0.8500;
    v_reason := 'A HU contém evidência explícita de exclusão ou desativação.';
  ELSIF v_story_text ~ '(migrar|migracao|carga de dados)' THEN
    v_factor := 'PMD';
    v_source := 'explicit_rule';
    v_confidence := 0.8500;
    v_reason := 'A HU contém evidência explícita de migração ou carga de dados.';
  ELSIF v_story_text ~ '(alterar|ajustar|modificar|adequar|atualizar|evoluir|revisar)'
     OR v_story_text ~ '(incluir|adicionar) (campo|regra|opcao|filtro|coluna)' THEN
    v_factor := 'A';
    v_source := 'explicit_rule';
    v_confidence := 0.7800;
    v_reason := 'A HU contém evidência explícita de alteração de capacidade existente.';
  ELSIF v_story_text ~ '(nova funcionalidade|novo processo|nova tela|novo servico|criar|implementar|disponibilizar|cadastrar|adicionar nova|incluir nova)' THEN
    v_factor := 'I';
    v_source := 'explicit_rule';
    v_confidence := 0.8000;
    v_reason := 'A HU contém evidência de nova capacidade de negócio.';
  ELSE
    v_factor := 'I';
    v_source := 'conservative_default';
    v_confidence := 0.5500;
    v_review := true;
    v_reason := concat(
      'Sem evidência suficiente para alteração. Aplicada Inclusão como padrão conservador; ',
      'o fator originalmente sugerido foi ', coalesce(upper(p_proposed_factor), 'N/A'), '.'
    );
  END IF;

  RETURN jsonb_build_object(
    'factor_sigla', v_factor,
    'source', v_source,
    'confidence', v_confidence,
    'review_required', v_review,
    'reasoning', v_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_apf_factor_decision(UUID, UUID, TEXT)
  TO authenticated, service_role;

-- Unifica a precedência oficial com a nova memória de decisões. O trigger
-- anterior é removido para não haver duas políticas concorrentes.
DROP TRIGGER IF EXISTS trg_apf_official_factor_analysis_run
  ON public.apf_process_analysis_runs;

CREATE OR REPLACE FUNCTION public.apply_apf_counting_brain_factor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decision JSONB;
BEGIN
  NEW.suggested_factor_sigla := coalesce(
    NEW.suggested_factor_sigla,
    nullif(upper(NEW.inferred_factor_sigla), '')
  );

  v_decision := public.resolve_apf_factor_decision(
    NEW.project_id,
    NEW.story_id,
    NEW.suggested_factor_sigla
  );

  NEW.inferred_factor_sigla := coalesce(
    nullif(upper(v_decision->>'factor_sigla'), ''),
    NEW.suggested_factor_sigla,
    'I'
  );
  NEW.factor_source := coalesce(v_decision->>'source', 'legacy');
  NEW.factor_confidence := coalesce((v_decision->>'confidence')::numeric, 0.5);
  NEW.factor_review_required := coalesce((v_decision->>'review_required')::boolean, false);
  NEW.factor_reasoning := nullif(v_decision->>'reasoning', '');

  NEW.status_reason := concat_ws(
    ' ',
    nullif(NEW.factor_reasoning, ''),
    nullif(NEW.status_reason, '')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apf_counting_brain_factor
  ON public.apf_process_analysis_runs;
CREATE TRIGGER trg_apf_counting_brain_factor
BEFORE INSERT OR UPDATE OF inferred_factor_sigla
ON public.apf_process_analysis_runs
FOR EACH ROW
EXECUTE FUNCTION public.apply_apf_counting_brain_factor();

-- --------------------------------------------------------------------------
-- 4. Política conservadora de seleção de processos
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_apf_conservative_process_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_primary_process_id UUID;
BEGIN
  -- Executa somente na primeira consolidação da análise. Depois da decisão
  -- humana, o RPC resolve_apf_process_analysis continua soberano.
  IF OLD.process_count = 0 AND NEW.process_count > 0 THEN
    SELECT process.id
    INTO v_primary_process_id
    FROM public.apf_process_analysis_items process
    WHERE process.analysis_run_id = NEW.id
    ORDER BY
      CASE WHEN process.is_central THEN 0 ELSE 1 END,
      CASE WHEN process.selected_baseline_item_id IS NOT NULL THEN 0 ELSE 1 END,
      process.confidence DESC NULLS LAST,
      process.sort_order
    LIMIT 1;

    UPDATE public.apf_process_analysis_items process
    SET selected_by_default = process.id = v_primary_process_id,
        should_count = process.id = v_primary_process_id,
        decision_source = CASE
          WHEN process.id = v_primary_process_id THEN 'policy_default'
          ELSE 'candidate_only'
        END,
        updated_at = now()
    WHERE process.analysis_run_id = NEW.id;

    NEW.countable_process_count := CASE WHEN v_primary_process_id IS NULL THEN 0 ELSE 1 END;

    IF NEW.process_count > 1 THEN
      NEW.status := 'review_required';
      NEW.review_process_count := greatest(NEW.review_process_count, 1);
      NEW.status_reason := concat_ws(
        ' ',
        format(
          '%s processos candidatos foram identificados; somente o processo principal foi pré-selecionado. Os demais permanecem visíveis para decisão humana.',
          NEW.process_count
        ),
        nullif(NEW.status_reason, '')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apf_conservative_process_defaults
  ON public.apf_process_analysis_runs;
CREATE TRIGGER trg_apf_conservative_process_defaults
BEFORE UPDATE OF process_count, countable_process_count, review_process_count, status
ON public.apf_process_analysis_runs
FOR EACH ROW
EXECUTE FUNCTION public.apply_apf_conservative_process_defaults();

-- --------------------------------------------------------------------------
-- 5. Aprendizado: registra sugestão versus decisão humana
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_apf_process_learning_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id UUID;
  v_suggested_count INT;
  v_confirmed_count INT;
  v_decisions JSONB;
BEGIN
  IF OLD.status = 'review_required' AND NEW.status IN ('ok', 'counted') THEN
    SELECT project.team_id
    INTO v_team_id
    FROM public.projects project
    WHERE project.id = NEW.project_id;

    SELECT
      count(*) FILTER (WHERE process.selected_by_default),
      count(*) FILTER (WHERE process.should_count),
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
    INTO v_suggested_count, v_confirmed_count, v_decisions
    FROM public.apf_process_analysis_items process
    WHERE process.analysis_run_id = NEW.id;

    INSERT INTO public.apf_process_learning_events(
      project_id,
      team_id,
      story_id,
      analysis_run_id,
      event_type,
      suggested_process_count,
      confirmed_process_count,
      suggested_factor_sigla,
      confirmed_factor_sigla,
      factor_source,
      factor_confidence,
      process_decisions,
      decided_by
    ) VALUES (
      NEW.project_id,
      v_team_id,
      NEW.story_id,
      NEW.id,
      'analysis_confirmed',
      coalesce(v_suggested_count, 0),
      coalesce(v_confirmed_count, 0),
      NEW.suggested_factor_sigla,
      NEW.inferred_factor_sigla,
      NEW.factor_source,
      NEW.factor_confidence,
      v_decisions,
      auth.uid()
    );

    NEW.confirmed_factor_sigla := NEW.inferred_factor_sigla;
    NEW.confirmed_by := auth.uid();
    NEW.confirmed_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apf_log_process_learning_decision
  ON public.apf_process_analysis_runs;
CREATE TRIGGER trg_apf_log_process_learning_decision
BEFORE UPDATE OF status
ON public.apf_process_analysis_runs
FOR EACH ROW
EXECUTE FUNCTION public.log_apf_process_learning_decision();

-- --------------------------------------------------------------------------
-- 6. Métrica operacional de aprendizado de granularidade
-- --------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_apf_process_learning_accuracy AS
SELECT
  date_trunc('week', event.created_at)::date AS week,
  event.team_id,
  event.project_id,
  count(*) AS total_analyses,
  sum(CASE WHEN event.suggested_process_count = event.confirmed_process_count THEN 1 ELSE 0 END) AS exact_process_count,
  round(
    avg(CASE WHEN event.suggested_process_count = event.confirmed_process_count THEN 1.0 ELSE 0.0 END) * 100,
    1
  ) AS process_count_accuracy_pct,
  round(avg(abs(event.confirmed_process_count - event.suggested_process_count)::numeric), 2) AS mean_absolute_process_error,
  sum(CASE WHEN event.confirmed_process_count > event.suggested_process_count THEN 1 ELSE 0 END) AS under_split_count,
  sum(CASE WHEN event.confirmed_process_count < event.suggested_process_count THEN 1 ELSE 0 END) AS over_split_count
FROM public.apf_process_learning_events event
GROUP BY 1, 2, 3;

GRANT SELECT ON public.v_apf_process_learning_accuracy TO authenticated;

-- --------------------------------------------------------------------------
-- 7. Backfill seguro de metadados, sem rematerializar contagens existentes
-- --------------------------------------------------------------------------
UPDATE public.apf_process_analysis_items
SET selected_by_default = is_central AND should_count,
    decision_source = CASE
      WHEN is_central AND should_count THEN 'legacy_central'
      ELSE 'legacy'
    END
WHERE decision_source = 'ai';

-- Reexecuta somente a resolução do fator para preencher a fonte e a confiança.
-- Não altera apf_counting_items nem os totais já materializados.
UPDATE public.apf_process_analysis_runs
SET inferred_factor_sigla = inferred_factor_sigla,
    updated_at = now()
WHERE factor_source = 'legacy';
