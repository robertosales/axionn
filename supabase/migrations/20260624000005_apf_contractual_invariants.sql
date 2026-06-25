-- APF contratual: garante totais consistentes por sessão.

CREATE OR REPLACE FUNCTION public.fn_apf_enforce_session_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_pf_bruto NUMERIC(10,2);
  v_pf_fs NUMERIC(10,2);
  v_functions INT;
  v_hus INT;
BEGIN
  SELECT
    round(coalesce(sum(coalesce(corrected_pf_bruto, pf_bruto)), 0), 2),
    round(coalesce(sum(coalesce(corrected_pf_fs, pf_fs)), 0), 2),
    count(*) FILTER (WHERE coalesce(corrected_pf_fs, pf_fs) > 0)::int
  INTO v_pf_bruto, v_pf_fs, v_functions
  FROM public.apf_counting_items
  WHERE session_id = NEW.id;

  SELECT count(DISTINCT refs.story_id)::int
  INTO v_hus
  FROM public.apf_counting_items item
  CROSS JOIN LATERAL unnest(item.story_ids) AS refs(story_id)
  WHERE item.session_id = NEW.id;

  NEW.total_pf_bruto := coalesce(v_pf_bruto, 0);
  NEW.total_pf_fs := coalesce(v_pf_fs, 0);
  NEW.total_functions := coalesce(v_functions, 0);
  NEW.total_hus := coalesce(v_hus, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apf_enforce_session_totals
  ON public.apf_counting_sessions;

CREATE TRIGGER trg_apf_enforce_session_totals
  BEFORE UPDATE OF total_pf_bruto, total_pf_fs, total_functions, total_hus
  ON public.apf_counting_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_apf_enforce_session_totals();

UPDATE public.apf_impact_factors
SET contribution_pct = contribution_pct * 100
WHERE contribution_pct > 0
  AND contribution_pct <= 1;

UPDATE public.apf_function_types function_type
SET is_active = false
FROM public.apf_counting_models model
WHERE function_type.model_id = model.id
  AND model.standard = 'pfs_dpf'
  AND function_type.sigla IN ('EI', 'EO', 'EQ', 'ILF', 'EIF');
