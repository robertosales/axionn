-- ============================================
-- FIX: Política RLS para admin visualizar todos os perfis
-- Problema: admin não conseguia ver lista de usuários no Dashboard Admin
-- Causa: a política SELECT em profiles só permitia user_id = auth.uid()
-- ============================================

-- Remove política restritiva existente se houver
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "admin_select_all_profiles" ON public.profiles;

-- Política 1: usuário comum vê apenas o próprio perfil
CREATE POLICY "profiles_select_own"
ON public.profiles
FOR SELECT
USING (user_id = auth.uid());

-- Política 2: admin vê TODOS os perfis
CREATE POLICY "admin_select_all_profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Política 3: admin pode UPDATE em qualquer perfil
DROP POLICY IF EXISTS "admin_update_all_profiles" ON public.profiles;
CREATE POLICY "admin_update_all_profiles"
ON public.profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Garante que as colunas extras existam na tabela profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS module_access TEXT NOT NULL DEFAULT 'sala_agil',
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
