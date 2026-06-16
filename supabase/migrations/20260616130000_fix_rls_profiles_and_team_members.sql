-- ============================================================
-- FIX RLS: profiles + team_members
--
-- PROBLEMAS CORRIGIDOS:
--
--   1. profiles_select_same_contract — usava contract_id inexistente.
--      SOLUCAO: drop.
--
--   2. team_members: policies fantasmas criadas fora das migrations
--      (tm_admin_write, tm_select_admin, tm_select_own,
--       tm_select_same_contract) substituiram as policies canonicas.
--      tm_select_same_contract usava contract_id inexistente.
--      SOLUCAO: drop de todas as fantasmas, recriar canonicas.
--
--   3. tm_member_insert_self tinha WITH CHECK circular:
--      exigia is_team_member() antes de o usuario ser membro.
--      SOLUCAO: WITH CHECK (user_id = auth.uid()) apenas.
--
--   4. team_members_can_view_profiles — recriada de forma
--      idempotente para garantir consistencia em todos os ambientes.
--
-- ESTADO FINAL ESPERADO:
--   profiles      → 7 policies
--   team_members  → 3 policies (tm_admin_all, tm_member_insert_self,
--                                tm_member_select)
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. PROFILES: remove policy invalida
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_select_same_contract" ON public.profiles;

-- ────────────────────────────────────────────────────────────
-- 2. TEAM_MEMBERS: remove todas as policies fantasmas
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "tm_admin_write"        ON public.team_members;
DROP POLICY IF EXISTS "tm_select_admin"       ON public.team_members;
DROP POLICY IF EXISTS "tm_select_own"         ON public.team_members;
DROP POLICY IF EXISTS "tm_select_same_contract" ON public.team_members;
-- remove tambem a versao anterior do insert (sera recriada corrigida)
DROP POLICY IF EXISTS "tm_member_insert_self" ON public.team_members;
-- remove versao anterior do select canonico (sera recriada)
DROP POLICY IF EXISTS "tm_member_select"      ON public.team_members;

-- ────────────────────────────────────────────────────────────
-- 3. TEAM_MEMBERS: recriar policies canonicas
-- ────────────────────────────────────────────────────────────

-- Membro: pode VER membros do proprio time
CREATE POLICY "tm_member_select"
ON public.team_members
FOR SELECT
USING (public.is_team_member(auth.uid(), team_id));

-- Membro: pode se auto-inserir (aceitar convite / entrar no time)
-- WITH CHECK simples: so o proprio usuario pode se inserir
CREATE POLICY "tm_member_insert_self"
ON public.team_members
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
);

-- ────────────────────────────────────────────────────────────
-- 4. PROFILES: recriar team_members_can_view_profiles (idempotente)
-- ────────────────────────────────────────────────────────────
-- Permite que membros do mesmo time vejam perfis dos colegas.
DROP POLICY IF EXISTS "team_members_can_view_profiles" ON public.profiles;

CREATE POLICY "team_members_can_view_profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.team_members tm1
    JOIN public.team_members tm2
      ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = auth.uid()
      AND tm2.user_id = profiles.user_id
  )
);

COMMIT;

-- ────────────────────────────────────────────────────────────
-- VALIDACAO (executar manualmente no Supabase SQL Editor)
-- ────────────────────────────────────────────────────────────
--
-- SELECT policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('profiles', 'team_members')
-- ORDER BY tablename, policyname;
--
-- ESPERADO (10 linhas no total):
--
-- profiles     | profiles_admin_delete          | DELETE
-- profiles     | profiles_admin_select_all      | SELECT
-- profiles     | profiles_admin_update_all      | UPDATE
-- profiles     | profiles_insert_own            | INSERT
-- profiles     | profiles_select_own            | SELECT
-- profiles     | profiles_update_own            | UPDATE
-- profiles     | team_members_can_view_profiles | SELECT
-- team_members | tm_admin_all                   | ALL
-- team_members | tm_member_insert_self          | INSERT
-- team_members | tm_member_select               | SELECT
