-- Seed OKR features no catálogo comercial + mapeamento nas versões de plano (v1)
-- Executar exclusivamente pelo Lovable após revisão.
begin;

-- 1. Garantir que as features OKR existam em product_features
with okr_features(module_code, code, name, feature_type, usage_unit) as (
  values
    ('okr', 'okr.view', 'Visualizar OKRs', 'capability', null),
    ('okr', 'okr.create', 'Criar objetivos e KRs', 'capability', null),
    ('okr', 'okr.edit', 'Editar objetivos e KRs', 'capability', null),
    ('okr', 'okr.archive', 'Arquivar objetivos', 'capability', null),
    ('okr', 'okr.check_in', 'Check-in de Key Results', 'capability', null),
    ('okr', 'okr.initiatives', 'Iniciativas vinculadas a KRs', 'capability', null),
    ('okr', 'okr.automatic_metrics', 'Medições automáticas de OKR', 'capability', null),
    ('okr', 'okr.history', 'Histórico e snapshots de OKR', 'capability', null),
    ('okr', 'okr.export', 'Exportação de OKRs (CSV/PDF)', 'capability', null),
    ('okr', 'okr.ai_recommendations', 'Recomendações de IA para OKRs', 'capability', null)
)
insert into public.product_features (module_id, code, name, feature_type, usage_unit)
select m.id, f.code, f.name, f.feature_type, f.usage_unit
from okr_features f
join public.product_modules m on m.code = f.module_code
where m.status = 'active'
on conflict (code) do update set
  module_id = excluded.module_id,
  name = excluded.name,
  feature_type = excluded.feature_type,
  usage_unit = excluded.usage_unit,
  updated_at = now();

-- 2. Mapear features OKR nas versões de plano (v1) conforme matriz comercial
-- Core: view, create, edit, archive, check_in  (iniciativas limitadas, sem auto, sem history, sem export, sem AI)
-- Intelligence: tudo do Core + initiatives, automatic_metrics, history  (sem export, sem AI)
-- Enterprise: tudo

with plan_versions as (
  select pv.id as plan_version_id, p.code as plan_code
  from public.saas_plan_versions pv
  join public.saas_plans p on p.id = pv.plan_id
  where pv.version = 1 and pv.status = 'active'
),
okr_feature_map(plan_code, feature_code, access_level, enabled, limit_value, configuration) as (
  values
    -- Core (starter)
    ('starter', 'okr.view', 'full', true, null, '{}'::jsonb),
    ('starter', 'okr.create', 'full', true, null, '{}'::jsonb),
    ('starter', 'okr.edit', 'full', true, null, '{}'::jsonb),
    ('starter', 'okr.archive', 'full', true, null, '{}'::jsonb),
    ('starter', 'okr.check_in', 'full', true, null, '{}'::jsonb),
    ('starter', 'okr.initiatives', 'basic', true, 3, '{"max_initiatives_per_kr": 3}'::jsonb),
    ('starter', 'okr.automatic_metrics', 'none', false, null, '{}'::jsonb),
    ('starter', 'okr.history', 'basic', true, 90, '{"retention_days": 90}'::jsonb),
    ('starter', 'okr.export', 'none', false, null, '{}'::jsonb),
    ('starter', 'okr.ai_recommendations', 'none', false, null, '{}'::jsonb),

    -- Intelligence (pro)
    ('pro', 'okr.view', 'full', true, null, '{}'::jsonb),
    ('pro', 'okr.create', 'full', true, null, '{}'::jsonb),
    ('pro', 'okr.edit', 'full', true, null, '{}'::jsonb),
    ('pro', 'okr.archive', 'full', true, null, '{}'::jsonb),
    ('pro', 'okr.check_in', 'full', true, null, '{}'::jsonb),
    ('pro', 'okr.initiatives', 'full', true, null, '{}'::jsonb),
    ('pro', 'okr.automatic_metrics', 'full', true, null, '{}'::jsonb),
    ('pro', 'okr.history', 'full', true, 365, '{"retention_days": 365}'::jsonb),
    ('pro', 'okr.export', 'basic', true, 10, '{"monthly_exports": 10, "formats": ["csv"]}'::jsonb),
    ('pro', 'okr.ai_recommendations', 'none', false, null, '{}'::jsonb),

    -- Enterprise
    ('enterprise', 'okr.view', 'full', true, null, '{}'::jsonb),
    ('enterprise', 'okr.create', 'full', true, null, '{}'::jsonb),
    ('enterprise', 'okr.edit', 'full', true, null, '{}'::jsonb),
    ('enterprise', 'okr.archive', 'full', true, null, '{}'::jsonb),
    ('enterprise', 'okr.check_in', 'full', true, null, '{}'::jsonb),
    ('enterprise', 'okr.initiatives', 'full', true, null, '{}'::jsonb),
    ('enterprise', 'okr.automatic_metrics', 'full', true, null, '{}'::jsonb),
    ('enterprise', 'okr.history', 'full', true, null, '{"retention_days": null}'::jsonb),
    ('enterprise', 'okr.export', 'full', true, null, '{"formats": ["csv", "pdf", "xlsx"]}'::jsonb),
    ('enterprise', 'okr.ai_recommendations', 'full', true, null, '{}'::jsonb)
)
insert into public.saas_plan_version_features (plan_version_id, feature_id, access_level, enabled, limit_value, configuration)
select pv.plan_version_id, pf.id, fm.access_level, fm.enabled, fm.limit_value, fm.configuration
from okr_feature_map fm
join plan_versions pv on pv.plan_code = fm.plan_code
join public.product_features pf on pf.code = fm.feature_code
on conflict (plan_version_id, feature_id) do update set
  access_level = excluded.access_level,
  enabled = excluded.enabled,
  limit_value = excluded.limit_value,
  configuration = excluded.configuration,
  updated_at = now();

commit;