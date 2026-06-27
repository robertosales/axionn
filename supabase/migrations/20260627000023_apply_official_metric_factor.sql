-- Official metric history overrides generic impact-factor inference.
ALTER TABLE public.apf_metric_factor_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.apf_metric_factor_history FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_apf_metric_history_for_story(
  p_project_id UUID,
  p_story_id UUID
)
RETURNS public.apf_metric_factor_history
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH context AS (
    SELECT
      CASE
        WHEN public.normalize_apf_text(coalesce(
          baseline.source_summary->>'system_name', project.name
        )) LIKE '%gesp3%'
          OR public.normalize_apf_text(coalesce(
            baseline.source_summary->>'system_name', project.name
          )) LIKE '%gesp 03%'
          THEN 'GESP3'
        ELSE upper(regexp_replace(coalesce(project.name, ''), '[^A-Za-z0-9]+', '', 'g'))
      END AS system_key,
      (regexp_match(
        story.title,
        '\mHU[[:space:]]*0*([0-9]+(?:\.[0-9]+)?)\M',
        'i'
      ))[1] AS hu_number
    FROM public.projects project
    JOIN public.user_stories story
      ON story.id = p_story_id
     AND story.team_id = project.team_id
    LEFT JOIN LATERAL (
      SELECT source_summary
      FROM public.apf_project_baselines baseline
      WHERE baseline.project_id = project.id
        AND baseline.status = 'active'
        AND baseline.deleted_at IS NULL
      ORDER BY baseline.created_at DESC
      LIMIT 1
    ) baseline ON true
    WHERE project.id = p_project_id
  )
  SELECT history.*
  FROM context
  JOIN public.apf_metric_factor_history history
    ON history.system_key = context.system_key
   AND history.reference_code = concat('HU', context.hu_number)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.apply_apf_official_factor_to_analysis_run()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_history public.apf_metric_factor_history%ROWTYPE;
BEGIN
  SELECT * INTO v_history
  FROM public.get_apf_metric_history_for_story(NEW.project_id, NEW.story_id);

  IF v_history.id IS NOT NULL THEN
    NEW.inferred_factor_sigla := v_history.factor_sigla;
    NEW.status_reason := concat_ws(
      ' ',
      format(
        'Precedente oficial %s: %s/%s, PF Bruto %s e PF Simples %s.',
        v_history.reference_code,
        v_history.function_sigla,
        v_history.factor_sigla,
        to_char(v_history.pf_bruto, 'FM999990.00'),
        to_char(v_history.pf_fs, 'FM999990.00')
      ),
      nullif(NEW.status_reason, '')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apf_official_factor_analysis_run
  ON public.apf_process_analysis_runs;
CREATE TRIGGER trg_apf_official_factor_analysis_run
BEFORE INSERT OR UPDATE OF inferred_factor_sigla
ON public.apf_process_analysis_runs
FOR EACH ROW
EXECUTE FUNCTION public.apply_apf_official_factor_to_analysis_run();

CREATE OR REPLACE FUNCTION public.apply_apf_non_measurable_to_analysis_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_factor TEXT;
BEGIN
  SELECT run.inferred_factor_sigla
  INTO v_factor
  FROM public.apf_process_analysis_runs run
  WHERE run.id = NEW.analysis_run_id;

  IF v_factor = 'N/A' THEN
    NEW.should_count := false;
    NEW.recommendation := 'do_not_send';
    NEW.review_required := false;
    NEW.is_complete := false;
    NEW.is_independent := false;
    NEW.selected_baseline_item_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apf_non_measurable_analysis_item
  ON public.apf_process_analysis_items;
CREATE TRIGGER trg_apf_non_measurable_analysis_item
BEFORE INSERT OR UPDATE
ON public.apf_process_analysis_items
FOR EACH ROW
EXECUTE FUNCTION public.apply_apf_non_measurable_to_analysis_item();
