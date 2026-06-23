-- ============================================================
-- MIGRATION: 20260623000003_apf_learning_engine_fix_rls.sql
-- Corrige políticas RLS das tabelas do Motor de Aprendizado APF.
--
-- Problema: as policies da 000001 referenciavam profiles.role e
-- profiles.team_id que não existem neste schema.
-- O schema real usa:
--   public.has_role(user_id, app_role)   → tabela user_roles
--   public.is_team_member(user_id, team_id) → tabela team_members
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. apf_validation_events — recria policies com funções corretas
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "apf_ve_select_team_or_admin"   ON public.apf_validation_events;
DROP POLICY IF EXISTS "apf_ve_insert_service_role"    ON public.apf_validation_events;
DROP POLICY IF EXISTS "apf_ve_update_embedding"       ON public.apf_validation_events;

-- Leitura: membro do mesmo time OU admin global
CREATE POLICY "apf_ve_select_team_or_admin"
  ON public.apf_validation_events FOR SELECT
  USING (
    public.is_team_member(auth.uid(), team_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- Inserção: apenas service_role (Edge Functions)
CREATE POLICY "apf_ve_insert_service_role"
  ON public.apf_validation_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Atualização: apenas service_role (para gravar hu_embedding)
CREATE POLICY "apf_ve_update_embedding"
  ON public.apf_validation_events FOR UPDATE
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────
-- 2. apf_knowledge_patterns — recria policies
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "apf_kp_select_team_or_admin" ON public.apf_knowledge_patterns;
DROP POLICY IF EXISTS "apf_kp_manage_service_role"  ON public.apf_knowledge_patterns;
DROP POLICY IF EXISTS "apf_kp_validate_member"      ON public.apf_knowledge_patterns;

-- Leitura: padrões globais (team_id NULL) + padrões do próprio time + admin
CREATE POLICY "apf_kp_select_team_or_admin"
  ON public.apf_knowledge_patterns FOR SELECT
  USING (
    team_id IS NULL
    OR public.is_team_member(auth.uid(), team_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- Escrita automática via service_role (consolidate_apf_patterns)
CREATE POLICY "apf_kp_manage_service_role"
  ON public.apf_knowledge_patterns
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Especialistas podem validar/rejeitar padrões do seu time
CREATE POLICY "apf_kp_validate_member"
  ON public.apf_knowledge_patterns FOR UPDATE
  USING (
    public.is_team_member(auth.uid(), team_id)
    OR public.has_role(auth.uid(), 'admin')
  );

-- ────────────────────────────────────────────────────────────
-- 3. apf_learning_metrics — recria policies
-- ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "apf_lm_select_team_or_admin" ON public.apf_learning_metrics;
DROP POLICY IF EXISTS "apf_lm_manage_service_role"  ON public.apf_learning_metrics;

CREATE POLICY "apf_lm_select_team_or_admin"
  ON public.apf_learning_metrics FOR SELECT
  USING (
    public.is_team_member(auth.uid(), team_id)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "apf_lm_manage_service_role"
  ON public.apf_learning_metrics
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────
-- 4. profiles FK em apf_validation_events
-- A tabela profiles usa PK = id (UUID) mas o user é profiles.user_id.
-- O campo corrected_by referencia auth.users(id) diretamente — correto.
-- Nenhuma alteração necessária na tabela, apenas nas policies acima.
-- ────────────────────────────────────────────────────────────
