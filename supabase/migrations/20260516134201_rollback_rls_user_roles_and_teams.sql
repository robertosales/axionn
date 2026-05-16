-- =============================================================
-- ROLLBACK: Remove RLS de user_roles e teams
-- Data: 2026-05-16
-- Uso: Execute este arquivo no SQL Editor do Supabase se a
--      migration 20260516134200 causar regressão.
-- Tempo estimado de execução: < 5 segundos
-- =============================================================

-- ── user_roles ───────────────────────────────────────────────
DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- ── teams ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "teams_select"  ON public.teams;
DROP POLICY IF EXISTS "teams_insert"  ON public.teams;
DROP POLICY IF EXISTS "teams_update"  ON public.teams;
DROP POLICY IF EXISTS "teams_delete"  ON public.teams;
ALTER TABLE public.teams DISABLE ROW LEVEL SECURITY;

-- Mantém a função is_admin() — ela não causa problemas sozinha.
-- Se quiser remover também:
-- DROP FUNCTION IF EXISTS public.is_admin();
