-- Validacao somente leitura da governanca RBAC e acesso temporario v1.
with checks as (
  select
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='organization_member_modules' and column_name='expires_at') as temporary_expiry_column_exists,
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='organization_member_modules' and column_name='assignment_justification') as temporary_justification_column_exists,
    to_regclass('public.rbac_privileged_permissions') is not null as privileged_catalog_exists,
    to_regclass('public.rbac_profile_change_requests') is not null as approval_request_table_exists,
    to_regprocedure('public.list_rbac_privileged_permissions_v1(uuid)') is not null as privileged_list_rpc_exists,
    to_regprocedure('public.submit_rbac_profile_change_v1(uuid,text,text,text,text,text,text,text[],text[])') is not null as approval_submit_rpc_exists,
    to_regprocedure('public.review_rbac_profile_change_v1(uuid,uuid,text,text)') is not null as approval_review_rpc_exists,
    to_regprocedure('public.list_rbac_governance_v1(uuid)') is not null as governance_rpc_exists,
    not has_function_privilege('anon', 'public.list_rbac_governance_v1(uuid)', 'EXECUTE') as anon_cannot_read_governance,
    has_function_privilege('authenticated', 'public.list_rbac_governance_v1(uuid)', 'EXECUTE') as authenticated_can_request_governance,
    not has_table_privilege('authenticated', 'public.rbac_profile_change_requests', 'SELECT') as clients_cannot_read_requests_directly,
    position('rbac_four_eyes_reviewer_required' in pg_get_functiondef('public.review_rbac_profile_change_v1(uuid,uuid,text,text)'::regprocedure)) > 0 as review_requires_distinct_admin,
    position('user_usage_events' in pg_get_functiondef('public.list_rbac_governance_v1(uuid)'::regprocedure)) > 0 as recommendations_use_real_activity,
    position('expires_at > now()' in pg_get_functiondef('public.get_my_organization_module_roles(uuid)'::regprocedure)) > 0 as runtime_ignores_expired_access,
    position('expires_at > now()' in pg_get_functiondef('public.can_quality_permission_v1(uuid,text)'::regprocedure)) > 0 as quality_guard_ignores_expired_access,
    (select bool_and(p.prosecdef and position('pg_temp' in pg_get_functiondef(p.oid)) > 0)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in (
        'list_rbac_privileged_permissions_v1','submit_rbac_profile_change_v1',
        'review_rbac_profile_change_v1','list_rbac_governance_v1',
        'get_organization_member_module_roles_v1','manage_organization_member_profile_v2'
      )) as governance_functions_are_hardened
)
select checks.*,
  temporary_expiry_column_exists and temporary_justification_column_exists
  and privileged_catalog_exists and approval_request_table_exists
  and privileged_list_rpc_exists and approval_submit_rpc_exists and approval_review_rpc_exists
  and governance_rpc_exists and anon_cannot_read_governance
  and authenticated_can_request_governance and clients_cannot_read_requests_directly
  and review_requires_distinct_admin and recommendations_use_real_activity
  and runtime_ignores_expired_access and quality_guard_ignores_expired_access
  and governance_functions_are_hardened
  as rbac_governance_temporary_access_validation_ok
from checks;
