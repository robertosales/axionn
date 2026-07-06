-- ============================================================
-- FASE 5b: BACKFILL public.projetos → public.projects
-- Data: 2026-06-10
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
  legacy.id,
  legacy.team_id,
  legacy.nome,
  NULLIF(trim(legacy.descricao), ''),
  legacy.contract_id,
  CASE WHEN sla.id IS NOT NULL THEN legacy.sla_id ELSE NULL END,
  LEFT(
    LOWER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(trim(legacy.nome), '[\[\]\(\)]+', '', 'g'),
        '[^a-zà-ü0-9]+', '_', 'g'
      )
    ),
    50
  ),
  'sustenance',
  'active',
  legacy.created_at,
  legacy.updated_at
FROM public.projetos legacy
LEFT JOIN public.contract_slas sla ON sla.id = legacy.sla_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.projects project
  WHERE project.legacy_projetos_id = legacy.id
);

UPDATE public.demandas demand
SET
  project_id = candidate.project_id,
  updated_at = now()
FROM (
  SELECT DISTINCT ON (source.id)
    source.id AS demanda_id,
    project.id AS project_id
  FROM public.demandas source
  JOIN public.projects project
    ON project.team_id = source.team_id
   AND project.status = 'active'
   AND project.legacy_projetos_id IS NOT NULL
  WHERE source.project_id IS NULL
  ORDER BY source.id, project.created_at DESC
) candidate
WHERE demand.id = candidate.demanda_id;
