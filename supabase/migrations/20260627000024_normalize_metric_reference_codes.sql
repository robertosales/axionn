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
   AND regexp_replace(history.reference_code, '^HU0*', 'HU')
     = concat('HU', context.hu_number)
  LIMIT 1;
$$;
