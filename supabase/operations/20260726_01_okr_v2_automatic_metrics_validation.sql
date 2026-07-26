-- OKR V2 PR 7 - validacao somente leitura de metricas automaticas e fila.
-- Execute depois de 20260726100000_okr_v2_automatic_metrics_queue.sql.

with expected_tables(table_name) as (
  values
    ('okr_metric_definitions'),
    ('okr_metric_versions'),
    ('okr_metric_bindings')
),
expected_functions(signature) as (
  values
    ('public.claim_okr_recalculation_jobs_v1(text,integer,integer)'),
    ('public.enqueue_due_okr_metric_bindings_v1()'),
    ('public.request_okr_measurement_v2(uuid)'),
    ('public.finish_okr_recalculation_job_v1(uuid,text,boolean,jsonb,text)'),
    ('public.apply_okr_measurement_v2(uuid,uuid,uuid,numeric,timestamp with time zone,timestamp with time zone,text,jsonb)')
),
function_definitions as (
  select
    expected.signature,
    to_regprocedure(expected.signature) as procedure_oid,
    coalesce(pg_get_functiondef(to_regprocedure(expected.signature)), '') as definition
  from expected_functions expected
),
checks as (
  select
    (
      select count(*) = 3
      from expected_tables expected
      where to_regclass('public.' || expected.table_name) is not null
    ) as metric_tables_available,
    (
      select count(*) = 3
      from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      join expected_tables expected on expected.table_name = relation.relname
      where namespace.nspname = 'public'
        and relation.relrowsecurity
    ) as metric_tables_with_rls,
    (
      select count(*) = 5
      from function_definitions
      where procedure_oid is not null
    ) as metric_rpcs_available,
    (
      select bool_and(definition ~* 'security definer')
      from function_definitions
    ) as metric_rpcs_security_definer,
    (
      select bool_and(definition ~* 'set search_path = public')
      from function_definitions
    ) as metric_rpcs_safe_search_path,
    (
      select definition ~* 'for update skip locked'
      from function_definitions
      where signature = 'public.claim_okr_recalculation_jobs_v1(text,integer,integer)'
    ) as queue_claim_uses_skip_locked,
    (
      select definition ~* 'lease_expires_at'
      from function_definitions
      where signature = 'public.claim_okr_recalculation_jobs_v1(text,integer,integer)'
    ) as queue_claim_has_lease,
    (
      select definition ~* 'dead_letter'
        and definition ~* 'interval ''1 minute'''
        and definition ~* 'interval ''5 minutes'''
        and definition ~* 'interval ''15 minutes'''
        and definition ~* 'interval ''1 hour'''
      from function_definitions
      where signature = 'public.finish_okr_recalculation_job_v1(uuid,text,boolean,jsonb,text)'
    ) as queue_retry_policy_present,
    not has_function_privilege(
      'anon',
      'public.apply_okr_measurement_v2(uuid,uuid,uuid,numeric,timestamp with time zone,timestamp with time zone,text,jsonb)',
      'EXECUTE'
    ) as anon_cannot_apply_measurements,
    not has_function_privilege(
      'authenticated',
      'public.apply_okr_measurement_v2(uuid,uuid,uuid,numeric,timestamp with time zone,timestamp with time zone,text,jsonb)',
      'EXECUTE'
    ) as authenticated_cannot_apply_measurements,
    has_function_privilege(
      'service_role',
      'public.apply_okr_measurement_v2(uuid,uuid,uuid,numeric,timestamp with time zone,timestamp with time zone,text,jsonb)',
      'EXECUTE'
    ) as service_role_can_apply_measurements,
    has_function_privilege(
      'authenticated',
      'public.request_okr_measurement_v2(uuid)',
      'EXECUTE'
    ) as authenticated_can_request_measurements,
    (
      select count(*) >= 4
      from public.okr_metric_definitions definition
      join public.okr_metric_versions version
        on version.metric_definition_id = definition.id
      where definition.organization_id is null
        and definition.status = 'active'
        and version.deprecated_at is null
    ) as canonical_metric_catalog_available
)
select
  *,
  metric_tables_available
    and metric_tables_with_rls
    and metric_rpcs_available
    and metric_rpcs_security_definer
    and metric_rpcs_safe_search_path
    and queue_claim_uses_skip_locked
    and queue_claim_has_lease
    and queue_retry_policy_present
    and anon_cannot_apply_measurements
    and authenticated_cannot_apply_measurements
    and service_role_can_apply_measurements
    and authenticated_can_request_measurements
    and canonical_metric_catalog_available
    as okr_v2_automatic_metrics_validation_ok
from checks;
