-- ============================================================
-- FASE 5a: EXPAND — projects recebe team_id + view de compatibilidade
-- Data: 2026-06-10
-- Estratégia: Expand → Migrate → Contract
-- PRINCÍPIO: 100% aditivo. Zero breaking changes.
--   • Nenhuma coluna alterada ou removida.
--   • public.projetos intocada — frontend continua funcionando.
--   • View vw_projetos expõe interface unificada para transição.
-- ============================================================

-- ============================================================
-- 1. ADICIONA team_id em public.projects
--    Nullable: projetos de nível contrato (sem time direto) ok.
--    ON DELETE SET NULL: exclusão de time não cascateia projetos.
-- ============================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS team_id UUID
    REFERENCES public.teams(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.projects.team_id IS
  'FK nullable para o time (sala) principal deste projeto. '
  'Adicionado na Fase 5a para suportar vínculo contrato → projeto → sala. '
  'Nullable: projetos de nível contrato sem sala dedicada continuam válidos.';

CREATE INDEX IF NOT EXISTS idx_projects_team_id
  ON public.projects (team_id)
  WHERE team_id IS NOT NULL;

-- ============================================================
-- 2. ADICIONA sla_id em public.projects
--    Preserva compatibilidade com public.projetos.sla_id.
--    Permite migração de dados sem perda de configuração de SLA.
-- ============================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS sla_id UUID
    REFERENCES public.contract_slas(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.projects.sla_id IS
  'FK para contract_slas. Migrado de public.projetos.sla_id na Fase 5b. '
  'Nullable: projetos sem SLA customizado herdam o SLA do contrato.';

-- ============================================================
-- 3. ADICIONA legacy_projetos_id em public.projects
--    Chave de rastreabilidade: guarda o id original de public.projetos.
--    Permite JOIN seguro durante a fase de transição.
-- ============================================================
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS legacy_projetos_id UUID;

COMMENT ON COLUMN public.projects.legacy_projetos_id IS
  'ID original de public.projetos. Preenchido na Fase 5b durante o backfill. '
  'Usado para rastrear correspondência durante a transição. '
  'NULL para projetos criados diretamente em public.projects.';

CREATE INDEX IF NOT EXISTS idx_projects_legacy_projetos_id
  ON public.projects (legacy_projetos_id)
  WHERE legacy_projetos_id IS NOT NULL;

-- ============================================================
-- 4. VIEW: vw_projetos
--    Interface unificada que expõe public.projetos (legada) e
--    public.projects (nova) com a mesma estrutura de colunas.
--    Frontend pode migrar para esta view sem mudar queries.
--
--    Colunas expostas compatíveis com interface Projeto do frontend:
--      id, team_id, nome, descricao, equipe, sla, sla_id,
--      contract_id, created_at, updated_at, contract_name, source
-- ============================================================
CREATE OR REPLACE VIEW public.vw_projetos AS

  -- Registros da tabela LEGADA (public.projetos)
  SELECT
    p.id,
    p.team_id,
    p.nome,
    p.descricao,
    p.equipe,
    p.sla,
    p.sla_id,
    p.contract_id,
    p.created_at,
    p.updated_at,
    c.name   AS contract_name,
    'legacy' AS source
  FROM public.projetos p
  LEFT JOIN public.contracts c ON c.id = p.contract_id

UNION ALL

  -- Registros da tabela NOVA (public.projects)
  -- Só inclui registros que NÃO têm correspondente em projetos (evita duplicatas)
  SELECT
    pr.id,
    pr.team_id,
    pr.name        AS nome,
    pr.description AS descricao,
    NULL           AS equipe,
    -- sla: fallback para 'padrao' se sla_id não estiver presente
    CASE
      WHEN pr.sla_id IS NOT NULL THEN 'customizado'
      ELSE 'padrao'
    END            AS sla,
    pr.sla_id,
    pr.contract_id,
    pr.created_at,
    pr.updated_at,
    c.name         AS contract_name,
    'new'          AS source
  FROM public.projects pr
  LEFT JOIN public.contracts c ON c.id = pr.contract_id
  WHERE pr.legacy_projetos_id IS NULL   -- exclui os que já vieram de projetos
    AND pr.status = 'active';

COMMENT ON VIEW public.vw_projetos IS
  'View de transição: unifica public.projetos (legada) e public.projects (nova). '
  'Expõe interface compatível com o frontend atual. '
  'source = legacy | new. '
  'Fase 5c irá redirecionar projetos.service.ts para esta view.';

GRANT SELECT ON public.vw_projetos TO authenticated;
GRANT SELECT ON public.vw_projetos TO service_role;

-- ============================================================
-- 5. RLS em public.projects — atualiza policy member_select
--    para incluir acesso via team_id direto (novo campo)
-- ============================================================
DROP POLICY IF EXISTS "projects_member_select" ON public.projects;
CREATE POLICY "projects_member_select"
  ON public.projects FOR SELECT
  USING (
    -- via contrato do usuário
    contract_id = get_user_contract_id()
    OR
    -- via team_id direto (novo vínculo Fase 5a)
    team_id IN (
      SELECT tm.team_id
      FROM   public.team_members tm
      WHERE  tm.user_id = auth.uid()
    )
  );

-- ============================================================
-- FIM
-- Próximo passo: Fase 5b — backfill public.projetos → public.projects
-- Migration: 20260610_phase5a_expand_projects_team_id_view.sql
-- ============================================================
