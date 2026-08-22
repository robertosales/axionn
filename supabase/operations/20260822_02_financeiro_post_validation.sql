-- Financeiro P0/P1 - validacao somente leitura depois das duas migrations.

begin;
set transaction read only;

do $$
declare
  v_missing text[] := array[]::text[];
  v_constraint text;
  v_admin_user_id uuid;
begin
  foreach v_constraint in array array[
    'billing_records_amount_positive_check',
    'billing_records_plan_type_format_check',
    'billing_records_currency_format_check',
    'billing_records_period_bounds_check',
    'billing_records_status_paid_at_check',
    'saas_plans_monthly_price_check',
    'saas_plans_annual_price_check',
    'saas_plans_currency_format_check',
    'apf_billing_amount_formula_check',
    'apf_billing_currency_format_check',
    'apf_billing_link_status_check'
  ] loop
    if not exists (select 1 from pg_constraint where conname = v_constraint) then
      v_missing := array_append(v_missing, v_constraint);
    end if;
  end loop;

  if to_regprocedure('public.update_backoffice_billing_status(uuid,text,text)') is null then
    v_missing := array_append(v_missing, 'update_backoffice_billing_status(uuid,text,text)');
  end if;
  if to_regprocedure('public.generate_backoffice_monthly_billing(date,integer,boolean)') is null then
    v_missing := array_append(v_missing, 'generate_backoffice_monthly_billing(date,integer,boolean)');
  end if;
  if to_regprocedure('public.link_apf_billing_record(uuid,uuid,text,boolean)') is null then
    v_missing := array_append(v_missing, 'link_apf_billing_record(uuid,uuid,text,boolean)');
  end if;
  if to_regprocedure('public.get_backoffice_financial_integrity_violations()') is null then
    v_missing := array_append(v_missing, 'get_backoffice_financial_integrity_violations()');
  end if;

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'financeiro_post_validation_missing_objects: %', array_to_string(v_missing, ', ');
  end if;

  if has_function_privilege('anon', 'public.update_backoffice_billing_status(uuid,text,text)', 'execute')
    or has_function_privilege('anon', 'public.get_backoffice_financial_integrity_violations()', 'execute') then
    raise exception 'financeiro_post_validation_anon_execute_detected';
  end if;

  if pg_get_functiondef('public.update_backoffice_billing_status(uuid,text,text)'::regprocedure)
       !~* 'for update'
    or pg_get_functiondef('public.generate_backoffice_monthly_billing(date,integer,boolean)'::regprocedure)
       !~* 'on conflict'
    or pg_get_functiondef('public.link_apf_billing_record(uuid,uuid,text,boolean)'::regprocedure)
       !~* 'sum\(r.gross_amount\)' then
    raise exception 'financeiro_post_validation_function_hardening_missing';
  end if;

  select s.user_id into v_admin_user_id
    from public.owner_staff_members s
   where s.is_active and s.role in ('admin', 'financeiro')
   order by case s.role when 'admin' then 1 else 2 end
   limit 1;
  if v_admin_user_id is null then
    raise exception 'financeiro_post_validation_active_staff_required';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );
end;
$$;

select invariant_name, violation_count
  from public.get_backoffice_financial_integrity_violations()
 order by invariant_name;

select
  bool_and(c.convalidated) as all_constraints_validated,
  count(*) filter (where not c.convalidated) as constraints_pending_legacy_validation,
  now() as checked_at,
  'post_migration_objects_valid'::text as result
from pg_constraint c
where c.conname in (
  'billing_records_amount_positive_check',
  'billing_records_plan_type_format_check',
  'billing_records_currency_format_check',
  'billing_records_period_bounds_check',
  'billing_records_status_paid_at_check',
  'saas_plans_monthly_price_check',
  'saas_plans_annual_price_check',
  'saas_plans_currency_format_check',
  'apf_billing_amount_formula_check',
  'apf_billing_currency_format_check',
  'apf_billing_link_status_check'
);

rollback;
