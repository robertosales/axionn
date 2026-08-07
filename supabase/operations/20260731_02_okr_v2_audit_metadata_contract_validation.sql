-- OKR V2 - validação somente leitura do contrato canônico de auditoria.
-- Executar após 20260731123000_okr_v2_audit_metadata_contract_fix.sql.

with required_functions(signature) as (
  values
    ('public.create_okr_objective_v2(uuid,jsonb)'),
    ('public.update_okr_objective_v2(uuid,uuid,jsonb)'),
    ('public.archive_okr_objective_v2(uuid,uuid,text)'),
    ('public.create_okr_alignment_v1(uuid,jsonb)'),
    ('public.archive_okr_alignment_v1(uuid,uuid)'),
    ('public.create_okr_key_result_v2(uuid,uuid,jsonb)'),
    ('public.update_okr_key_result_v2(uuid,uuid,jsonb)'),
    ('public.archive_okr_key_result_v2(uuid,uuid,text)'),
    ('public.publish_okr_objective_v2(uuid,uuid)')
), function_contract as (
  select
    count(*) = 9 as required_function_count_is_nine,
    count(proc.oid) = 9 as all_required_functions_exist,
    coalesce(bool_and(proc.prosecdef), false)
      as all_required_functions_are_security_definer,
    coalesce(bool_and(
      case when proc.oid is null then false
      else pg_get_functiondef(proc.oid)
        ~* 'okr_audit_log\s*\([^)]*\mmetadata\M[^)]*\)'
      end
    ), false) as all_audit_inserts_use_metadata,
    coalesce(bool_and(
      case when proc.oid is null then false
      else pg_get_functiondef(proc.oid)
        !~* 'okr_audit_log\s*\([^)]*\mpayload\M[^)]*\)'
      end
    ), false) as no_audit_insert_uses_payload
  from required_functions required
  left join pg_proc proc
    on proc.oid = to_regprocedure(required.signature)
), table_contract as (
  select
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'okr_audit_log'
        and column_name = 'metadata'
        and data_type = 'jsonb'
    ) as audit_metadata_column_exists,
    not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'okr_audit_log'
        and column_name = 'payload'
    ) as audit_payload_column_does_not_exist
)
select
  functions.required_function_count_is_nine,
  functions.all_required_functions_exist,
  functions.all_required_functions_are_security_definer,
  functions.all_audit_inserts_use_metadata,
  functions.no_audit_insert_uses_payload,
  audit.audit_metadata_column_exists,
  audit.audit_payload_column_does_not_exist,
  functions.required_function_count_is_nine
    and functions.all_required_functions_exist
    and functions.all_required_functions_are_security_definer
    and functions.all_audit_inserts_use_metadata
    and functions.no_audit_insert_uses_payload
    and audit.audit_metadata_column_exists
    and audit.audit_payload_column_does_not_exist
    as okr_v2_audit_metadata_contract_validation_ok
from function_contract functions
cross join table_contract audit;
