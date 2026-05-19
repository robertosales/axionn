-- ============================================================
-- Migration: 20260519150000_profiles_rls_team_members
-- Objetivo : Permite que membros de um mesmo time vejam os
--            profiles uns dos outros (necessário para carregar
--            participantes da RDM por time).
--
-- Impacto  : Membros só vêem profiles de quem está no mesmo
--            time. Não expõe profiles de times diferentes.
-- ============================================================

DROP POLICY IF EXISTS "team_members_can_view_profiles" ON public.profiles;

CREATE POLICY "team_members_can_view_profiles"
ON public.profiles
FOR SELECT
USING (
  -- Próprio perfil
  user_id = auth.uid()
  OR
  -- Perfil de outro membro do mesmo time
  user_id IN (
    SELECT tm2.user_id
    FROM public.team_members tm1
    JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = auth.uid()
  )
  OR
  -- Admin vê todos
  public.has_role(auth.uid(), 'admin')
);
