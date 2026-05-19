-- ============================================================
-- MIGRATION FIX: Corrige policies RLS do módulo RDM
-- Problema: app_role é ENUM, não text.
--           Comparação role_permissions.role_name (text)
--           com user_roles.role (app_role) falha sem cast.
-- Solução: usar ur.role::text para comparar com role_name.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- Remove policies anteriores com erro de tipo
-- ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rdms_team_insert"   ON rdms;
DROP POLICY IF EXISTS "rdms_team_update"   ON rdms;
DROP POLICY IF EXISTS "rdm_checklist_write" ON rdm_checklist_items;
DROP POLICY IF EXISTS "rdm_gonogo_insert"   ON rdm_gonogo;
DROP POLICY IF EXISTS "rdm_audit_insert"    ON rdm_audit_log;

-- ──────────────────────────────────────────────────────────
-- Helper function: verifica se o usuário atual tem uma permission key RDM.
-- Usa ur.role::text para resolver a incompatibilidade entre
-- user_roles.role (app_role ENUM) e role_permissions.role_name (text).
-- SECURITY DEFINER para evitar problemas de RLS recursivo.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_rdm_has_permission(p_permission_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM user_roles       ur
      JOIN role_permissions  rp ON rp.role_name = ur.role::text   -- cast ENUM -> text
     WHERE ur.user_id = auth.uid()
       AND rp.permission_key = p_permission_key
  )
$$;

-- ──────────────────────────────────────────────────────────
-- Helper: verifica se o usuário pertence a um time
-- Reutiliza is_team_member já existente (definida na migration original)
-- mas encapsula a busca de team_id via profiles
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_rdm_user_team_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Retorna todos os team_ids onde o usuário é membro
  SELECT team_id
    FROM team_members
   WHERE user_id = auth.uid()
UNION
  -- Também inclui o team_id do profile (campo adicionado em migração posterior)
  SELECT team_id
    FROM profiles
   WHERE user_id = auth.uid()
     AND team_id IS NOT NULL
$$;

-- ──────────────────────────────────────────────────────────
-- Recriar policies corrigidas em rdms
-- ──────────────────────────────────────────────────────────

-- INSERT: requer rdm.create
CREATE POLICY "rdms_team_insert" ON rdms
  FOR INSERT WITH CHECK (
    is_admin()
    OR fn_rdm_has_permission('rdm.create')
  );

-- UPDATE: pertencer ao time + ter rdm.edit
CREATE POLICY "rdms_team_update" ON rdms
  FOR UPDATE USING (
    team_id = ANY(SELECT fn_rdm_user_team_ids())
    AND (
      is_admin()
      OR fn_rdm_has_permission('rdm.edit')
    )
  );

-- ──────────────────────────────────────────────────────────
-- Recriar policy corrigida em rdm_checklist_items
-- ──────────────────────────────────────────────────────────

CREATE POLICY "rdm_checklist_write" ON rdm_checklist_items
  FOR ALL USING (
    rdm_id IN (
      SELECT id FROM rdms
      WHERE team_id = ANY(SELECT fn_rdm_user_team_ids())
    )
    AND (
      is_admin()
      OR fn_rdm_has_permission('rdm.edit')
      OR fn_rdm_has_permission('rdm.execute')
    )
  );

-- ──────────────────────────────────────────────────────────
-- Recriar policy corrigida em rdm_gonogo
-- ──────────────────────────────────────────────────────────

CREATE POLICY "rdm_gonogo_insert" ON rdm_gonogo
  FOR INSERT WITH CHECK (
    is_admin()
    OR fn_rdm_has_permission('rdm.approve')
  );

-- ──────────────────────────────────────────────────────────
-- Recriar policy corrigida em rdm_audit_log
-- ──────────────────────────────────────────────────────────

CREATE POLICY "rdm_audit_insert" ON rdm_audit_log
  FOR INSERT WITH CHECK (
    is_admin()
    OR profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────
-- Corrigir também a RPC fn_rdm_dashboard_kpis:
-- a função original não usa user_roles, então não precisa de fix.
-- Mas a fn_rdm_criar_com_checklist usa SECURITY DEFINER,
-- portanto também não sofre o problema de RLS.
-- Nenhuma alteração necessária nas RPCs.
-- ──────────────────────────────────────────────────────────
-- Também corrigir a policy de SELECT em rdms que usa profiles.team_id
-- A migration anterior já estava correta para SELECT,
-- mas vamos reforçar usando fn_rdm_user_team_ids() para consistência.
-- ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "rdms_team_select" ON rdms;
CREATE POLICY "rdms_team_select" ON rdms
  FOR SELECT USING (
    team_id = ANY(SELECT fn_rdm_user_team_ids())
  );

-- Idem para tabelas filhas
DROP POLICY IF EXISTS "rdm_sprint_items_select" ON rdm_sprint_items;
CREATE POLICY "rdm_sprint_items_select" ON rdm_sprint_items
  FOR SELECT USING (
    rdm_id IN (
      SELECT id FROM rdms WHERE team_id = ANY(SELECT fn_rdm_user_team_ids())
    )
  );

DROP POLICY IF EXISTS "rdm_sprint_items_write" ON rdm_sprint_items;
CREATE POLICY "rdm_sprint_items_write" ON rdm_sprint_items
  FOR INSERT WITH CHECK (
    rdm_id IN (
      SELECT id FROM rdms WHERE team_id = ANY(SELECT fn_rdm_user_team_ids())
    )
  );

DROP POLICY IF EXISTS "rdm_participantes_select" ON rdm_participantes;
CREATE POLICY "rdm_participantes_select" ON rdm_participantes
  FOR SELECT USING (
    rdm_id IN (
      SELECT id FROM rdms WHERE team_id = ANY(SELECT fn_rdm_user_team_ids())
    )
  );

DROP POLICY IF EXISTS "rdm_participantes_write" ON rdm_participantes;
CREATE POLICY "rdm_participantes_write" ON rdm_participantes
  FOR INSERT WITH CHECK (
    rdm_id IN (
      SELECT id FROM rdms WHERE team_id = ANY(SELECT fn_rdm_user_team_ids())
    )
  );

DROP POLICY IF EXISTS "rdm_checklist_select" ON rdm_checklist_items;
CREATE POLICY "rdm_checklist_select" ON rdm_checklist_items
  FOR SELECT USING (
    rdm_id IN (
      SELECT id FROM rdms WHERE team_id = ANY(SELECT fn_rdm_user_team_ids())
    )
  );

DROP POLICY IF EXISTS "rdm_gonogo_select" ON rdm_gonogo;
CREATE POLICY "rdm_gonogo_select" ON rdm_gonogo
  FOR SELECT USING (
    rdm_id IN (
      SELECT id FROM rdms WHERE team_id = ANY(SELECT fn_rdm_user_team_ids())
    )
  );

DROP POLICY IF EXISTS "rdm_audit_select" ON rdm_audit_log;
CREATE POLICY "rdm_audit_select" ON rdm_audit_log
  FOR SELECT USING (
    rdm_id IN (
      SELECT id FROM rdms WHERE team_id = ANY(SELECT fn_rdm_user_team_ids())
    )
  );

-- ──────────────────────────────────────────────────────────
-- FIM DO FIX
-- Funções criadas:
--   fn_rdm_has_permission(text) — verifica permission com cast ENUM->text
--   fn_rdm_user_team_ids()      — retorna todos os team_ids do usuário
-- Policies reescritas (todas sem comparação direta app_role = text):
--   rdms: select, insert, update
--   rdm_sprint_items: select, write
--   rdm_participantes: select, write
--   rdm_checklist_items: select, write
--   rdm_gonogo: select, insert
--   rdm_audit_log: select, insert
-- ──────────────────────────────────────────────────────────
