-- ============================================================
-- FIX: RLS profiles — user_id = auth.uid() em vez de id = auth.uid()
--
-- PROBLEMA:
--   A migration 20260516143000_rls_consolidate_is_admin.sql criou
--   as policies de profiles usando "id = auth.uid()", mas a tabela
--   profiles tem duas colunas distintas:
--     • id      — UUID interno gerado (PK da tabela)
--     • user_id — FK para auth.users (= auth.uid() do usuário)
--
--   Como resultado, nenhum usuário com role "member" conseguia
--   ver o próprio perfil, quebrando silenciosamente toda a
--   cadeia de autenticação nas RPCs downstream.
--
-- SOLUÇÃO:
--   Recriar as policies usando "user_id = auth.uid()".
-- ============================================================

-- Remove policies incorretas
DROP POLICY IF EXISTS "profiles_select_own"       ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"       ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"       ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_delete"     ON public.profiles;

-- Usuário: ver e editar apenas o próprio perfil (via user_id)
CREATE POLICY "profiles_select_own"
ON public.profiles FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "profiles_insert_own"
ON public.profiles FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_update_own"
ON public.profiles FOR UPDATE
USING (user_id = auth.uid());

-- Admin: acesso total
CREATE POLICY "profiles_admin_select_all"
ON public.profiles FOR SELECT
USING (public.is_admin());

CREATE POLICY "profiles_admin_update_all"
ON public.profiles FOR UPDATE
USING      (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "profiles_admin_delete"
ON public.profiles FOR DELETE
USING (public.is_admin());
