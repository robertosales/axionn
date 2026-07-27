-- Quality Intelligence — Features Granulares no Catálogo Comercial
-- Adiciona features específicas do Quality Intelligence ao módulo Quality existente
-- Garante que o módulo 'quality' exista antes de inserir features

BEGIN;

-- 1. Garantir que o módulo 'quality' existe
INSERT INTO public.product_modules (code, name, description, domain, display_order, status)
VALUES ('quality', 'Qualidade', 'Gestão de qualidade de software e testes', 'intelligence', 160, 'active')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  domain = EXCLUDED.domain,
  display_order = EXCLUDED.display_order,
  status = EXCLUDED.status;

-- 2. Features granulares do Quality Intelligence
WITH quality_module AS (
  SELECT id FROM public.product_modules WHERE code = 'quality' AND status = 'active'
),
features(module_id, code, name, feature_type, usage_unit, description) AS (
  VALUES
    -- Visualização básica (já existe como quality.view)
    ((SELECT id FROM quality_module), 'quality.cases.view', 'Visualizar Casos de Teste', 'capability', null, 'Listar e visualizar casos de teste'),
    ((SELECT id FROM quality_module), 'quality.cases.manage', 'Gerenciar Casos de Teste', 'capability', null, 'Criar, editar, versionar, arquivar casos'),
    
    ((SELECT id FROM quality_module), 'quality.suites.view', 'Visualizar Suítes', 'capability', null, 'Listar e visualizar suítes de teste'),
    ((SELECT id FROM quality_module), 'quality.suites.manage', 'Gerenciar Suítes', 'capability', null, 'Criar, editar, hierarquia, drag-drop, ciclos'),
    
    ((SELECT id FROM quality_module), 'quality.plans.view', 'Visualizar Planos', 'capability', null, 'Listar e visualizar planos de teste'),
    ((SELECT id FROM quality_module), 'quality.plans.manage', 'Gerenciar Planos', 'capability', null, 'Criar, editar, versão histórica, duplicar, arquivar'),
    
    ((SELECT id FROM quality_module), 'quality.execute', 'Executar Testes', 'capability', null, 'Runner manual com navegação, atalhos, notas'),
    
    ((SELECT id FROM quality_module), 'quality.evidences.view', 'Visualizar Evidências', 'capability', null, 'Ver evidências anexadas'),
    ((SELECT id FROM quality_module), 'quality.evidences.manage', 'Gerenciar Evidências', 'capability', null, 'Anexar (Storage/URL), remover, listar por etapa'),
    
    ((SELECT id FROM quality_module), 'quality.findings.view', 'Visualizar Achados', 'capability', null, 'Listar achados/defeitos'),
    ((SELECT id FROM quality_module), 'quality.findings.manage', 'Gerenciar Achados', 'capability', null, 'Criar, triar, resolver, fechar, vincular HU/run/step'),
    
    ((SELECT id FROM quality_module), 'quality.coverage.view', 'Visualizar Cobertura', 'capability', null, 'Matriz HU x Critério x Caso x Execução'),
    ((SELECT id FROM quality_module), 'quality.overview.view', 'Visualizar Overview', 'capability', null, 'Dashboard cards + listas HUs sem cobertura, casos stale, falhas'),
    
    -- Limites (opcional, para planos futuros)
    ((SELECT id FROM quality_module), 'quality.cases.max', 'Limite de Casos', 'limit', 'cases', 'Máximo de casos de teste por organização'),
    ((SELECT id FROM quality_module), 'quality.suites.max', 'Limite de Suítes', 'limit', 'suites', 'Máximo de suítes por organização'),
    ((SELECT id FROM quality_module), 'quality.executions.monthly', 'Execuções/mês', 'limit', 'executions', 'Execuções manuais por mês')
)
INSERT INTO public.product_features (module_id, code, name, feature_type, usage_unit, description, status, created_at, updated_at)
SELECT module_id, code, name, feature_type, usage_unit, description, 'active', now(), now()
FROM features
ON CONFLICT (code) DO UPDATE SET
  module_id = EXCLUDED.module_id,
  name = EXCLUDED.name,
  feature_type = EXCLUDED.feature_type,
  usage_unit = EXCLUDED.usage_unit,
  description = EXCLUDED.description,
  status = EXCLUDED.status,
  updated_at = now();

-- 2. Associar features aos planos (Core, Intelligence, Enterprise) - v1
WITH pv AS (
  SELECT pv.id AS plan_version_id, p.code AS plan_code
  FROM public.saas_plan_versions pv
  JOIN public.saas_plans p ON p.id = pv.plan_id
  WHERE pv.version = 1 AND pv.status = 'active'
),
feat_map(plan_code, feature_code, access_level, enabled, limit_value, reset_period, enforcement_mode, configuration) AS (
  VALUES
  -- CORE: apenas visualização básica
  ('core', 'quality.cases.view', 'basic', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('core', 'quality.suites.view', 'none', false, null::bigint, null, 'notify', '{}'::jsonb),
  ('core', 'quality.plans.view', 'none', false, null::bigint, null, 'notify', '{}'::jsonb),
  ('core', 'quality.execute', 'none', false, null::bigint, null, 'notify', '{}'::jsonb),
  ('core', 'quality.evidences.view', 'none', false, null::bigint, null, 'notify', '{}'::jsonb),
  ('core', 'quality.evidences.manage', 'none', false, null::bigint, null, 'notify', '{}'::jsonb),
  ('core', 'quality.findings.view', 'none', false, null::bigint, null, 'notify', '{}'::jsonb),
  ('core', 'quality.findings.manage', 'none', false, null::bigint, null, 'notify', '{}'::jsonb),
  ('core', 'quality.coverage.view', 'none', false, null::bigint, null, 'notify', '{}'::jsonb),
  ('core', 'quality.overview.view', 'none', false, null::bigint, null, 'notify', '{}'::jsonb),
  
  -- INTELLIGENCE: gestão completa
  ('intelligence', 'quality.cases.view', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('intelligence', 'quality.cases.manage', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('intelligence', 'quality.suites.view', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('intelligence', 'quality.suites.manage', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('intelligence', 'quality.plans.view', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('intelligence', 'quality.plans.manage', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('intelligence', 'quality.execute', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('intelligence', 'quality.evidences.view', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('intelligence', 'quality.evidences.manage', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('intelligence', 'quality.findings.view', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('intelligence', 'quality.findings.manage', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('intelligence', 'quality.coverage.view', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('intelligence', 'quality.overview.view', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  
  -- ENTERPRISE: tudo + limites maiores
  ('enterprise', 'quality.cases.view', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('enterprise', 'quality.cases.manage', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('enterprise', 'quality.suites.view', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('enterprise', 'quality.suites.manage', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('enterprise', 'quality.plans.view', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('enterprise', 'quality.plans.manage', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('enterprise', 'quality.execute', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('enterprise', 'quality.evidences.view', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('enterprise', 'quality.evidences.manage', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('enterprise', 'quality.findings.view', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('enterprise', 'quality.findings.manage', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('enterprise', 'quality.coverage.view', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  ('enterprise', 'quality.overview.view', 'full', true, null::bigint, null, 'notify', '{}'::jsonb),
  
  -- Limites Enterprise (opcional - sem hard limit por enquanto)
  ('enterprise', 'quality.cases.max', 'full', true, null::bigint, null, 'hard', '{}'::jsonb),
  ('enterprise', 'quality.suites.max', 'full', true, null::bigint, null, 'hard', '{}'::jsonb),
  ('enterprise', 'quality.executions.monthly', 'full', true, null::bigint, null, 'hard', '{}'::jsonb)
)
INSERT INTO public.saas_plan_version_features (plan_version_id, feature_id, access_level, enabled, limit_value, reset_period, enforcement_mode, configuration)
SELECT pv.plan_version_id, pf.id, fm.access_level, fm.enabled, fm.limit_value, fm.reset_period, fm.enforcement_mode, fm.configuration
FROM feat_map fm
JOIN pv ON pv.plan_code = fm.plan_code
JOIN public.product_features pf ON pf.code = fm.feature_code
ON CONFLICT (plan_version_id, feature_id) DO UPDATE SET
  access_level = EXCLUDED.access_level,
  enabled = EXCLUDED.enabled,
  limit_value = EXCLUDED.limit_value,
  reset_period = EXCLUDED.reset_period,
  enforcement_mode = EXCLUDED.enforcement_mode,
  configuration = EXCLUDED.configuration,
  updated_at = now();

COMMIT;