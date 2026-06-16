
-- Permitir leitura de workflow_columns por membros do time
CREATE POLICY "members can select workflow_columns"
  ON public.workflow_columns FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid(), team_id) OR public.is_team_in_user_contracts(auth.uid(), team_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_columns TO authenticated;
GRANT ALL ON public.workflow_columns TO service_role;

-- Permitir leitura do workflow global de Sustentação por qualquer autenticado
CREATE POLICY "authenticated can select sustentacao_workflow_steps"
  ON public.sustentacao_workflow_steps FOR SELECT TO authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sustentacao_workflow_steps TO authenticated;
GRANT ALL ON public.sustentacao_workflow_steps TO service_role;
