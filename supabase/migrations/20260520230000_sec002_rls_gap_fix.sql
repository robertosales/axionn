-- ============================================================
-- SEC-002 — RLS GAP FIX
--
-- Corrige lacunas encontradas na query de auditoria:
--
--   TABELAS SEM RLS ENCONTRADAS:
--     1. teams                        — RLS foi desfeito pelo rollback 20260516134201
--     2. user_roles                   — idem
--     3. app_roles                    — tabela de sistema, nunca teve RLS
--     4. app_permissions              — tabela de sistema, nunca teve RLS
--     5. role_permissions             — tabela de sistema, nunca teve RLS
--     6. rdm_checklist_templates      — migration SEC-002 ainda não aplicada no banco
--     7. _backup_demanda_hours_p5     — tabela de backup, deve ser bloqueada
--     8. demanda_hours_backup_20260511 — tabela de backup, deve ser bloqueada
--     9. demanda_hours_backup_minutos  — tabela de backup, deve ser bloqueada
--    10. migration_demanda_hours_log   — log interno de migração, admin-only
--
-- ESTRATÉGIA:
--   • Backups e logs internos: RLS habilitado SEM policies
--     → PostgreSQL bloqueia 100% o acesso via anon/authenticated
--     → Apenas roles de serviço (service_role) conseguem acessar
--   • Tabelas de sistema (app_roles, app_permissions, role_permissions):
--     → Leitura: qualquer autenticado
--     → Escrita: apenas admin
--   • teams e user_roles: replicar policies da migration 20260516134200
--     (que foi desfeita pelo rollback)
--
-- SEGURANÇA:
--   • Atômica (BEGIN/COMMIT)
--   • Idempotente (DROP IF EXISTS antes de cada CREATE)
--   • Não toca em tabelas já com RLS correto
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- 1. TABELAS DE BACKUP — RLS sem policies = bloqueio total
--    Apenas service_role (backend/migrations) consegue acessar.
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    '_backup_demanda_hours_p5',
    'demanda_hours_backup_20260511',
    'demanda_hours_backup_minutos'
  ]
  LOOP
    -- Habilita RLS (sem nenhuma policy = bloqueio total para anon e authenticated)
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',  tbl);
  END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 2. MIGRATION_DEMANDA_HOURS_LOG — log interno, admin-only
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.migration_demanda_hours_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_demanda_hours_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mig_log_admin_select" ON public.migration_demanda_hours_log;
CREATE POLICY "mig_log_admin_select"
ON public.migration_demanda_hours_log FOR SELECT
USING (public.is_admin());
-- INSERT/UPDATE/DELETE: sem policy = bloqueado (escrita apenas via service_role)

-- ────────────────────────────────────────────────────────────
-- 3. TABELAS DE SISTEMA: app_roles, app_permissions, role_permissions
--    Leitura: qualquer autenticado (necessário para RBAC funcionar)
--    Escrita: apenas admin
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'app_roles',
    'app_permissions',
    'role_permissions'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "%s_auth_select" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_admin_insert" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_admin_update" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_admin_delete" ON public.%I', tbl, tbl);

    -- Qualquer autenticado pode LER (necessário para RBAC no frontend)
    EXECUTE format(
      'CREATE POLICY "%s_auth_select" ON public.%I FOR SELECT USING (auth.uid() IS NOT NULL)',
      tbl, tbl
    );
    -- Apenas admin pode ESCREVER
    EXECUTE format(
      'CREATE POLICY "%s_admin_insert" ON public.%I FOR INSERT WITH CHECK (public.is_admin())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_admin_update" ON public.%I FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin())',
      tbl, tbl
    );
    EXECUTE format(
      'CREATE POLICY "%s_admin_delete" ON public.%I FOR DELETE USING (public.is_admin())',
      tbl, tbl
    );
  END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 4. TEAMS — reabilitar RLS (desfeito pelo rollback 20260516134201)
--    Replica as policies da migration 20260516134200
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teams_select" ON public.teams;
DROP POLICY IF EXISTS "teams_insert" ON public.teams;
DROP POLICY IF EXISTS "teams_update" ON public.teams;
DROP POLICY IF EXISTS "teams_delete" ON public.teams;

CREATE POLICY "teams_select"
ON public.teams FOR SELECT
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = teams.id
      AND tm.user_id = auth.uid()
  )
);

CREATE POLICY "teams_insert"
ON public.teams FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "teams_update"
ON public.teams FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "teams_delete"
ON public.teams FOR DELETE
USING (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 5. USER_ROLES — reabilitar RLS (desfeito pelo rollback 20260516134201)
--    Replica as policies da migration 20260516134200
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_select" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_delete" ON public.user_roles;

CREATE POLICY "user_roles_select"
ON public.user_roles FOR SELECT
USING (
  public.is_admin()
  OR user_id = auth.uid()
);

CREATE POLICY "user_roles_insert"
ON public.user_roles FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "user_roles_update"
ON public.user_roles FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "user_roles_delete"
ON public.user_roles FOR DELETE
USING (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 6. RDM_CHECKLIST_TEMPLATES — garantir RLS (migration SEC-002 pode não ter aplicado)
--    Já tratado pelo DO $$ loop da SEC-002, mas reforça idempotência
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.rdm_checklist_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rdm_checklist_templates_auth_select" ON public.rdm_checklist_templates;
DROP POLICY IF EXISTS "rdm_checklist_templates_admin_insert" ON public.rdm_checklist_templates;
DROP POLICY IF EXISTS "rdm_checklist_templates_admin_update" ON public.rdm_checklist_templates;
DROP POLICY IF EXISTS "rdm_checklist_templates_admin_delete" ON public.rdm_checklist_templates;

CREATE POLICY "rdm_checklist_templates_auth_select"
ON public.rdm_checklist_templates FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "rdm_checklist_templates_admin_insert"
ON public.rdm_checklist_templates FOR INSERT
WITH CHECK (public.is_admin());

CREATE POLICY "rdm_checklist_templates_admin_update"
ON public.rdm_checklist_templates FOR UPDATE
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "rdm_checklist_templates_admin_delete"
ON public.rdm_checklist_templates FOR DELETE
USING (public.is_admin());

COMMIT;

-- ============================================================
-- VERIFICAÇÃO PÓS-MIGRATION
-- Execute no Supabase SQL Editor para confirmar resultado zero:
--
-- SELECT tablename FROM pg_tables
-- WHERE schemaname = 'public' AND NOT rowsecurity
-- ORDER BY tablename;
--
-- Resultado esperado: 0 linhas
-- ============================================================
