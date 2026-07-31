-- OKR V2 - gate cumulativo final, somente leitura.
-- Executar no Lovable SQL Editor depois de todas as migrations OKR até
-- 20260730190000_okr_v2_membership_argument_order_fix.sql.

with required_relations(name) as (
  values
    ('public.okr_cycles'),
    ('public.okr_objectives'),
    ('public.okr_key_results'),
    ('public.okr_check_ins'),
    ('public.okr_initiatives'),
    ('public.okr_alerts'),
    ('public.okr_objective_reviews'),
    ('public.okr_cycle_reviews'),
    ('public.okr_recalculation_queue')
),
required_functions(name) as (
  values
    ('create_okr_cycle_v1'),
    ('publish_okr_cycle_v1'),
    ('start_okr_cycle_closing_v1'),
    ('close_okr_cycle_v1'),
    ('create_okr_objective_v2'),
    ('create_okr_key_result_v2'),
    ('record_okr_check_in_v2'),
    ('submit_okr_objective_review_v1'),
    ('approve_okr_objective_review_v1'),
    ('carry_forward_okr_objective_v1'),
    ('create_okr_initiative_v1'),
    ('run_okr_alert_engine_v1'),
    ('get_okr_dashboard_v1'),
    ('request_okr_export_v1')
),
relation_check as (
  select
    count(*) = count(to_regclass(name)) as relations_ok,
    array_agg(name) filter (where to_regclass(name) is null) as missing_relations
  from required_relations
),
function_check as (
  select
    bool_and(p.oid is not null) as functions_ok,
    array_agg(rf.name) filter (where p.oid is null) as missing_functions
  from required_functions rf
  left join lateral (
    select proc.oid
    from pg_proc proc
    join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
      and proc.proname = rf.name
    limit 1
  ) p on true
),
security_check as (
  select
    count(*) filter (
      where relrowsecurity
    ) = count(*) as rls_ok
  from pg_class
  where oid in (
    select to_regclass(name)
    from required_relations
    where to_regclass(name) is not null
  )
)
select
  rc.relations_ok,
  rc.missing_relations,
  fc.functions_ok,
  fc.missing_functions,
  sc.rls_ok,
  rc.relations_ok and fc.functions_ok and sc.rls_ok
    as okr_v2_final_cumulative_validation_ok
from relation_check rc
cross join function_check fc
cross join security_check sc;
