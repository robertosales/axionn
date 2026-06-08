-- ============================================================
-- FIX CONSOLIDADO: admin-user-management / reset_password
-- ============================================================
-- PROBLEMAS CORRIGIDOS:
--
-- P1. FK actor_id com NOT NULL + ON DELETE SET NULL (contraditório):
--     O Postgres aceita o DDL mas bloqueia o INSERT em runtime.
--     Corrigido: ON DELETE RESTRICT (coerente com NOT NULL).
--
-- P2. RLS habilitado na audit_log SEM policy de INSERT:
--     Sem uma policy explícita de INSERT, qualquer role (inclusive
--     service_role via client RLS, não bypass) é bloqueada.
--     Corrigido: policy permissiva para service_role + GRANT explícito.
--
-- P3. Coluna profiles.must_change_password ausente:
--     A edge function faz UPDATE profiles SET must_change_password = true
--     após o reset. Se a coluna não existir, o Supabase JS lança erro
--     e cai no catch → HTTP 500.
--     Corrigido: ADD COLUMN IF NOT EXISTS.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- P1: Corrige FK actor_id (NOT NULL + ON DELETE RESTRICT)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.user_management_audit_log
  DROP CONSTRAINT IF EXISTS user_management_audit_log_actor_id_fkey;

ALTER TABLE public.user_management_audit_log
  ADD CONSTRAINT user_management_audit_log_actor_id_fkey
    FOREIGN KEY (actor_id)
    REFERENCES auth.users(id)
    ON DELETE RESTRICT;

-- Reconfirma target_id com ON DELETE CASCADE (intenção original)
ALTER TABLE public.user_management_audit_log
  DROP CONSTRAINT IF EXISTS user_management_audit_log_target_id_fkey;

ALTER TABLE public.user_management_audit_log
  ADD CONSTRAINT user_management_audit_log_target_id_fkey
    FOREIGN KEY (target_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- ────────────────────────────────────────────────────────────
-- P2: RLS — policy de INSERT para service_role no audit_log
-- ────────────────────────────────────────────────────────────
-- Remove policy antiga caso exista (idempotente)
DROP POLICY IF EXISTS "service_role_insert_audit_log" ON public.user_management_audit_log;

-- Cria policy que permite INSERT quando a role for service_role
-- (a edge function usa createClient com SERVICE_KEY, que conecta como service_role)
CREATE POLICY "service_role_insert_audit_log"
  ON public.user_management_audit_log
  FOR INSERT
  WITH CHECK (current_setting('role') = 'service_role');

-- GRANT explícito de INSERT para service_role (garante mesmo fora de RLS)
GRANT INSERT ON public.user_management_audit_log TO service_role;

-- Garante SELECT para admins (policy já existia, recria idempotente)
DROP POLICY IF EXISTS "admin_select_audit_log" ON public.user_management_audit_log;

CREATE POLICY "admin_select_audit_log"
  ON public.user_management_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = auth.uid()
        AND module_access = 'admin'
    )
  );

-- ────────────────────────────────────────────────────────────
-- P3: Garante coluna profiles.must_change_password
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

COMMIT;

-- ────────────────────────────────────────────────────────────
-- VALIDAÇÃO (executar manualmente no SQL Editor após apply)
-- ────────────────────────────────────────────────────────────
-- 1. Verificar FK corrigida:
--    SELECT conname, confdeltype
--    FROM pg_constraint
--    WHERE conname LIKE '%audit_log%';
--    → actor_id deve ter confdeltype = 'r' (RESTRICT)
--    → target_id deve ter confdeltype = 'c' (CASCADE)
--
-- 2. Verificar policy INSERT:
--    SELECT policyname, cmd FROM pg_policies
--    WHERE tablename = 'user_management_audit_log';
--    → deve listar 'service_role_insert_audit_log' (INSERT)
--    → deve listar 'admin_select_audit_log' (SELECT)
--
-- 3. Verificar coluna:
--    SELECT column_name, data_type, column_default
--    FROM information_schema.columns
--    WHERE table_name = 'profiles' AND column_name = 'must_change_password';
