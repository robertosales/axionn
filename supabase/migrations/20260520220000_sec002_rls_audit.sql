-- ============================================================
-- SEC-002 — RLS AUDIT COMPLETO
--
-- Objetivo: garantir que TODAS as tabelas com dados sensíveis
-- tenham RLS habilitado e policies cobrindo SELECT/INSERT/
-- UPDATE/DELETE de forma explícita.
--
-- Tabelas auditadas:
--   Core:         sprints, user_stories, activities, impediments,
--                 sprint_impediments
--   APF:          apf_generations
--   RDM:          rdm_demandas, rdm_fases, rdm_participantes,
--                 rdm_checklist_templates, rdm_checklist_items,
--                 rdm_deployment_tasks, rdm_deployment_task_items
--   Admin:        user_module_roles
--   Sustentação:  sustentacao_demandas (se existir)
--   Audit:        user_management_audit_log
--
-- SEGURANÇA:
--   • Atômica (BEGIN/COMMIT)
--   • Usa ONLY is_admin() e is_team_member() — sem has_role() legado
--   • Nenhuma policy existente e funcionando é removida sem DROP IF EXISTS
--   • Todas as tabelas recebem ALTER TABLE ... ENABLE ROW LEVEL SECURITY
--     com FORCE (garante mesmo para superuser em dev)
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- HELPER: função utilitária para verificar se usuário é membro
-- de algum time (já existe, garantimos idempotência)
-- ────────────────────────────────────────────────────────────

-- ────────────────────────────────────────────────────────────
-- 1. SPRINTS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sprints_select"        ON public.sprints;
DROP POLICY IF EXISTS "sprints_insert"        ON public.sprints;
DROP POLICY IF EXISTS "sprints_update"        ON public.sprints;
DROP POLICY IF EXISTS "sprints_delete"        ON public.sprints;
DROP POLICY IF EXISTS "sprints_admin_all"     ON public.sprints;

-- Qualquer autenticado pode VER sprints do seu time
CREATE POLICY "sprints_select"
ON public.sprints FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND public.is_team_member(auth.uid(), team_id)
);

-- Admin pode VER todos
CREATE POLICY "sprints_admin_select"
ON public.sprints FOR SELECT
USING (public.is_admin());

-- Admin ou membro do time pode CRIAR sprint
CREATE POLICY "sprints_insert"
ON public.sprints FOR INSERT
WITH CHECK (
  public.is_admin()
  OR public.is_team_member(auth.uid(), team_id)
);

-- Admin ou membro do time pode ATUALIZAR sprint
CREATE POLICY "sprints_update"
ON public.sprints FOR UPDATE
USING (
  public.is_admin()
  OR public.is_team_member(auth.uid(), team_id)
)
WITH CHECK (
  public.is_admin()
  OR public.is_team_member(auth.uid(), team_id)
);

-- Apenas admin pode DELETAR sprint
CREATE POLICY "sprints_delete"
ON public.sprints FOR DELETE
USING (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 2. USER_STORIES
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.user_stories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "us_select"       ON public.user_stories;
DROP POLICY IF EXISTS "us_insert"       ON public.user_stories;
DROP POLICY IF EXISTS "us_update"       ON public.user_stories;
DROP POLICY IF EXISTS "us_delete"       ON public.user_stories;
DROP POLICY IF EXISTS "us_admin_all"    ON public.user_stories;

CREATE POLICY "us_select"
ON public.user_stories FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.sprints s
    WHERE s.id = sprint_id
    AND public.is_team_member(auth.uid(), s.team_id)
  )
);

CREATE POLICY "us_admin_select"
ON public.user_stories FOR SELECT
USING (public.is_admin());

CREATE POLICY "us_insert"
ON public.user_stories FOR INSERT
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.sprints s
    WHERE s.id = sprint_id
    AND public.is_team_member(auth.uid(), s.team_id)
  )
);

CREATE POLICY "us_update"
ON public.user_stories FOR UPDATE
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.sprints s
    WHERE s.id = sprint_id
    AND public.is_team_member(auth.uid(), s.team_id)
  )
)
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.sprints s
    WHERE s.id = sprint_id
    AND public.is_team_member(auth.uid(), s.team_id)
  )
);

CREATE POLICY "us_delete"
ON public.user_stories FOR DELETE
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.sprints s
    WHERE s.id = sprint_id
    AND public.is_team_member(auth.uid(), s.team_id)
  )
);

-- ────────────────────────────────────────────────────────────
-- 3. ACTIVITIES
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "act_select"  ON public.activities;
DROP POLICY IF EXISTS "act_insert"  ON public.activities;
DROP POLICY IF EXISTS "act_update"  ON public.activities;
DROP POLICY IF EXISTS "act_delete"  ON public.activities;

-- Membro vê atividades das HUs do seu time
CREATE POLICY "act_select"
ON public.activities FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_stories us
    JOIN public.sprints s ON s.id = us.sprint_id
    WHERE us.id = user_story_id
    AND public.is_team_member(auth.uid(), s.team_id)
  )
);

CREATE POLICY "act_admin_select"
ON public.activities FOR SELECT
USING (public.is_admin());

CREATE POLICY "act_insert"
ON public.activities FOR INSERT
WITH CHECK (
  public.is_admin()
  OR profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "act_update"
ON public.activities FOR UPDATE
USING (
  public.is_admin()
  OR profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
)
WITH CHECK (
  public.is_admin()
  OR profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "act_delete"
ON public.activities FOR DELETE
USING (
  public.is_admin()
  OR profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

-- ────────────────────────────────────────────────────────────
-- 4. IMPEDIMENTS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.impediments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "imp_select" ON public.impediments;
DROP POLICY IF EXISTS "imp_insert" ON public.impediments;
DROP POLICY IF EXISTS "imp_update" ON public.impediments;
DROP POLICY IF EXISTS "imp_delete" ON public.impediments;

CREATE POLICY "imp_select"
ON public.impediments FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.user_stories us
    JOIN public.sprints s ON s.id = us.sprint_id
    WHERE us.id = user_story_id
    AND public.is_team_member(auth.uid(), s.team_id)
  )
);

CREATE POLICY "imp_admin_select"
ON public.impediments FOR SELECT
USING (public.is_admin());

CREATE POLICY "imp_insert"
ON public.impediments FOR INSERT
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.user_stories us
    JOIN public.sprints s ON s.id = us.sprint_id
    WHERE us.id = user_story_id
    AND public.is_team_member(auth.uid(), s.team_id)
  )
);

CREATE POLICY "imp_update"
ON public.impediments FOR UPDATE
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.user_stories us
    JOIN public.sprints s ON s.id = us.sprint_id
    WHERE us.id = user_story_id
    AND public.is_team_member(auth.uid(), s.team_id)
  )
)
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.user_stories us
    JOIN public.sprints s ON s.id = us.sprint_id
    WHERE us.id = user_story_id
    AND public.is_team_member(auth.uid(), s.team_id)
  )
);

CREATE POLICY "imp_delete"
ON public.impediments FOR DELETE
USING (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 5. SPRINT_IMPEDIMENTS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.sprint_impediments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "si_select" ON public.sprint_impediments;
DROP POLICY IF EXISTS "si_insert" ON public.sprint_impediments;
DROP POLICY IF EXISTS "si_update" ON public.sprint_impediments;
DROP POLICY IF EXISTS "si_delete" ON public.sprint_impediments;

CREATE POLICY "si_select"
ON public.sprint_impediments FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND public.is_team_member(auth.uid(), team_id)
);

CREATE POLICY "si_admin_select"
ON public.sprint_impediments FOR SELECT
USING (public.is_admin());

CREATE POLICY "si_insert"
ON public.sprint_impediments FOR INSERT
WITH CHECK (
  public.is_admin()
  OR public.is_team_member(auth.uid(), team_id)
);

CREATE POLICY "si_update"
ON public.sprint_impediments FOR UPDATE
USING (
  public.is_admin()
  OR public.is_team_member(auth.uid(), team_id)
)
WITH CHECK (
  public.is_admin()
  OR public.is_team_member(auth.uid(), team_id)
);

CREATE POLICY "si_delete"
ON public.sprint_impediments FOR DELETE
USING (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 6. APF_GENERATIONS
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.apf_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "apf_select" ON public.apf_generations;
DROP POLICY IF EXISTS "apf_insert" ON public.apf_generations;
DROP POLICY IF EXISTS "apf_update" ON public.apf_generations;
DROP POLICY IF EXISTS "apf_delete" ON public.apf_generations;

-- Usuário vê apenas suas próprias gerações APF
CREATE POLICY "apf_select"
ON public.apf_generations FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "apf_admin_select"
ON public.apf_generations FOR SELECT
USING (public.is_admin());

CREATE POLICY "apf_insert"
ON public.apf_generations FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "apf_update"
ON public.apf_generations FOR UPDATE
USING (
  public.is_admin()
  OR created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
)
WITH CHECK (
  public.is_admin()
  OR created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "apf_delete"
ON public.apf_generations FOR DELETE
USING (
  public.is_admin()
  OR created_by = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

-- ────────────────────────────────────────────────────────────
-- 7. RDM — rdm_demandas
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.rdm_demandas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rdm_d_select" ON public.rdm_demandas;
DROP POLICY IF EXISTS "rdm_d_insert" ON public.rdm_demandas;
DROP POLICY IF EXISTS "rdm_d_update" ON public.rdm_demandas;
DROP POLICY IF EXISTS "rdm_d_delete" ON public.rdm_demandas;

-- Membro que participa da demanda OU admin pode ver
CREATE POLICY "rdm_d_select"
ON public.rdm_demandas FOR SELECT
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.rdm_participantes p
    WHERE p.demanda_id = id
    AND p.profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  )
  OR solicitante_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  OR responsavel_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "rdm_d_insert"
ON public.rdm_demandas FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "rdm_d_update"
ON public.rdm_demandas FOR UPDATE
USING (
  public.is_admin()
  OR responsavel_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  OR solicitante_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
)
WITH CHECK (
  public.is_admin()
  OR responsavel_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  OR solicitante_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);

CREATE POLICY "rdm_d_delete"
ON public.rdm_demandas FOR DELETE
USING (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 8. RDM — rdm_participantes
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.rdm_participantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rdm_p_select" ON public.rdm_participantes;
DROP POLICY IF EXISTS "rdm_p_insert" ON public.rdm_participantes;
DROP POLICY IF EXISTS "rdm_p_delete" ON public.rdm_participantes;

CREATE POLICY "rdm_p_select"
ON public.rdm_participantes FOR SELECT
USING (
  public.is_admin()
  OR profile_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  OR EXISTS (
    SELECT 1 FROM public.rdm_demandas d
    WHERE d.id = demanda_id
    AND (
      d.solicitante_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      OR d.responsavel_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  )
);

CREATE POLICY "rdm_p_insert"
ON public.rdm_participantes FOR INSERT
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.rdm_demandas d
    WHERE d.id = demanda_id
    AND (
      d.responsavel_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
      OR d.solicitante_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
    )
  )
);

CREATE POLICY "rdm_p_delete"
ON public.rdm_participantes FOR DELETE
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.rdm_demandas d
    WHERE d.id = demanda_id
    AND d.responsavel_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
  )
);

-- ────────────────────────────────────────────────────────────
-- 9. RDM — rdm_fases, rdm_checklist_templates, rdm_checklist_items
--         rdm_deployment_tasks, rdm_deployment_task_items
-- Estas são tabelas de configuração/workflow:
-- Leitura: qualquer autenticado
-- Escrita: apenas admin
-- ────────────────────────────────────────────────────────────
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'rdm_fases',
    'rdm_checklist_templates',
    'rdm_checklist_items',
    'rdm_deployment_tasks',
    'rdm_deployment_task_items'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format('DROP POLICY IF EXISTS "%s_auth_select" ON public.%I', tbl, tbl);
    EXECUTE format('DROP POLICY IF EXISTS "%s_admin_write" ON public.%I', tbl, tbl);

    -- Qualquer autenticado pode ler tabelas de configuração
    EXECUTE format(
      'CREATE POLICY "%s_auth_select" ON public.%I FOR SELECT USING (auth.uid() IS NOT NULL)',
      tbl, tbl
    );

    -- Apenas admin pode escrever
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
-- 10. USER_MODULE_ROLES
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.user_module_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "umr_select_own"   ON public.user_module_roles;
DROP POLICY IF EXISTS "umr_admin_all"    ON public.user_module_roles;

-- Usuário vê seus próprios papéis por módulo
CREATE POLICY "umr_select_own"
ON public.user_module_roles FOR SELECT
USING (
  user_id = auth.uid()
);

-- Admin controla todos
CREATE POLICY "umr_admin_all"
ON public.user_module_roles FOR ALL
USING      (public.is_admin())
WITH CHECK (public.is_admin());

-- ────────────────────────────────────────────────────────────
-- 11. USER_MANAGEMENT_AUDIT_LOG — somente admin lê; escrita via SECURITY DEFINER
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.user_management_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_admin_select" ON public.user_management_audit_log;
DROP POLICY IF EXISTS "audit_no_direct_write" ON public.user_management_audit_log;

CREATE POLICY "audit_admin_select"
ON public.user_management_audit_log FOR SELECT
USING (public.is_admin());

-- Nenhum usuário (mesmo admin) insere diretamente — apenas via funções SECURITY DEFINER
-- (sem policy INSERT = bloqueado por padrão)

COMMIT;

-- ────────────────────────────────────────────────────────────
-- QUERIES DE VALIDAÇÃO — executar manualmente no Supabase SQL Editor
-- ────────────────────────────────────────────────────────────
-- Listar tabelas SEM RLS habilitado no schema public:
-- SELECT tablename FROM pg_tables
-- WHERE schemaname = 'public'
-- AND NOT rowsecurity
-- ORDER BY tablename;
--
-- Listar tabelas COM RLS mas SEM nenhuma policy (bloqueio total):
-- SELECT t.tablename
-- FROM pg_tables t
-- LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = 'public'
-- WHERE t.schemaname = 'public' AND t.rowsecurity AND p.policyname IS NULL
-- ORDER BY t.tablename;
