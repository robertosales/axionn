-- ============================================================
-- FASE 2D1: Policies de ESCRITA GEN-3
-- Data: 2026-06-11
-- Ambiente: PRODUÇÃO — sistema em operação
--
-- OBJETIVO:
--   Adicionar policies INSERT, UPDATE e DELETE baseadas em
--   is_team_in_user_contracts() para todas as tabelas que
--   ainda dependem de GEN-1 (is_team_member) para escrita.
--
-- IMPACTO:
--   ✅ ZERO — apenas adiciona policies, nada removido
--   ✅ GEN-1 e GEN-2 continuam ativas em paralelo (OR)
--
-- PRÓXIMO PASSO:
--   Fase 2D3: remover policies GEN-1 (is_team_member)
-- ============================================================

-- ============================================================
-- teams
-- ============================================================
DROP POLICY IF EXISTS "contract_members_can_insert_teams" ON public.teams;
CREATE POLICY "contract_members_can_insert_teams"
  ON public.teams
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_contract_member(auth.uid(), contract_id)
  );

DROP POLICY IF EXISTS "contract_members_can_update_teams" ON public.teams;
CREATE POLICY "contract_members_can_update_teams"
  ON public.teams
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    public.is_contract_member(auth.uid(), contract_id)
  )
  WITH CHECK (
    public.is_contract_member(auth.uid(), contract_id)
  );

DROP POLICY IF EXISTS "contract_members_can_delete_teams" ON public.teams;
CREATE POLICY "contract_members_can_delete_teams"
  ON public.teams
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    public.is_contract_member(auth.uid(), contract_id)
  );

-- ============================================================
-- sprints
-- ============================================================
DROP POLICY IF EXISTS "contract_members_can_insert_sprints" ON public.sprints;
CREATE POLICY "contract_members_can_insert_sprints"
  ON public.sprints
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_team_in_user_contracts(auth.uid(), team_id)
  );

DROP POLICY IF EXISTS "contract_members_can_update_sprints" ON public.sprints;
CREATE POLICY "contract_members_can_update_sprints"
  ON public.sprints
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    public.is_team_in_user_contracts(auth.uid(), team_id)
  )
  WITH CHECK (
    public.is_team_in_user_contracts(auth.uid(), team_id)
  );

DROP POLICY IF EXISTS "contract_members_can_delete_sprints" ON public.sprints;
CREATE POLICY "contract_members_can_delete_sprints"
  ON public.sprints
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    public.is_team_in_user_contracts(auth.uid(), team_id)
  );

-- ============================================================
-- epics
-- ============================================================
DROP POLICY IF EXISTS "contract_members_can_insert_epics" ON public.epics;
CREATE POLICY "contract_members_can_insert_epics"
  ON public.epics
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_team_in_user_contracts(auth.uid(), team_id)
  );

DROP POLICY IF EXISTS "contract_members_can_update_epics" ON public.epics;
CREATE POLICY "contract_members_can_update_epics"
  ON public.epics
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    public.is_team_in_user_contracts(auth.uid(), team_id)
  )
  WITH CHECK (
    public.is_team_in_user_contracts(auth.uid(), team_id)
  );

DROP POLICY IF EXISTS "contract_members_can_delete_epics" ON public.epics;
CREATE POLICY "contract_members_can_delete_epics"
  ON public.epics
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    public.is_team_in_user_contracts(auth.uid(), team_id)
  );

-- ============================================================
-- demandas
-- ============================================================
DROP POLICY IF EXISTS "contract_members_can_insert_demandas" ON public.demandas;
CREATE POLICY "contract_members_can_insert_demandas"
  ON public.demandas
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_team_in_user_contracts(auth.uid(), team_id)
  );

DROP POLICY IF EXISTS "contract_members_can_update_demandas" ON public.demandas;
CREATE POLICY "contract_members_can_update_demandas"
  ON public.demandas
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    public.is_team_in_user_contracts(auth.uid(), team_id)
  )
  WITH CHECK (
    public.is_team_in_user_contracts(auth.uid(), team_id)
  );

DROP POLICY IF EXISTS "contract_members_can_delete_demandas" ON public.demandas;
CREATE POLICY "contract_members_can_delete_demandas"
  ON public.demandas
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    public.is_team_in_user_contracts(auth.uid(), team_id)
  );

-- ============================================================
-- activity_comments
-- ============================================================
DROP POLICY IF EXISTS "contract_members_can_insert_comentarios" ON public.activity_comments;
CREATE POLICY "contract_members_can_insert_comentarios"
  ON public.activity_comments
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_team_in_user_contracts(auth.uid(), team_id)
  );

DROP POLICY IF EXISTS "contract_members_can_update_comentarios" ON public.activity_comments;
CREATE POLICY "contract_members_can_update_comentarios"
  ON public.activity_comments
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    public.is_team_in_user_contracts(auth.uid(), team_id)
  )
  WITH CHECK (
    public.is_team_in_user_contracts(auth.uid(), team_id)
  );

DROP POLICY IF EXISTS "contract_members_can_delete_comentarios" ON public.activity_comments;
CREATE POLICY "contract_members_can_delete_comentarios"
  ON public.activity_comments
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    public.is_team_in_user_contracts(auth.uid(), team_id)
  );

-- ============================================================
-- VALIDAÇÃO PÓS-APPLY:
--
--   SELECT tablename, policyname, cmd
--   FROM   pg_policies
--   WHERE  policyname LIKE 'contract_members%'
--     AND  cmd != 'SELECT'
--   ORDER  BY tablename, cmd;
--   -- Esperado: 12 linhas (3 ops x 4 tabelas + teams)
-- ============================================================
