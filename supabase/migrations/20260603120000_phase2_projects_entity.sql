-- ============================================================
-- MIGRATION: Fase 2 — Entidade projects
-- Hierarquia: contract → project → team → demanda/rdm
-- Data: 2026-06-03
-- Branch: feature/contracts-sla-module
--
-- PRINCÍPIO: 100% aditivo.
--   • Nenhuma coluna existente alterada.
--   • Nenhuma tabela dropada.
--   • Todas as novas FKs são NULLABLE com ON DELETE SET NULL.
--   • Código e banco legados continuam funcionando sem alteração.
-- ============================================================

-- ============================================================
-- 1. TABELA: projects
--    Camada intermediária entre contracts e teams.
--    Representa NEXO, GESP3, EPOL, MITRA etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  UUID        NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  code         VARCHAR(50),                          -- código externo (ex: Redmine project id)
  description  TEXT,
  module_type  VARCHAR(50) NOT NULL DEFAULT 'sustenance'
               CHECK (module_type IN ('sustenance', 'agile', 'mixed')),
  status       VARCHAR(50) NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'paused', 'archived')),
  redmine_id   INTEGER,                              -- ID do projeto no Redmine (nullable)
  created_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_project_contract_code UNIQUE (contract_id, code)
);

COMMENT ON TABLE  public.projects              IS 'Projetos vinculados a um contrato. Ex: NEXO, GESP3, EPOL, MITRA.';
COMMENT ON COLUMN public.projects.code         IS 'Código curto único por contrato. Usado como chave de integração com Redmine.';
COMMENT ON COLUMN public.projects.module_type  IS 'sustenance = Sala de Sustentação (Redmine), agile = Sala Ágil (Sprints), mixed = ambos.';
COMMENT ON COLUMN public.projects.redmine_id   IS 'ID do projeto no Redmine para sincronização de demandas. Nullable.';

-- ============================================================
-- 2. TRIGGER updated_at em projects
-- ============================================================
DROP TRIGGER IF EXISTS trg_projects_updated_at ON public.projects;
CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

-- ============================================================
-- 3. FKs ADITIVAS — teams
--    project_id nullable: times legados sem projeto continuam OK.
-- ============================================================
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS project_id UUID
    REFERENCES public.projects(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.teams.project_id IS
  'FK nullable para projects. Times legados sem projeto continuam funcionando.';

-- ============================================================
-- 4. FKs ADITIVAS — demandas
--    contract_id: herda do contrato via project → team.
--    project_id:  vínculo direto para queries rápidas sem joins.
-- ============================================================
ALTER TABLE public.demandas
  ADD COLUMN IF NOT EXISTS contract_id UUID
    REFERENCES public.contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id  UUID
    REFERENCES public.projects(id)  ON DELETE SET NULL;

COMMENT ON COLUMN public.demandas.contract_id IS
  'Desnormalização intencional: contrato da demanda (evita joins profundos em SLA).';
COMMENT ON COLUMN public.demandas.project_id  IS
  'FK para o projeto de origem. Nullable para demandas legadas sem projeto formal.';

-- ============================================================
-- 5. FKs ADITIVAS — rdms
--    project_id substitui gradualmente sistema_modulo (texto livre).
--    sistema_modulo permanece para compatibilidade com código existente.
-- ============================================================
ALTER TABLE public.rdms
  ADD COLUMN IF NOT EXISTS project_id UUID
    REFERENCES public.projects(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.rdms.project_id IS
  'FK para projects. Substitui gradualmente o campo sistema_modulo (texto livre). '
  'sistema_modulo mantido para retrocompatibilidade.';

-- ============================================================
-- 6. ÍNDICES DE PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_projects_contract
  ON public.projects (contract_id);

CREATE INDEX IF NOT EXISTS idx_projects_module_type
  ON public.projects (module_type)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_projects_redmine_id
  ON public.projects (redmine_id)
  WHERE redmine_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_teams_project
  ON public.teams (project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_demandas_contract
  ON public.demandas (contract_id)
  WHERE contract_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_demandas_project
  ON public.demandas (project_id)
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rdms_project
  ON public.rdms (project_id)
  WHERE project_id IS NOT NULL;

-- ============================================================
-- 7. ROW LEVEL SECURITY — projects
-- ============================================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Admin vê e gerencia tudo
DROP POLICY IF EXISTS "projects_admin_all" ON public.projects;
CREATE POLICY "projects_admin_all"
  ON public.projects FOR ALL
  USING (is_admin());

-- Membros veem projetos dos seus times
DROP POLICY IF EXISTS "projects_member_select" ON public.projects;
CREATE POLICY "projects_member_select"
  ON public.projects FOR SELECT
  USING (
    id IN (
      SELECT t.project_id
      FROM   public.teams t
      JOIN   public.team_members tm ON tm.team_id = t.id
      WHERE  tm.user_id = auth.uid()
        AND  t.project_id IS NOT NULL
    )
    OR
    id IN (
      SELECT t.project_id
      FROM   public.teams t
      JOIN   public.profiles p ON p.team_id = t.id
      WHERE  p.user_id = auth.uid()
        AND  t.project_id IS NOT NULL
    )
  );

-- Usuários autenticados podem inserir projetos (admin confirma via política above)
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
CREATE POLICY "projects_insert"
  ON public.projects FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "projects_update" ON public.projects;
CREATE POLICY "projects_update"
  ON public.projects FOR UPDATE
  USING (is_admin());

-- ============================================================
-- 8. RPC: fn_get_contract_tree
--    Retorna a árvore completa: contract → projects → teams
--    Usada pelo painel do admin e pelo seletor de contexto.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_get_contract_tree(
  p_contract_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'contract_id',     c.id,
      'contract_name',   c.name,
      'contract_status', c.status,
      'projects', (
        SELECT jsonb_agg(
          jsonb_build_object(
            'project_id',   p.id,
            'project_name', p.name,
            'project_code', p.code,
            'module_type',  p.module_type,
            'redmine_id',   p.redmine_id,
            'teams', (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'team_id',   t.id,
                  'team_name', t.name,
                  'team_type', t.team_type,
                  'member_count', (
                    SELECT COUNT(*)
                    FROM   public.team_members tm
                    WHERE  tm.team_id = t.id
                  )
                )
              )
              FROM public.teams t
              WHERE t.project_id = p.id
            )
          )
        )
        FROM public.projects p
        WHERE p.contract_id = c.id
          AND p.status = 'active'
      )
    )
  )
  INTO v_result
  FROM public.contracts c
  WHERE (p_contract_id IS NULL OR c.id = p_contract_id)
    AND c.status = 'active';

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.fn_get_contract_tree IS
  'Retorna a hierarquia completa contract → projects → teams → member_count. '
  'Usada pelo painel admin e pelo seletor de contexto do usuário.';

GRANT EXECUTE ON FUNCTION public.fn_get_contract_tree(UUID) TO authenticated;

-- ============================================================
-- 9. RPC: fn_get_project_sla_matrix
--    Retorna o projeto + contrato + matriz de SLA em uma call.
--    Frontend usa isso ao abrir uma demanda de sustentação.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_get_project_sla_matrix(
  p_project_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'project_id',      p.id,
    'project_name',    p.name,
    'project_code',    p.code,
    'module_type',     p.module_type,
    'contract_id',     c.id,
    'contract_name',   c.name,
    'contract_status', c.status,
    'sla_matrix', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'priority',                 s.priority,
          'response_time_minutes',    s.response_time_minutes,
          'resolution_time_minutes',  s.resolution_time_minutes,
          'business_hours_only',      s.business_hours_only
        ) ORDER BY
          CASE s.priority
            WHEN 'urgent' THEN 1
            WHEN 'high'   THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low'    THEN 4
          END
      )
      FROM public.contract_slas s
      WHERE s.contract_id = c.id
    )
  )
  INTO v_result
  FROM public.projects  p
  JOIN public.contracts c ON c.id = p.contract_id
  WHERE p.id = p_project_id;

  RETURN COALESCE(v_result, jsonb_build_object(
    'error', 'project_not_found',
    'project_id', p_project_id
  ));
END;
$$;

COMMENT ON FUNCTION public.fn_get_project_sla_matrix IS
  'Retorna projeto + contrato + matriz SLA completa em uma única call. '
  'Chamada pelo frontend ao abrir demanda de sustentação para exibir SLA correto.';

GRANT EXECUTE ON FUNCTION public.fn_get_project_sla_matrix(UUID) TO authenticated;

-- ============================================================
-- 10. RPC: fn_resolve_demanda_context
--     Dado um demanda_id, resolve contract_id e project_id
--     navegando pela cadeia team → project → contract.
--     Útil para demandas legadas que ainda não têm as FKs preenchidas.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_resolve_demanda_context(
  p_demanda_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Tenta primeiro via FK direta (demandas já migradas)
  SELECT jsonb_build_object(
    'demanda_id',   d.id,
    'contract_id',  COALESCE(d.contract_id, t.contract_id, proj.contract_id),
    'project_id',   COALESCE(d.project_id,  t.project_id),
    'team_id',      d.team_id,
    'source',       CASE
                      WHEN d.contract_id IS NOT NULL THEN 'direct_fk'
                      WHEN t.contract_id IS NOT NULL THEN 'via_team_contract'
                      WHEN t.project_id  IS NOT NULL THEN 'via_team_project'
                      ELSE 'unresolved'
                    END
  )
  INTO v_result
  FROM  public.demandas  d
  LEFT  JOIN public.teams     t    ON t.id    = d.team_id
  LEFT  JOIN public.projects  proj ON proj.id = t.project_id
  WHERE d.id = p_demanda_id;

  RETURN COALESCE(v_result, jsonb_build_object(
    'error',      'demanda_not_found',
    'demanda_id', p_demanda_id
  ));
END;
$$;

COMMENT ON FUNCTION public.fn_resolve_demanda_context IS
  'Resolve contract_id e project_id de uma demanda navegando pela cadeia FK. '
  'Funciona para demandas legadas (sem FK direta) e para demandas já migradas. '
  'Fonte indicada no campo source: direct_fk | via_team_contract | via_team_project | unresolved.';

GRANT EXECUTE ON FUNCTION public.fn_resolve_demanda_context(UUID) TO authenticated;

-- ============================================================
-- 11. SEED HELPER: view para facilitar migração de dados legados
--     Admin usa essa view para ver quais rdms ainda têm
--     sistema_modulo sem project_id vinculado.
-- ============================================================
CREATE OR REPLACE VIEW public.vw_rdms_sem_projeto AS
SELECT
  r.id,
  r.codigo,
  r.nome,
  r.sistema_modulo,
  r.team_id,
  t.name       AS team_name,
  t.project_id AS team_project_id,
  r.created_at
FROM  public.rdms  r
LEFT  JOIN public.teams t ON t.id = r.team_id
WHERE r.project_id IS NULL
ORDER BY r.created_at DESC;

COMMENT ON VIEW public.vw_rdms_sem_projeto IS
  'RDMs ainda sem project_id vinculado. '
  'Use para guiar a migração de dados legados da Fase 5.';

-- ============================================================
-- FIM DA MIGRATION
-- Próximo passo: Fase 3 — calc_sla_demanda usa matrix dinâmica
-- via fn_resolve_demanda_context → fn_get_project_sla_matrix
-- ============================================================
