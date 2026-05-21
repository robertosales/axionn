-- ============================================================
-- SEC-003 — AUDIT LOG TRIGGERS + HARDENING
--
-- Objetivo:
--   1. Criar tabela `audit_log` genérica para registrar INSERT/
--      UPDATE/DELETE em tabelas críticas via trigger
--   2. Aplicar trigger nas tabelas: user_roles, profiles,
--      team_members, teams, user_module_roles
--   3. Garantir que `user_management_audit_log` (já existente)
--      continue sendo ponto central de logs de ações admin
--
-- SEGURANÇA:
--   • Atômica (BEGIN/COMMIT)
--   • Trigger executa como SECURITY DEFINER — não depende de
--     permissões do usuário chamador
--   • Nenhuma tabela existente é alterada estruturalmente
--   • Idempotente (DROP IF EXISTS antes de cada criação)
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. TABELA AUDIT_LOG
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Quando e quem
  created_at    timestamptz NOT NULL DEFAULT now(),
  actor_id      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email   text,
  -- O que e onde
  table_name    text        NOT NULL,
  operation     text        NOT NULL CHECK (operation IN ('INSERT','UPDATE','DELETE')),
  record_id     text,                   -- PK do registro afetado (cast para text)
  -- Dados antes/depois
  old_data      jsonb,                  -- NULL em INSERT
  new_data      jsonb,                  -- NULL em DELETE
  -- Contexto extra
  ip_address    text,
  user_agent    text
);

COMMENT ON TABLE public.audit_log IS
  'Registro imutável de alterações em tabelas críticas. Gravado por triggers SECURITY DEFINER.';

-- RLS: apenas admin pode SELECT; ninguém insere diretamente (só via trigger)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_admin_select" ON public.audit_log;
CREATE POLICY "audit_log_admin_select"
ON public.audit_log FOR SELECT
USING (public.is_admin());
-- Sem policy INSERT/UPDATE/DELETE = bloqueado para todos os roles cliente

-- ────────────────────────────────────────────────────────────
-- 2. FUNÇÃO DE TRIGGER — audit_log_trigger_fn()
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_log_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id    uuid;
  v_actor_email text;
  v_record_id   text;
  v_old_data    jsonb;
  v_new_data    jsonb;
BEGIN
  -- Captura o usuário autenticado via Supabase JWT
  BEGIN
    v_actor_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := NULL;
  END;

  -- Tenta obter o e-mail do actor via auth.users (somente para leitura interna)
  IF v_actor_id IS NOT NULL THEN
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = v_actor_id;
  END IF;

  -- Determina record_id: tenta campo 'id' primeiro, depois 'user_id'
  IF TG_OP = 'DELETE' THEN
    v_record_id := COALESCE(
      (OLD.id)::text,
      (OLD ->> 'user_id')::text
    );
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := COALESCE(
      (NEW.id)::text,
      (NEW ->> 'user_id')::text
    );
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
  ELSE -- UPDATE
    v_record_id := COALESCE(
      (NEW.id)::text,
      (NEW ->> 'user_id')::text
    );
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  END IF;

  -- Remove campos sensíveis antes de gravar
  v_old_data := v_old_data
    - 'password'
    - 'encrypted_password'
    - 'must_change_password';
  v_new_data := v_new_data
    - 'password'
    - 'encrypted_password'
    - 'must_change_password';

  INSERT INTO public.audit_log (
    actor_id,
    actor_email,
    table_name,
    operation,
    record_id,
    old_data,
    new_data
  ) VALUES (
    v_actor_id,
    v_actor_email,
    TG_TABLE_NAME,
    TG_OP,
    v_record_id,
    v_old_data,
    v_new_data
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 3. APLICAR TRIGGERS NAS TABELAS CRÍTICAS
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'user_roles',
    'profiles',
    'team_members',
    'teams',
    'user_module_roles'
  ]
  LOOP
    -- Remove trigger anterior (idempotência)
    EXECUTE format(
      'DROP TRIGGER IF EXISTS audit_log_trigger ON public.%I',
      tbl
    );
    -- Cria trigger AFTER INSERT OR UPDATE OR DELETE
    EXECUTE format(
      'CREATE TRIGGER audit_log_trigger
       AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn()',
      tbl
    );
  END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 4. ÍNDICES PARA CONSULTA EFICIENTE DO AUDIT LOG
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id
  ON public.audit_log (actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_table_operation
  ON public.audit_log (table_name, operation);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON public.audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_record_id
  ON public.audit_log (record_id);

COMMIT;

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION
-- 
-- 1. Triggers criados:
-- SELECT trigger_name, event_object_table, event_manipulation
-- FROM information_schema.triggers
-- WHERE trigger_name = 'audit_log_trigger'
-- ORDER BY event_object_table;
--
-- 2. Teste manual (como admin):
-- UPDATE public.profiles SET updated_at = now()
-- WHERE user_id = auth.uid();
-- SELECT * FROM public.audit_log ORDER BY created_at DESC LIMIT 5;
-- ============================================================
