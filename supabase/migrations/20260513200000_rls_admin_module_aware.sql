-- ============================================
-- FIX RLS: Admin ciente de módulo (module-aware)
-- Substitui a política genérica anterior por uma
-- que respeita o module_access do admin:
--
--   admin ambos       → vê TODOS os usuários
--   admin sala_agil   → vê apenas sala_agil + ambos
--   admin sustentacao → vê apenas sustentacao + ambos
--
-- IMPORTANTE: Execute esta migration DEPOIS de:
--   20260513190000_rls_admin_select_all_profiles.sql
-- ============================================

-- Remove políticas anteriores genéricas
DROP POLICY IF EXISTS "admin_select_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "admin_update_all_profiles" ON public.profiles;

-- Política SELECT: admin vê usuários do seu módulo
CREATE POLICY "admin_select_module_profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles ap ON ap.user_id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
      AND (
        ap.module_access = 'ambos'                        -- admin ambos vê tudo
        OR ap.module_access = profiles.module_access      -- admin vê seu próprio módulo
        OR profiles.module_access = 'ambos'               -- usuários "ambos" são visíveis para qualquer admin
      )
  )
);

-- Política UPDATE: admin atualiza usuários do seu módulo
CREATE POLICY "admin_update_module_profiles"
ON public.profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles ap ON ap.user_id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
      AND (
        ap.module_access = 'ambos'
        OR ap.module_access = profiles.module_access
        OR profiles.module_access = 'ambos'
      )
  )
);
