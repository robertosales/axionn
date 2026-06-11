-- ============================================================
-- FASE 2B: Policies RLS permissivas por contrato
-- Data: 2026-06-11
-- Ambiente: PRODUÇÃO — sistema em operação
--
-- ESTRATÉGIA (modo permissivo / OR):
--   Para cada tabela, adicionamos UMA NOVA policy SELECT com
--   AS PERMISSIVE. No Postgres, múltiplas policies permissivas
--   se combinam em OR — ou seja, o usuário é autorizado se
--   QUALQUER uma delas retornar TRUE.
--
--   Resultado: policies antigas (por team_id) continuam funcionando
--   e as novas (por contract_id) passam a valer em paralelo.
--   ZERO downtime. ZERO risco de regressão.
--
-- TABELAS COBERTAS:
--   contracts       → is_contract_member()
--   teams           → is_contract_member() via t.contract_id
--   sprints         → is_team_in_user_contracts()
--   epics           → is_team_in_user_contracts()
--   demandas        → is_team_in_user_contracts()
--   comentarios     → via demanda → is_team_in_user_contracts()
--   attachments     → via demanda → is_team_in_user_contracts()
--
-- PRÓXIMO PASSO:
--   Fase 2C: após validação em produção, remover policies legadas
--   (por team_id) e manter apenas as novas (por contract_id).
-- ============================================================

-- ============================================================
-- contracts
-- ============================================================
DROP POLICY IF EXISTS "contract_members_can_select_contract" ON public.contracts;

CREATE POLICY "contract_members_can_select_contract"
  ON public.contracts
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    public.is_contract_member(auth.uid(), id)
  );

-- ============================================================
-- teams
-- ============================================================
DROP POLICY IF EXISTS "contract_members_can_select_teams" ON public.teams;

CREATE POLICY "contract_members_can_select_teams"
  ON public.teams
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    public.is_contract_member(auth.uid(), contract_id)
  );

-- ============================================================
-- sprints
-- ============================================================
DROP POLICY IF EXISTS "contract_members_can_select_sprints" ON public.sprints;

CREATE POLICY "contract_members_can_select_sprints"
  ON public.sprints
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    public.is_team_in_user_contracts(auth.uid(), team_id)
  );

-- ============================================================
-- epics
-- ============================================================
DROP POLICY IF EXISTS "contract_members_can_select_epics" ON public.epics;

CREATE POLICY "contract_members_can_select_epics"
  ON public.epics
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    public.is_team_in_user_contracts(auth.uid(), team_id)
  );

-- ============================================================
-- demandas
-- ============================================================
DROP POLICY IF EXISTS "contract_members_can_select_demandas" ON public.demandas;

CREATE POLICY "contract_members_can_select_demandas"
  ON public.demandas
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    public.is_team_in_user_contracts(auth.uid(), team_id)
  );

-- ============================================================
-- comentarios
--   Sem team_id direto → verifica via demanda
-- ============================================================
DROP POLICY IF EXISTS "contract_members_can_select_comentarios" ON public.comentarios;

CREATE POLICY "contract_members_can_select_comentarios"
  ON public.comentarios
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.demandas d
      WHERE  d.id = comentarios.demanda_id
        AND  public.is_team_in_user_contracts(auth.uid(), d.team_id)
    )
  );

-- ============================================================
-- attachments
--   Sem team_id direto → verifica via demanda
-- ============================================================
DROP POLICY IF EXISTS "contract_members_can_select_attachments" ON public.attachments;

CREATE POLICY "contract_members_can_select_attachments"
  ON public.attachments
  AS PERMISSIVE
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM   public.demandas d
      WHERE  d.id = attachments.demanda_id
        AND  public.is_team_in_user_contracts(auth.uid(), d.team_id)
    )
  );

-- ============================================================
-- VALIDAÇÃO PÓS-APPLY:
--
--   -- 1. Listar policies ativas nas tabelas afetadas
--   SELECT schemaname, tablename, policyname, cmd, qual
--   FROM   pg_policies
--   WHERE  tablename IN (
--            'contracts','teams','sprints','epics',
--            'demandas','comentarios','attachments'
--          )
--   ORDER  BY tablename, policyname;
--
--   -- 2. Testar acesso: alissandraot só deve ver dados do PF
--   SET LOCAL role TO authenticated;
--   SET LOCAL "request.jwt.claims" TO
--     '{"sub":"d645c92f-ea96-4938-a37b-aeaafb8974ec"}';
--
--   SELECT id, name FROM public.contracts;
--   -- Esperado: apenas o contrato PF (d59ab6dc-...)
-- ============================================================
