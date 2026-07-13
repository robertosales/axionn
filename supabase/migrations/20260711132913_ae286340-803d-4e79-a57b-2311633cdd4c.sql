
DROP POLICY IF EXISTS ai_briefing_runs_member_select ON public.ai_briefing_runs;
CREATE POLICY ai_briefing_runs_member_select ON public.ai_briefing_runs
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.ai_briefings briefing
  WHERE briefing.id = ai_briefing_runs.briefing_id
    AND public.can_access_ai_briefing(briefing.org_id, briefing.team_id)
));

DROP POLICY IF EXISTS ai_briefing_suggestions_member_select ON public.ai_briefing_suggestions;
CREATE POLICY ai_briefing_suggestions_member_select ON public.ai_briefing_suggestions
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.ai_briefings briefing
  WHERE briefing.id = ai_briefing_suggestions.briefing_id
    AND public.can_access_ai_briefing(briefing.org_id, briefing.team_id)
));

DROP POLICY IF EXISTS ai_suggestion_evidence_member_select ON public.ai_suggestion_evidence;
CREATE POLICY ai_suggestion_evidence_member_select ON public.ai_suggestion_evidence
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.ai_briefing_suggestions suggestion
  JOIN public.ai_briefings briefing ON briefing.id = suggestion.briefing_id
  WHERE suggestion.id = ai_suggestion_evidence.suggestion_id
    AND public.can_access_ai_briefing(briefing.org_id, briefing.team_id)
));

DROP POLICY IF EXISTS ai_suggestion_applications_member_select ON public.ai_suggestion_applications;
CREATE POLICY ai_suggestion_applications_member_select ON public.ai_suggestion_applications
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1
  FROM public.ai_briefing_suggestions suggestion
  JOIN public.ai_briefings briefing ON briefing.id = suggestion.briefing_id
  WHERE suggestion.id = ai_suggestion_applications.suggestion_id
    AND public.can_access_ai_briefing(briefing.org_id, briefing.team_id)
));
