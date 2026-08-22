begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(29);

-- RPCs efetivas do P0/P1.
select has_function(
  'public', 'update_backoffice_billing_status', array['uuid', 'text', 'text'],
  'billing status transition RPC exists'
);
select has_function(
  'public', 'create_backoffice_billing_record', array['uuid', 'text', 'date', 'numeric', 'text'],
  'billing creation RPC exists'
);
select has_function(
  'public', 'generate_backoffice_monthly_billing', array['date', 'integer', 'boolean'],
  'monthly generation RPC exists'
);
select has_function(
  'public', 'link_apf_billing_record', array['uuid', 'uuid', 'text', 'boolean'],
  'APF reconciliation RPC exists'
);
select has_function(
  'public', 'get_backoffice_financial_integrity_violations', array[]::text[],
  'financial integrity diagnostic RPC exists'
);

-- Constraints instaladas pela migration P1.
select ok(exists(
  select 1 from pg_constraint
   where conrelid = 'public.billing_records'::regclass
     and conname = 'billing_records_amount_positive_check'
), 'billing amount constraint exists');
select ok(exists(
  select 1 from pg_constraint
   where conrelid = 'public.billing_records'::regclass
     and conname = 'billing_records_currency_format_check'
), 'billing currency constraint exists');
select ok(exists(
  select 1 from pg_constraint
   where conrelid = 'public.billing_records'::regclass
     and conname = 'billing_records_period_bounds_check'
), 'billing period constraint exists');
select ok(exists(
  select 1 from pg_constraint
   where conrelid = 'public.billing_records'::regclass
     and conname = 'billing_records_status_paid_at_check'
), 'billing paid-at constraint exists');
select ok(exists(
  select 1 from pg_constraint
   where conrelid = 'public.billing_records'::regclass
     and conname = 'billing_records_plan_type_format_check'
), 'dynamic plan snapshot constraint exists');
select ok(exists(
  select 1 from pg_constraint
   where conrelid = 'public.apf_measurement_billing_requests'::regclass
     and conname = 'apf_billing_amount_formula_check'
), 'APF amount formula constraint exists');
select ok(exists(
  select 1 from pg_constraint
   where conrelid = 'public.apf_measurement_billing_requests'::regclass
     and conname = 'apf_billing_currency_format_check'
), 'APF currency constraint exists');
select ok(exists(
  select 1 from pg_constraint
   where conrelid = 'public.apf_measurement_billing_requests'::regclass
     and conname = 'apf_billing_link_status_check'
), 'APF link-state constraint exists');

select is((
  select convalidated from pg_constraint
   where conrelid = 'public.billing_records'::regclass
     and conname = 'billing_records_amount_positive_check'
), false, 'billing constraint starts NOT VALID for safe legacy rollout');
select is((
  select convalidated from pg_constraint
   where conrelid = 'public.apf_measurement_billing_requests'::regclass
     and conname = 'apf_billing_amount_formula_check'
), false, 'APF constraint starts NOT VALID for safe legacy rollout');

-- CHECK NOT VALID continua protegendo toda escrita nova.
select lives_ok($sql$
  insert into public.billing_records(
    id, tenant_name, amount, currency, status, plan_type,
    billing_period, due_date, period_start, period_end
  ) values (
    '22000000-0000-0000-0000-000000000001', 'Financial Quality Fixture',
    100.00, 'BRL', 'pending', 'quality-dynamic-plan',
    'monthly', date '2026-08-10', date '2026-08-01', date '2026-08-31'
  )
$sql$, 'a valid financial record is accepted');

select throws_ok($sql$
  insert into public.billing_records(
    id, tenant_name, amount, currency, status, plan_type, billing_period, due_date
  ) values (
    '22000000-0000-0000-0000-000000000002', 'Zero Amount',
    0, 'BRL', 'pending', 'quality', 'monthly', date '2026-08-10'
  )
$sql$, '23514', null, 'zero amount is rejected');

select throws_ok($sql$
  insert into public.billing_records(
    id, tenant_name, amount, currency, status, plan_type, billing_period, due_date
  ) values (
    '22000000-0000-0000-0000-000000000003', 'NaN Amount',
    'NaN'::numeric, 'BRL', 'pending', 'quality', 'monthly', date '2026-08-10'
  )
$sql$, '23514', null, 'NaN amount is rejected');

select throws_ok($sql$
  insert into public.billing_records(
    id, tenant_name, amount, currency, status, plan_type, billing_period, due_date
  ) values (
    '22000000-0000-0000-0000-000000000004', 'Invalid Currency',
    10, 'real', 'pending', 'quality', 'monthly', date '2026-08-10'
  )
$sql$, '23514', null, 'invalid currency is rejected');

select throws_ok($sql$
  insert into public.billing_records(
    id, tenant_name, amount, currency, status, plan_type,
    billing_period, due_date, period_start
  ) values (
    '22000000-0000-0000-0000-000000000005', 'Incomplete Period',
    10, 'BRL', 'pending', 'quality', 'monthly', date '2026-08-10', date '2026-08-01'
  )
$sql$, '23514', null, 'an incomplete billing period is rejected');

select throws_ok($sql$
  insert into public.billing_records(
    id, tenant_name, amount, currency, status, plan_type, billing_period, due_date
  ) values (
    '22000000-0000-0000-0000-000000000006', 'Paid Without Timestamp',
    10, 'BRL', 'paid', 'quality', 'monthly', date '2026-08-10'
  )
$sql$, '23514', null, 'paid status without paid_at is rejected');

-- Implementacao efetiva das garantias concorrentes e de reconciliacao.
select ok(
  pg_get_functiondef('public.generate_backoffice_monthly_billing(date,integer,boolean)'::regprocedure)
    ~* 'on conflict[[:space:]]*\(tenant_id, period_start, billing_period\)',
  'monthly generation uses the financial uniqueness index'
);
select ok(
  pg_get_functiondef('public.link_apf_billing_record(uuid,uuid,text,boolean)'::regprocedure)
    ~* 'for update',
  'APF reconciliation locks mutable rows'
);
select ok(
  pg_get_functiondef('public.link_apf_billing_record(uuid,uuid,text,boolean)'::regprocedure)
    ~* 'sum\(r.gross_amount\)',
  'APF reconciliation checks the accumulated allocated amount'
);

select ok(
  not has_function_privilege(
    'anon', 'public.get_backoffice_financial_integrity_violations()', 'execute'
  ),
  'anonymous users cannot execute the integrity diagnostic'
);
select ok(
  has_function_privilege(
    'authenticated', 'public.get_backoffice_financial_integrity_violations()', 'execute'
  ),
  'authenticated staff may reach the guarded integrity diagnostic'
);
select ok(
  has_function_privilege(
    'service_role', 'public.get_backoffice_financial_integrity_violations()', 'execute'
  ),
  'service role can execute the integrity diagnostic'
);
select is((
  select p.prosecdef
    from pg_proc p
   where p.oid = 'public.get_backoffice_financial_integrity_violations()'::regprocedure
), true, 'integrity diagnostic is SECURITY DEFINER');
select is((
  select p.prosecdef
    from pg_proc p
   where p.oid = 'public.update_backoffice_billing_status(uuid,text,text)'::regprocedure
), true, 'billing status transition is SECURITY DEFINER');

select * from finish();
rollback;
