-- ============================================================
-- FASE 5b: BACKFILL public.projetos → public.projects
-- Data: 2026-06-10
-- Dependência: Fase 5a (team_id, sla_id, legacy_projetos_id já existem)
-- PRINCÍPIO:
--   • public.projetos intocada — continua sendo a fonte do frontend.
--   • Backfill idempotente: WHERE NOT EXISTS garante re-run seguro.
--   • sla_id só migrado se existir em contract_slas (LEFT JOIN seguro).
--   • Slug gerado sem UNACCENT.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. BACKFILL: public.projetos → public.projects
--    sla_id: validado via LEFT JOIN em contract_slas.
--    Se o sla_id de projetos não existir em contract_slas,
--    migra como NULL (sem perda crítica — SLA herdado do contrato).
-- ============================================================
INSERT INTO public.projects (
  legacy_projetos_id,
  team_id,
  name,
  description,
  contract_id,
  sla_id,
  code,
  module_type,
  status,
  created_at,
  updated_at
)
SELECT
  p.id                                              AS legacy_projetos_id,
  p.team_id,
  p.nome                                            AS name,
  NULLIF(TRIM(p.descricao), '')                     AS description,
  p.contract_id,
  -- sla_id: NULL se o registro não existir em contract_slas
  CASE
    WHEN cs.id IS NOT NULL THEN p.sla_id
    ELSE NULL
  END                                               AS sla_id,
  -- slug: lowercase, remove colchetes, não-alfanumérico vira _
  LEFT(
    LOWER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          TRIM(p.nome),
          '[\[\]\(\)]+', '', 'g'
        ),
        '[^a-zà-ü0-9]+', '_', 'g'
      )
    ),
    50
  )                                                 AS code,
  'sustenance'                                      AS module_type,
  'active'                                          AS status,
  p.created_at,
  p.updated_at
FROM public.projetos p
LEFT JOIN public.contract_slas cs ON cs.id = p.sla_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.projects pr
  WHERE pr.legacy_projetos_id = p.id
);

-- ============================================================
-- 2. BACKFILL demandas.project_id
--    DISTINCT ON (d.id) garante um único project_id por demanda.
-- ============================================================
UPDATE public.demandas d
SET
  project_id = sub.project_id,
  updated_at = NOW()
FROM (
  SELECT DISTINCT ON (d2.id)
    d2.id          AS demanda_id,
    pr.id          AS project_id
  FROM public.demandas d2
  JOIN public.projects pr
    ON pr.team_id  = d2.team_id
   AND pr.status   = 'active'
   AND pr.legacy_projetos_id IS NOT NULL
  WHERE d2.project_id IS NULL
  ORDER BY d2.id, pr.created_at DESC
) sub
WHERE d.id = sub.demanda_id;

-- ============================================================
-- 3. LOG de cobertura pós-backfill
-- ============================================================
SELECT
  'projetos → projects'       AS operacao,
  (SELECT COUNT(*) FROM public.projetos)
                                AS total_legados,
  (SELECT COUNT(*) FROM public.projects
   WHERE  legacy_projetos_id IS NOT NULL)
                                AS migrados,
  (SELECT COUNT(*) FROM public.projetos p
   WHERE  NOT EXISTS (
     SELECT 1 FROM public.projects pr
     WHERE  pr.legacy_projetos_id = p.id
   ))                           AS nao_migrados

UNION ALL

SELECT
  'demandas.project_id'        AS operacao,
  COUNT(*)                      AS total_legados,
  COUNT(*) FILTER (WHERE project_id IS NOT NULL) AS migrados,
  COUNT(*) FILTER (WHERE project_id IS NULL)     AS nao_migrados
FROM public.demandas;

-- ============================================================
-- 4. DIAGNÓSTICO: sla_ids órfãos (migrados como NULL)
--    Mostra quais projetos tinham sla_id inválido para auditoria.
-- ============================================================
SELECT
  p.id           AS projetos_id,
  p.nome,
  p.sla_id       AS sla_id_original,
  'migrado como NULL' AS acao
FROM public.projetos p
LEFT JOIN public.contract_slas cs ON cs.id = p.sla_id
WHERE p.sla_id IS NOT NULL
  AND cs.id IS NULL;

COMMIT;

-- ============================================================
-- FIM
-- Próximo passo: Fase 5c — ProjetosManager no Admin (frontend)
-- Migration: 20260610_phase5b_backfill_projetos_to_projects.sql
-- ============================================================
