-- ============================================================
-- FIX: user_management_audit_log — actor_id FK inconsistente
-- ============================================================
-- PROBLEMA:
--   A tabela foi criada com:
--     actor_id uuid NOT NULL references auth.users(id) ON DELETE SET NULL
--
--   Isso é uma contradição: a coluna é NOT NULL, mas o ON DELETE SET NULL
--   tentaria gravá-la como NULL quando o auth.users deletar o ator.
--   O PostgreSQL aceita o DDL mas gera erro de constraint em runtime
--   ao tentar o INSERT via a edge function admin-user-management, porque
--   a FK resolve para um usuário válido mas a constraint residual
--   bloqueia a operação em alguns cenários de revalidação interna.
--
-- SOLUÇÃO:
--   1. Dropar a FK incorreta de actor_id
--   2. Recriar com ON DELETE RESTRICT (padrão seguro para auditor ativo)
--   3. Confirmar que target_id mantém ON DELETE CASCADE (comportamento correto)
-- ============================================================

-- Passo 1: Remove a FK antiga de actor_id (gerada com nome padrão pelo Postgres)
ALTER TABLE public.user_management_audit_log
  DROP CONSTRAINT IF EXISTS user_management_audit_log_actor_id_fkey;

-- Passo 2: Recria a FK de actor_id com ON DELETE RESTRICT (sem SET NULL em coluna NOT NULL)
ALTER TABLE public.user_management_audit_log
  ADD CONSTRAINT user_management_audit_log_actor_id_fkey
    FOREIGN KEY (actor_id)
    REFERENCES auth.users(id)
    ON DELETE RESTRICT;

-- Passo 3 (segurança): garante que target_id usa ON DELETE CASCADE como originalmente previsto
ALTER TABLE public.user_management_audit_log
  DROP CONSTRAINT IF EXISTS user_management_audit_log_target_id_fkey;

ALTER TABLE public.user_management_audit_log
  ADD CONSTRAINT user_management_audit_log_target_id_fkey
    FOREIGN KEY (target_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

-- Passo 4: Garante que must_change_password existe na tabela profiles
--   (a edge function faz UPDATE profiles SET must_change_password = true)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
