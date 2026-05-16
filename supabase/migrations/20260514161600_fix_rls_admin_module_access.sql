-- ============================================
-- FIX: RLS admin profiles - deadlock de JOIN recursivo
-- Problema: admin_select_module_profiles usava JOIN em profiles
--           para ler module_access do próprio admin, mas o RLS
--           bloqueava esse JOIN silenciosamente → retornava [] sem erro.
-- Solução:  função SECURITY DEFINER que lê module_access sem RLS,
--           eliminando o JOIN problemático. Lógica de negócio idêntica.
-- Impacto:  ZERO — profiles_select_own não é alterada.
--           Usuário comum continua vendo só o próprio perfil.
-- ============================================

-- 1. Função auxiliar: retorna module_access do usuário logado (bypass RLS seguro)
CREATE OR REPLACE FUNCTION public.get_my_module_access()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT module_access FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 2. Recria policy SELECT (mesma lógica de módulo, sem JOIN recursivo)
DROP POLICY IF EXISTS "admin_select_module_profiles" ON public.profiles;

CREATE POLICY "admin_select_module_profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
  AND (
    public.get_my_module_access() = 'ambos'
    OR public.get_my_module_access() = profiles.module_access
    OR profiles.module_access = 'ambos'
  )
);

-- 3. Recria policy UPDATE (mesma lógica de módulo, sem JOIN recursivo)
DROP POLICY IF EXISTS "admin_update_module_profiles" ON public.profiles;

CREATE POLICY "admin_update_module_profiles"
ON public.profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
  AND (
    public.get_my_module_access() = 'ambos'
    OR public.get_my_module_access() = profiles.module_access
    OR profiles.module_access = 'ambos'
  )
);
