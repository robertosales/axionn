-- OKR V2 - smoke test transacional e somente leitura da RPC do dashboard.
-- Executar depois de 20260730200000_okr_v2_dashboard_grouping_fix.sql.
-- A transacao e revertida ao final e nenhum dado de negocio e retornado.

begin;

create temporary table okr_dashboard_runtime_context
on commit drop
as
select
  member.org_id,
  member.user_id
from public.organization_members member
where member.is_active
  and public.has_okr_permission_v2(
    member.user_id,
    'okr.view',
    member.org_id
  )
order by member.joined_at
limit 1;

do $validation$
declare
  v_user_id uuid;
begin
  select context.user_id
    into v_user_id
  from pg_temp.okr_dashboard_runtime_context context;

  if v_user_id is null then
    raise exception 'OKR_V2_DASHBOARD_RUNTIME_VALIDATION_NO_AUTHORIZED_MEMBER';
  end if;

  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
end;
$validation$;

with runtime_result as (
  select public.get_okr_dashboard_v1(
    context.org_id,
    null,
    null,
    'operational'
  ) as payload
  from pg_temp.okr_dashboard_runtime_context context
)
select
  jsonb_typeof(payload) = 'object' as dashboard_returns_object,
  jsonb_typeof(payload->'cycles') = 'array' as dashboard_cycles_are_array,
  jsonb_typeof(payload->'teams') = 'array' as dashboard_teams_are_array,
  jsonb_typeof(payload->'focus_objectives') = 'array'
    as dashboard_focus_objectives_are_array,
  (
    jsonb_typeof(payload) = 'object'
    and jsonb_typeof(payload->'cycles') = 'array'
    and jsonb_typeof(payload->'teams') = 'array'
    and jsonb_typeof(payload->'focus_objectives') = 'array'
  ) as okr_v2_dashboard_runtime_validation_ok
from runtime_result;

rollback;
