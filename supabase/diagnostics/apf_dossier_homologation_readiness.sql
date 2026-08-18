with required_objects(kind,name,present)as(
 values
 ('table','apf_evidence_dossiers',to_regclass('public.apf_evidence_dossiers')is not null),
 ('table','apf_dossier_versions',to_regclass('public.apf_dossier_versions')is not null),
 ('table','apf_measurement_batches',to_regclass('public.apf_measurement_batches')is not null),
 ('table','apf_jira_webhook_integrations',to_regclass('public.apf_jira_webhook_integrations')is not null),
 ('function','validate_apf_dossier_snapshot',to_regprocedure('public.validate_apf_dossier_snapshot(uuid,jsonb,text,text,numeric)')is not null),
 ('function','homologate_apf_dossier',to_regprocedure('public.homologate_apf_dossier(uuid,integer)')is not null),
 ('function','authorize_apf_dossier_export',to_regprocedure('public.authorize_apf_dossier_export(uuid)')is not null),
 ('function','import_apf_functional_specification_v2',to_regprocedure('public.import_apf_functional_specification_v2(uuid,text,text,text,jsonb,jsonb)')is not null)
)
select kind,name,case when present then'present'else'missing'end as status from required_objects order by kind,name;

select key,label from public.app_permissions where key like'apf.dossier.%'order by key;

select event_type,count(*)as event_count from public.apf_dossier_events group by event_type order by event_type;
