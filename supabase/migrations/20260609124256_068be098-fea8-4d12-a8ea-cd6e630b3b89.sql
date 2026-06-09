-- Restrict contract_slas writes to admins only; team members keep read access
DROP POLICY IF EXISTS "Manage contract_slas based on team membership" ON public.contract_slas;
DROP POLICY IF EXISTS "contract_slas_delete" ON public.contract_slas;

CREATE POLICY "contract_slas_select_team_members"
ON public.contract_slas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM contract_room_teams crt
    JOIN team_members tm ON tm.team_id = crt.team_id
    WHERE crt.contract_id = contract_slas.contract_id
      AND tm.user_id = auth.uid()
  )
);

CREATE POLICY "contract_slas_insert_admin"
ON public.contract_slas
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "contract_slas_update_admin"
ON public.contract_slas
FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "contract_slas_delete_admin"
ON public.contract_slas
FOR DELETE
TO authenticated
USING (public.is_admin());