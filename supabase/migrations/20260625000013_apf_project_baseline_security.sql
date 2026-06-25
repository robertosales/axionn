-- ============================================================
-- APF — RLS para catálogo de pesos e histórico de recálculos.
-- As gravações continuam restritas às funções SECURITY DEFINER.
-- ============================================================

ALTER TABLE public.apf_function_type_weights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS apf_function_type_weights_select
  ON public.apf_function_type_weights;
CREATE POLICY apf_function_type_weights_select
ON public.apf_function_type_weights
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.apf_counting_models model
    JOIN public.projects project ON project.contract_id = model.contract_id
    WHERE model.id = apf_function_type_weights.model_id
      AND (
        public.is_team_member(auth.uid(), project.team_id)
        OR public.has_role(auth.uid(), 'admin')
      )
  )
);

ALTER TABLE public.apf_recalculation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS apf_recalculation_events_select
  ON public.apf_recalculation_events;
CREATE POLICY apf_recalculation_events_select
ON public.apf_recalculation_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.projects project
    WHERE project.id = apf_recalculation_events.project_id
      AND (
        public.is_team_member(auth.uid(), project.team_id)
        OR public.has_role(auth.uid(), 'admin')
      )
  )
);
