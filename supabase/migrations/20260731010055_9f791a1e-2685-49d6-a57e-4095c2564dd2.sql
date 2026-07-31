-- Helper: models visible to the caller (tenant-scoped, same rule as apf_counting_models policies)
CREATE OR REPLACE FUNCTION public.apf_can_access_model(_model_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.apf_counting_models m
    JOIN public.contracts c ON c.id = m.contract_id
    WHERE m.id = _model_id
      AND (c.org_id = ANY (public.my_org_ids()) OR c.org_id IS NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.apf_can_access_session(_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.apf_counting_sessions s
    JOIN public.projects p ON p.id = s.project_id
    JOIN public.contracts c ON c.id = p.contract_id
    WHERE s.id = _session_id
      AND (c.org_id = ANY (public.my_org_ids()) OR c.org_id IS NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.apf_can_access_baseline(_baseline_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.apf_project_baselines b
    JOIN public.projects p ON p.id = b.project_id
    JOIN public.contracts c ON c.id = p.contract_id
    WHERE b.id = _baseline_id
      AND (c.org_id = ANY (public.my_org_ids()) OR c.org_id IS NULL)
  );
$$;

GRANT EXECUTE ON FUNCTION public.apf_can_access_model(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apf_can_access_session(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apf_can_access_baseline(uuid) TO authenticated, service_role;

-- Model-scoped tables
DROP POLICY IF EXISTS apf_rules_all ON public.apf_counting_rules;
CREATE POLICY apf_rules_all ON public.apf_counting_rules FOR ALL TO authenticated
  USING (public.apf_can_access_model(model_id))
  WITH CHECK (public.apf_can_access_model(model_id));

DROP POLICY IF EXISTS apf_func_types_all ON public.apf_function_types;
CREATE POLICY apf_func_types_all ON public.apf_function_types FOR ALL TO authenticated
  USING (public.apf_can_access_model(model_id))
  WITH CHECK (public.apf_can_access_model(model_id));

DROP POLICY IF EXISTS apf_categories_all ON public.apf_categories;
CREATE POLICY apf_categories_all ON public.apf_categories FOR ALL TO authenticated
  USING (public.apf_can_access_model(model_id))
  WITH CHECK (public.apf_can_access_model(model_id));

DROP POLICY IF EXISTS apf_factors_all ON public.apf_impact_factors;
CREATE POLICY apf_factors_all ON public.apf_impact_factors FOR ALL TO authenticated
  USING (public.apf_can_access_model(model_id))
  WITH CHECK (public.apf_can_access_model(model_id));

DROP POLICY IF EXISTS apf_templates_all ON public.apf_output_templates;
CREATE POLICY apf_templates_all ON public.apf_output_templates FOR ALL TO authenticated
  USING (public.apf_can_access_model(model_id))
  WITH CHECK (public.apf_can_access_model(model_id));

-- Session-scoped
DROP POLICY IF EXISTS apf_items_all ON public.apf_counting_items;
CREATE POLICY apf_items_all ON public.apf_counting_items FOR ALL TO authenticated
  USING (public.apf_can_access_session(session_id))
  WITH CHECK (public.apf_can_access_session(session_id));

-- Baseline-scoped
DROP POLICY IF EXISTS apf_baseline_items_all ON public.apf_baseline_items;
CREATE POLICY apf_baseline_items_all ON public.apf_baseline_items FOR ALL TO authenticated
  USING (public.apf_can_access_baseline(baseline_id))
  WITH CHECK (public.apf_can_access_baseline(baseline_id));