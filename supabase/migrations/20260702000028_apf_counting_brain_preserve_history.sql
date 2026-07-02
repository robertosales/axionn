-- ============================================================
-- APF/PFS — preservação de histórico materializado.
--
-- O cérebro de contagem deve atuar em novas análises e reanálises explícitas.
-- Análises já materializadas mantêm o fator com que a contagem foi gerada.
-- ============================================================

CREATE OR REPLACE FUNCTION public.apply_apf_counting_brain_factor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_decision JSONB;
BEGIN
  -- Utilizado somente por migrations de preservação histórica. O escopo é a
  -- transação atual e não interfere nas requisições da aplicação.
  IF current_setting('app.apf_preserve_historical_factor', true) = 'on' THEN
    RETURN NEW;
  END IF;

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

SELECT set_config('app.apf_preserve_historical_factor', 'on', true);

UPDATE public.apf_process_analysis_runs
SET inferred_factor_sigla = suggested_factor_sigla,
    confirmed_factor_sigla = coalesce(confirmed_factor_sigla, suggested_factor_sigla),
    factor_source = 'legacy_preserved',
    factor_confidence = NULL,
    factor_review_required = false,
    factor_reasoning = 'Fator histórico preservado porque a análise já havia sido materializada.',
    updated_at = now()
WHERE materialized_at IS NOT NULL
  AND suggested_factor_sigla IS NOT NULL
  AND inferred_factor_sigla IS DISTINCT FROM suggested_factor_sigla;

SELECT set_config('app.apf_preserve_historical_factor', 'off', true);
