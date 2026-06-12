-- ============================================================
-- FIX: RLS team_members — SELECT para o próprio membro
--
-- Problema: a função is_team_member() consulta a tabela
-- team_members, mas com RLS ativo e sem policy de SELECT
-- para o próprio usuário, a função sempre retorna false,
-- fazendo o dashboard mostrar "Sem time" para membros comuns.
--
-- Estrutura real: team_members.user_id = auth.users.id (direto)
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. TEAM_MEMBERS — membro vê seus próprios vínculos
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tm_select_own"   ON public.team_members;
DROP POLICY IF EXISTS "tm_select_admin" ON public.team_members;
DROP POLICY IF EXISTS "tm_admin_write"  ON public.team_members;

-- Usuário vê suas próprias linhas (necessário para is_team_member() funcionar)
CREATE POLICY "tm_select_own"
ON public.team_members FOR SELECT
USING (user_id = auth.uid());

-- Admin vê todos
CREATE POLICY "tm_select_admin"
ON public.team_members FOR SELECT
USING (public.is_admin());

-- Admin gerencia tudo
CREATE POLICY "tm_admin_write"
ON public.team_members FOR ALL
USING      (public.is_admin())
WITH CHECK (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 2. TEAMS — membro vê times dos quais faz parte
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teams_select_member" ON public.teams;
DROP POLICY IF EXISTS "teams_select_admin"  ON public.teams;
DROP POLICY IF EXISTS "teams_admin_write"   ON public.teams;

-- Membro vê times onde tem vínculo em team_members
CREATE POLICY "teams_select_member"
ON public.teams FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = teams.id
    AND tm.user_id = auth.uid()
  )
);

-- Admin vê todos os times
CREATE POLICY "teams_select_admin"
ON public.teams FOR SELECT
USING (public.is_admin());

-- Admin gerencia tudo
CREATE POLICY "teams_admin_write"
ON public.teams FOR ALL
USING      (public.is_admin())
WITH CHECK (public.is_admin());

COMMIT;
