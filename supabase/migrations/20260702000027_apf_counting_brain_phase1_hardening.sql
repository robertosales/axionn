-- ============================================================
-- APF/PFS — hardening da fase 1 do cérebro de contagem.
--
-- Diferencia processos identificados, pré-selecionados e confirmados e
-- impede que um candidato explicitamente não contável seja marcado.
-- ============================================================

ALTER TABLE public.apf_process_learning_events
  ADD COLUMN IF NOT EXISTS identified_process_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_selected_process_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.apf_process_learning_events.identified_process_count IS
  'Quantidade total de processos candidatos identificados pela análise.';
COMMENT ON COLUMN public.apf_process_learning_events.default_selected_process_count IS
  'Quantidade pré-selecionada pela política conservadora antes da decisão humana.';

CREATE OR REPLACE FUNCTION public.apply_apf_conservative_process_defaults()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_primary_process_id UUID;
BEGIN
  IF OLD.process_count = 0 AND NEW.process_count > 0 THEN
    SELECT process.id
    INTO v_primary_process_id
    FROM public.apf_process_analysis_items process
    WHERE process.analysis_run_id = NEW.id
      AND (
        process.should_count = true
        OR process.recommendation IN ('send', 'send_with_validation')
      )
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
          '%s processos candidatos foram identificados; somente o processo principal elegível foi pré-selecionado. Os demais permanecem visíveis para decisão humana.',
          NEW.process_count
        ),
        nullif(NEW.status_reason, '')
      );
    ELSIF v_primary_process_id IS NULL THEN
      NEW.status := 'review_required';
      NEW.review_process_count := greatest(NEW.review_process_count, 1);
      NEW.status_reason := concat_ws(
        ' ',
        'Nenhum processo elegível pôde ser pré-selecionado; a decisão humana é obrigatória.',
        nullif(NEW.status_reason, '')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_apf_process_learning_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id UUID;
  v_default_count INT;
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
    INTO v_default_count, v_confirmed_count, v_decisions
    FROM public.apf_process_analysis_items process
    WHERE process.analysis_run_id = NEW.id;

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
      NEW.process_count,
      coalesce(v_default_count, 0),
      coalesce(v_default_count, 0),
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

CREATE OR REPLACE VIEW public.v_apf_process_learning_accuracy AS
SELECT
  date_trunc('week', event.created_at)::date AS week,
  event.team_id,
  event.project_id,
  count(*) AS total_analyses,
  sum(CASE
    WHEN event.default_selected_process_count = event.confirmed_process_count THEN 1
    ELSE 0
  END) AS exact_default_selection,
  round(
    avg(CASE
      WHEN event.default_selected_process_count = event.confirmed_process_count THEN 1.0
      ELSE 0.0
    END) * 100,
    1
  ) AS default_selection_accuracy_pct,
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
  END) AS user_removed_default_processes
FROM public.apf_process_learning_events event
GROUP BY 1, 2, 3;

GRANT SELECT ON public.v_apf_process_learning_accuracy TO authenticated;
