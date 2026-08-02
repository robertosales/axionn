DROP POLICY IF EXISTS apf_gray_zones_all ON public.apf_gray_zones;
CREATE POLICY apf_gray_zones_all ON public.apf_gray_zones
  FOR ALL TO authenticated
  USING (public.apf_can_access_session(session_id))
  WITH CHECK (public.apf_can_manage_session(session_id));

DROP POLICY IF EXISTS okr_objectives_write ON public.okr_objectives;
CREATE POLICY okr_objectives_write ON public.okr_objectives
  FOR ALL TO authenticated
  USING (
    auth.uid() = owner_id
    OR team_id IN (SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = owner_id
    OR team_id IN (SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid())
  );

DROP POLICY IF EXISTS okr_key_results_write ON public.okr_key_results;
CREATE POLICY okr_key_results_write ON public.okr_key_results
  FOR ALL TO authenticated
  USING (
    objective_id IN (
      SELECT o.id FROM public.okr_objectives o
      WHERE o.owner_id = auth.uid()
         OR o.team_id IN (SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid())
    )
  )
  WITH CHECK (
    objective_id IN (
      SELECT o.id FROM public.okr_objectives o
      WHERE o.owner_id = auth.uid()
         OR o.team_id IN (SELECT tm.team_id FROM public.team_members tm WHERE tm.user_id = auth.uid())
    )
  );