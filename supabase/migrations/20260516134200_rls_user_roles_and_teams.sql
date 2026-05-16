-- =============================================================
-- MIGRATION: RLS para user_roles e teams
-- Data: 2026-05-16
-- Descrição:
--   Habilita Row Level Security nas tabelas user_roles e teams,
--   garantindo que apenas admins possam modificar roles e que
--   usuários comuns só vejam dados acessíveis ao seu contexto.
-- Rollback: supabase/migrations/20260516134201_rollback_rls_user_roles_and_teams.sql
-- =============================================================

-- ───────────────────────────────────────────────────────────────
-- Função auxiliar: verifica se o usuário autenticado tem role admin
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  );
$$;

-- ───────────────────────────────────────────────────────────────
-- Tabela: user_roles
-- ───────────────────────────────────────────────────────────────
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Admins veem tudo; usuários comuns só veem o próprio registro
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
CREATE POLICY "user_roles_select"
  ON public.user_roles
  FOR SELECT
  USING (
    public.is_admin()
    OR user_id = auth.uid()
  );

-- Apenas admins podem inserir roles
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
CREATE POLICY "user_roles_insert"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (public.is_admin());

-- Apenas admins podem atualizar roles
DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
CREATE POLICY "user_roles_update"
  ON public.user_roles
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Apenas admins podem remover roles
DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;
CREATE POLICY "user_roles_delete"
  ON public.user_roles
  FOR DELETE
  USING (public.is_admin());

-- ───────────────────────────────────────────────────────────────
-- Tabela: teams
-- ───────────────────────────────────────────────────────────────
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Admins veem todos os times;
-- usuários comuns veem apenas os times dos quais fazem parte
DROP POLICY IF EXISTS "teams_select" ON public.teams;
CREATE POLICY "teams_select"
  ON public.teams
  FOR SELECT
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.team_members tm
      WHERE tm.team_id = teams.id
        AND tm.user_id = auth.uid()
    )
  );

-- Apenas admins podem criar times
DROP POLICY IF EXISTS "teams_insert" ON public.teams;
CREATE POLICY "teams_insert"
  ON public.teams
  FOR INSERT
  WITH CHECK (public.is_admin());

-- Apenas admins podem editar times
DROP POLICY IF EXISTS "teams_update" ON public.teams;
CREATE POLICY "teams_update"
  ON public.teams
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Apenas admins podem excluir times
DROP POLICY IF EXISTS "teams_delete" ON public.teams;
CREATE POLICY "teams_delete"
  ON public.teams
  FOR DELETE
  USING (public.is_admin());
