-- Sala Ágil: permitir update por qualquer membro do time
DROP POLICY IF EXISTS user_stories_update ON public.user_stories;
CREATE POLICY user_stories_update ON public.user_stories
  FOR UPDATE
  USING (can_view_team(auth.uid(), team_id))
  WITH CHECK (can_view_team(auth.uid(), team_id));

-- Sustentação: permitir update por qualquer membro do time
DROP POLICY IF EXISTS demandas_update_manager_or_responsible ON public.demandas;
CREATE POLICY demandas_update_team_member ON public.demandas
  FOR UPDATE
  USING (can_view_team(auth.uid(), team_id))
  WITH CHECK (can_view_team(auth.uid(), team_id));
