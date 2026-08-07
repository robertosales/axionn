-- OKR V2 - validação somente leitura do lock de publicação.
-- Executar após 20260731133000_okr_v2_publish_lock_scope_fix.sql.

with function_contract as (
  select
    publish.oid is not null as publish_function_exists,
    coalesce(publish.prosecdef, false) as publish_is_security_definer,
    coalesce(
      publish.proconfig @> array['search_path=public, pg_temp']::text[],
      false
    ) as publish_has_hardened_search_path,
    coalesce(
      pg_get_functiondef(publish.oid) ~* 'for\s+update\s+of\s+o\s*;',
      false
    ) as publish_locks_only_objective,
    coalesce(
      pg_get_functiondef(publish.oid)
        ~* 'okr_audit_log\s*\([^)]*\mmetadata\M[^)]*\)',
      false
    ) as publish_audit_uses_metadata,
    coalesce(
      pg_get_functiondef(publish.oid)
        !~* 'okr_audit_log\s*\([^)]*\mpayload\M[^)]*\)',
      false
    ) as publish_audit_does_not_use_payload,
    coalesce(
      pg_get_functiondef(publish.oid)
        ~* '_okr_v2_guard\s*\(p_org_id,\s*''okr\.edit''\s*\)',
      false
    ) as publish_keeps_permission_guard,
    coalesce(
      pg_get_functiondef(publish.oid)
        ~* 'lifecycle_status\s*=\s*''active''',
      false
    ) as publish_keeps_lifecycle_transition
  from (
    select to_regprocedure(
      'public.publish_okr_objective_v2(uuid,uuid)'
    ) as oid
  ) reference
  left join pg_proc publish on publish.oid = reference.oid
), privilege_contract as (
  select
    has_function_privilege(
      'authenticated',
      'public.publish_okr_objective_v2(uuid,uuid)',
      'execute'
    ) as authenticated_can_publish,
    has_function_privilege(
      'service_role',
      'public.publish_okr_objective_v2(uuid,uuid)',
      'execute'
    ) as service_role_can_publish,
    not has_function_privilege(
      'anon',
      'public.publish_okr_objective_v2(uuid,uuid)',
      'execute'
    ) as anon_cannot_publish
)
select
  contract.publish_function_exists,
  contract.publish_is_security_definer,
  contract.publish_has_hardened_search_path,
  contract.publish_locks_only_objective,
  contract.publish_audit_uses_metadata,
  contract.publish_audit_does_not_use_payload,
  contract.publish_keeps_permission_guard,
  contract.publish_keeps_lifecycle_transition,
  privileges.authenticated_can_publish,
  privileges.service_role_can_publish,
  privileges.anon_cannot_publish,
  contract.publish_function_exists
    and contract.publish_is_security_definer
    and contract.publish_has_hardened_search_path
    and contract.publish_locks_only_objective
    and contract.publish_audit_uses_metadata
    and contract.publish_audit_does_not_use_payload
    and contract.publish_keeps_permission_guard
    and contract.publish_keeps_lifecycle_transition
    and privileges.authenticated_can_publish
    and privileges.service_role_can_publish
    and privileges.anon_cannot_publish
    as okr_v2_publish_lock_scope_validation_ok
from function_contract contract
cross join privilege_contract privileges;
