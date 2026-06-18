DROP POLICY IF EXISTS "Member update own demanda_hours" ON public.demanda_hours;

CREATE POLICY "Member update own demanda_hours"
ON public.demanda_hours
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());