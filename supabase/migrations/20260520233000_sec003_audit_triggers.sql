-- ============================================================
-- SEC-003 — AUDIT LOG TRIGGERS
--
-- Objetivo: registrar automaticamente em user_management_audit_log
-- toda alteração nas tabelas críticas de auth e controle de acesso:
--   • user_roles      — concessão/revogação de roles
--   • profiles        — alteração de email, must_change_password
--   • team_members    — entrada/saída de membros
--
-- A tabela user_management_audit_log já existe (criada em migration
-- anterior). Esta migration adiciona:
--   1. Função SECURITY DEFINER: audit_log_insert() — usada pelos triggers
--   2. Trigger em user_roles
--   3. Trigger em profiles (apenas colunas sensíveis)
--   4. Trigger em team_members
--
-- SEGURANÇA:
--   • Função com SECURITY DEFINER + search_path fixo — sem SQL injection
--   • Triggers AFTER — não bloqueiam a operação principal
--   • Falha no audit nunca reverte a operação (EXCEPTION capturada)
--   • RLS em user_management_audit_log: INSERT bloqueado para todos
--     exceto via esta função (service role)
-- ============================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1. FUNÇÃO CENTRAL DE AUDIT LOG
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_audit_log_insert(
  p_action       TEXT,
  p_target_table TEXT,
  p_target_id    UUID,
  p_actor_id     UUID,
  p_old_data     JSONB DEFAULT NULL,
  p_new_data     JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_management_audit_log (
    action,
    target_table,
    target_id,
    actor_id,
    old_data,
    new_data,
    created_at
  ) VALUES (
    p_action,
    p_target_table,
    p_target_id,
    p_actor_id,
    p_old_data,
    p_new_data,
    now()
  );
EXCEPTION WHEN OTHERS THEN
  -- Audit nunca deve derrubar a operação principal
  RAISE WARNING '[audit_log] falha ao registrar: % — %', SQLSTATE, SQLERRM;
END;
$$;

-- Garante que apenas a função (via service role) pode inserir
REVOKE ALL ON FUNCTION public.fn_audit_log_insert FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_audit_log_insert TO service_role;

-- ─────────────────────────────────────────────────────────────
-- 2. TRIGGER: user_roles
--    Registra INSERT (concessão de role) e DELETE (revogação)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_audit_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.fn_audit_log_insert(
      'ROLE_GRANTED',
      'user_roles',
      NEW.user_id,
      auth.uid(),
      NULL,
      jsonb_build_object('role', NEW.role)
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.fn_audit_log_insert(
      'ROLE_REVOKED',
      'user_roles',
      OLD.user_id,
      auth.uid(),
      jsonb_build_object('role', OLD.role),
      NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.fn_audit_log_insert(
      'ROLE_UPDATED',
      'user_roles',
      NEW.user_id,
      auth.uid(),
      jsonb_build_object('role', OLD.role),
      jsonb_build_object('role', NEW.role)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.trg_audit_user_roles();

-- ─────────────────────────────────────────────────────────────
-- 3. TRIGGER: profiles
--    Registra apenas alterações em colunas sensíveis:
--    email, must_change_password
--    (evita spam de audit para atualizações triviais)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_audit_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só audita se email ou must_change_password mudou
  IF TG_OP = 'UPDATE' AND (
    OLD.email IS DISTINCT FROM NEW.email OR
    OLD.must_change_password IS DISTINCT FROM NEW.must_change_password
  ) THEN
    PERFORM public.fn_audit_log_insert(
      'PROFILE_UPDATED',
      'profiles',
      NEW.user_id,
      auth.uid(),
      jsonb_build_object(
        'email',               OLD.email,
        'must_change_password', OLD.must_change_password
      ),
      jsonb_build_object(
        'email',               NEW.email,
        'must_change_password', NEW.must_change_password
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.fn_audit_log_insert(
      'PROFILE_DELETED',
      'profiles',
      OLD.user_id,
      auth.uid(),
      jsonb_build_object('email', OLD.email),
      NULL
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles
AFTER UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.trg_audit_profiles();

-- ─────────────────────────────────────────────────────────────
-- 4. TRIGGER: team_members
--    Registra entrada (INSERT) e saída (DELETE) de membros
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_audit_team_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.fn_audit_log_insert(
      'TEAM_MEMBER_ADDED',
      'team_members',
      NEW.user_id,
      auth.uid(),
      NULL,
      jsonb_build_object('team_id', NEW.team_id, 'role', NEW.role)
    );
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.fn_audit_log_insert(
      'TEAM_MEMBER_REMOVED',
      'team_members',
      OLD.user_id,
      auth.uid(),
      jsonb_build_object('team_id', OLD.team_id, 'role', OLD.role),
      NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.fn_audit_log_insert(
      'TEAM_MEMBER_UPDATED',
      'team_members',
      NEW.user_id,
      auth.uid(),
      jsonb_build_object('team_id', OLD.team_id, 'role', OLD.role),
      jsonb_build_object('team_id', NEW.team_id, 'role', NEW.role)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_team_members ON public.team_members;
CREATE TRIGGER audit_team_members
AFTER INSERT OR UPDATE OR DELETE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.trg_audit_team_members();

COMMIT;

-- ============================================================
-- VALIDAÇÃO (executar no Supabase SQL Editor)
-- ============================================================
-- Listar triggers criados:
-- SELECT trigger_name, event_object_table, action_timing, event_manipulation
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public'
--   AND trigger_name IN ('audit_user_roles','audit_profiles','audit_team_members')
-- ORDER BY event_object_table;
--
-- Simular auditoria (como admin autenticado):
-- INSERT INTO public.user_roles (user_id, role) VALUES ('<uuid-teste>', 'member');
-- SELECT * FROM public.user_management_audit_log ORDER BY created_at DESC LIMIT 5;
