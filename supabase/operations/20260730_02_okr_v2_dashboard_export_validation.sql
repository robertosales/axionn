-- PR 10 - validacao cumulativa somente leitura.
-- Executar no SQL Editor autorizado apos aplicar a migration do dashboard.

with function_contract as (
  select
    count(*) filter (
      where p.oid = to_regprocedure(
        'public.get_okr_dashboard_v1(uuid,uuid,uuid,text)'
      )
    ) = 1 as dashboard_rpc_exists,
    count(*) filter (
      where p.oid = to_regprocedure(
        'public.request_okr_export_v1(uuid,uuid[],text)'
      )
    ) = 1 as export_rpc_exists,
    bool_and(
      p.prosecdef
      and 'search_path=public, pg_temp' = any(coalesce(p.proconfig, '{}'::text[]))
    ) as functions_are_hardened
  from pg_proc p
  where p.oid in (
    to_regprocedure('public.get_okr_dashboard_v1(uuid,uuid,uuid,text)'),
    to_regprocedure('public.request_okr_export_v1(uuid,uuid[],text)')
  )
),
grant_contract as (
  select
    has_function_privilege(
      'authenticated',
      'public.get_okr_dashboard_v1(uuid,uuid,uuid,text)',
      'execute'
    ) as authenticated_can_read_dashboard,
    has_function_privilege(
      'authenticated',
      'public.request_okr_export_v1(uuid,uuid[],text)',
      'execute'
    ) as authenticated_can_request_export,
    not has_function_privilege(
      'anon',
      'public.get_okr_dashboard_v1(uuid,uuid,uuid,text)',
      'execute'
    ) as anon_cannot_read_dashboard,
    not has_function_privilege(
      'anon',
      'public.request_okr_export_v1(uuid,uuid[],text)',
      'execute'
    ) as anon_cannot_export
),
table_contract as (
  select
    to_regclass('public.okr_export_events') is not null as export_events_exists,
    coalesce(c.relrowsecurity, false) as export_events_rls_enabled,
    not has_table_privilege(
      'authenticated',
      'public.okr_export_events',
      'select'
    ) as clients_cannot_read_export_audit
  from pg_class c
  where c.oid = to_regclass('public.okr_export_events')
),
source_contract as (
  select
    position(
      'o.organization_id = p_org_id'
      in pg_get_functiondef(
        to_regprocedure('public.get_okr_dashboard_v1(uuid,uuid,uuid,text)')
      )
    ) > 0 as dashboard_is_tenant_scoped,
    position(
      'pg_advisory_xact_lock'
      in pg_get_functiondef(
        to_regprocedure('public.request_okr_export_v1(uuid,uuid[],text)')
      )
    ) > 0 as export_quota_is_serialized
)
select
  fc.*,
  gc.*,
  tc.*,
  sc.*,
  (
    fc.dashboard_rpc_exists
    and fc.export_rpc_exists
    and fc.functions_are_hardened
    and gc.authenticated_can_read_dashboard
    and gc.authenticated_can_request_export
    and gc.anon_cannot_read_dashboard
    and gc.anon_cannot_export
    and tc.export_events_exists
    and tc.export_events_rls_enabled
    and tc.clients_cannot_read_export_audit
    and sc.dashboard_is_tenant_scoped
    and sc.export_quota_is_serialized
  ) as okr_v2_dashboard_export_validation_ok
from function_contract fc
cross join grant_contract gc
cross join table_contract tc
cross join source_contract sc;
