-- ============================================================
-- APF/PFS — precedência efetiva do fator oficial.
--
-- Corrige dois pontos que faziam HU213 voltar de I para A:
-- 1. A resolução do histórico dependia excessivamente do system_key do projeto.
-- 2. save_contractual_counting_items sobrescrevia o fator enviado pela análise
--    com factor_sigla da linha da baseline.
-- ============================================================

CREATE OR REPLACE FUNCTION public.normalize_apf_metric_reference(p_value TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_match TEXT[];
BEGIN
  v_match := regexp_match(
    coalesce(p_value, ''),
    '\mHU[[:space:]]*[-]?[[:space:]]*0*([0-9]+)([.][0-9]+)?\M',
    'i'
  );

  IF v_match IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN concat(
    'HU',
    (v_match[1]::bigint)::text,
    coalesce(v_match[2], '')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_apf_metric_history_for_story(
  p_project_id UUID,
  p_story_id UUID
)
RETURNS public.apf_metric_factor_history
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reference_code TEXT;
  v_system_key TEXT;
  v_system_text TEXT;
  v_system_count INT;
  v_result public.apf_metric_factor_history%ROWTYPE;
BEGIN
  SELECT
    public.normalize_apf_metric_reference(
      concat_ws(
        E'\n',
        story.title,
        story.description,
        story.acceptance_criteria
      )
    ),
    concat_ws(
      ' ',
      project.name,
      baseline.label,
      baseline.source_file_name,
      baseline.source_summary::text
    )
  INTO v_reference_code, v_system_text
  FROM public.projects project
  JOIN public.user_stories story
    ON story.id = p_story_id
   AND story.team_id = project.team_id
  LEFT JOIN LATERAL (
    SELECT
      candidate.label,
      candidate.source_file_name,
      candidate.source_summary
    FROM public.apf_project_baselines candidate
    WHERE candidate.project_id = project.id
      AND candidate.status = 'active'
      AND candidate.deleted_at IS NULL
    ORDER BY candidate.created_at DESC
    LIMIT 1
  ) baseline ON true
  WHERE project.id = p_project_id;

  IF v_reference_code IS NULL THEN
    RETURN NULL;
  END IF;

  v_system_key := CASE
    WHEN replace(public.normalize_apf_text(v_system_text), ' ', '') LIKE '%gesp3%'
      THEN 'GESP3'
    ELSE upper(regexp_replace(coalesce(v_system_text, ''), '[^A-Za-z0-9]+', '', 'g'))
  END;

  SELECT history.*
  INTO v_result
  FROM public.apf_metric_factor_history history
  WHERE public.normalize_apf_metric_reference(history.reference_code) = v_reference_code
    AND history.system_key = v_system_key
  ORDER BY history.created_at DESC
  LIMIT 1;

  IF v_result.id IS NOT NULL THEN
    RETURN v_result;
  END IF;

  SELECT count(DISTINCT history.system_key)
  INTO v_system_count
  FROM public.apf_metric_factor_history history
  WHERE public.normalize_apf_metric_reference(history.reference_code) = v_reference_code;

  IF v_system_count = 1 THEN
    SELECT history.*
    INTO v_result
    FROM public.apf_metric_factor_history history
    WHERE public.normalize_apf_metric_reference(history.reference_code) = v_reference_code
    ORDER BY history.created_at DESC
    LIMIT 1;

    RETURN v_result;
  END IF;

  RETURN NULL;
END;
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
  SELECT *
  INTO v_history
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

-- A materialização envia o fator resolvido pela análise. A baseline continua
-- sendo a fonte da identidade funcional, mas não pode sobrescrever o impacto
-- oficial de I/A/A75/A90/E recebido no payload.
DO $$
DECLARE
  v_definition TEXT;
  v_original TEXT;
BEGIN
  SELECT pg_get_functiondef(
    'public.save_contractual_counting_items(uuid,uuid,jsonb,text)'::regprocedure
  )
  INTO v_definition;

  v_original := v_definition;

  v_definition := replace(
    v_definition,
    E'v_factor_sigla := coalesce(v_baseline_item.factor_sigla, ''N/A'');',
    E'v_factor_sigla := upper(coalesce(\n        nullif(v_item->>''factor_sigla'', ''''),\n        nullif(v_baseline_item.factor_sigla, ''''),\n        ''N/A''\n      ));'
  );

  IF v_definition = v_original
     AND position(
       'v_factor_sigla := coalesce(v_baseline_item.factor_sigla'
       IN v_definition
     ) > 0 THEN
    RAISE EXCEPTION
      'Não foi possível remover a sobrescrita do fator da baseline em save_contractual_counting_items';
  END IF;

  IF v_definition <> v_original THEN
    EXECUTE v_definition;
  END IF;
END $$;

-- Atualiza o fator das análises existentes para facilitar o diagnóstico.
-- Os itens já materializados devem ser gerados novamente pela ação Reanalisar.
UPDATE public.apf_process_analysis_runs run
SET inferred_factor_sigla = (
      SELECT history.factor_sigla
      FROM public.get_apf_metric_history_for_story(run.project_id, run.story_id) history
      LIMIT 1
    ),
    updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM public.get_apf_metric_history_for_story(run.project_id, run.story_id) history
  WHERE history.factor_sigla IS DISTINCT FROM run.inferred_factor_sigla
);
