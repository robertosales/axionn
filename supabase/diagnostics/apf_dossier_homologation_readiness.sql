with required_objects(kind, name, present) as (
  values
    ('table', 'apf_evidence_dossiers', to_regclass('public.apf_evidence_dossiers') is not null),
    ('table', 'apf_dossier_versions', to_regclass('public.apf_dossier_versions') is not null),
    ('table', 'apf_measurement_batches', to_regclass('public.apf_measurement_batches') is not null),
    ('table', 'apf_jira_webhook_integrations', to_regclass('public.apf_jira_webhook_integrations') is not null),
    ('function', 'validate_apf_dossier_snapshot', to_regprocedure('public.validate_apf_dossier_snapshot(uuid,jsonb,text,text,numeric)') is not null),
    ('function', 'homologate_apf_dossier', to_regprocedure('public.homologate_apf_dossier(uuid,integer)') is not null),
    ('function', 'authorize_apf_dossier_export', to_regprocedure('public.authorize_apf_dossier_export(uuid)') is not null),
    ('function', 'import_apf_functional_specification_v2', to_regprocedure('public.import_apf_functional_specification_v2(uuid,text,text,text,jsonb,jsonb)') is not null)
),
required_permissions(key, label) as (
  values
    ('apf.dossier.collect_evidence', 'Coletar evidências APF'),
    ('apf.dossier.create', 'Criar dossiês APF'),
    ('apf.dossier.export', 'Exportar dossiês APF'),
    ('apf.dossier.homologate', 'Homologar dossiês APF'),
    ('apf.dossier.manage_templates', 'Gerenciar templates APF'),
    ('apf.dossier.review', 'Revisar dossiês APF'),
    ('apf.dossier.validate', 'Validar dossiês APF'),
    ('apf.dossier.view', 'Visualizar dossiês APF')
),
checks as (
  select
    'object'::text as category,
    kind || ':' || name as item,
    case when present then 'PASS' else 'FAIL' end as status,
    case when present then 'Objeto presente' else 'Objeto ausente' end as details
  from required_objects

  union all

  select
    'permission',
    required.key,
    case when actual.key is not null then 'PASS' else 'FAIL' end,
    coalesce(actual.label, 'Permissão ausente')
  from required_permissions required
  left join public.app_permissions actual on actual.key = required.key

  union all

  select
    'event',
    event_type,
    'INFO',
    count(*)::text || ' evento(s) registrado(s)'
  from public.apf_dossier_events
  group by event_type
)
select category, item, status, details
from checks
order by
  case category when 'object' then 1 when 'permission' then 2 else 3 end,
  item;
