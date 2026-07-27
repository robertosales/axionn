-- PR 1 — Entitlements canônicos OKR
-- Executa em transação, faz rollback ao final.
begin;
select plan(6);

-- 1) RPCs devem existir
select has_function('public'::name, 'resolve_okr_entitlement_v1'::name,
  array['uuid','text'], 'resolve_okr_entitlement_v1 criada');
select has_function('public'::name, 'get_okr_entitlement_matrix_v1'::name,
  array['uuid'], 'get_okr_entitlement_matrix_v1 criada');
select has_function('public'::name, 'check_okr_limit_v1'::name,
  array['uuid','text','integer'], 'check_okr_limit_v1 criada');

-- 2) Novas features precisam estar no catálogo comercial (fonte nova)
select is(
  (select count(*)::int from public.product_features
     where code in ('okr.alignments','okr.cycle_management',
                    'okr.executive_dashboard','okr.advanced_alerts')),
  4,
  'as 4 novas features OKR estão em product_features'
);

-- 3) Todas as 14 features canônicas OKR precisam estar mapeadas em TODOS os planos.
select is(
  (select count(*)::int
     from public.saas_plans p
     cross join (values
       ('okr.view'),('okr.create'),('okr.edit'),('okr.archive'),
       ('okr.check_in'),('okr.initiatives'),('okr.automatic_metrics'),
       ('okr.history'),('okr.export'),('okr.ai_recommendations'),
       ('okr.alignments'),('okr.cycle_management'),
       ('okr.executive_dashboard'),('okr.advanced_alerts')
     ) as f(code)
     join public.saas_plan_entitlements e
       on e.plan_id = p.id and e.feature_key = f.code
     where p.code in ('starter','pro','enterprise')),
  3 * 14,
  'legacy entitlements cobrem 14 features x 3 planos'
);

-- 4) Matriz por plano — Starter NÃO pode ter automatic_metrics/export/executive_dashboard/advanced_alerts.
select is(
  (select bool_and(not enabled)
     from public.saas_plan_entitlements e
     join public.saas_plans p on p.id = e.plan_id
     where p.code = 'starter'
       and e.feature_key in ('okr.automatic_metrics','okr.export',
                             'okr.executive_dashboard','okr.advanced_alerts')),
  true,
  'starter bloqueia recursos premium OKR'
);

select * from finish();
rollback;