-- Financeiro P1 - ativacao final depois do saneamento do legado.
-- Esta operacao altera metadados. Executar separadamente, com backup e janela
-- aprovados, somente quando a operacao 02 reportar zero violacoes.

begin;
select pg_advisory_xact_lock(hashtext('axionn:20260822:financeiro:validate_constraints'));

do $$
declare
  v_violations bigint;
  v_admin_user_id uuid;
begin
  select s.user_id into v_admin_user_id
    from public.owner_staff_members s
   where s.is_active and s.role in ('admin', 'financeiro')
   order by case s.role when 'admin' then 1 else 2 end
   limit 1;
  if v_admin_user_id is null then
    raise exception 'financeiro_constraint_validation_active_staff_required';
  end if;

  perform set_config('request.jwt.claim.sub', v_admin_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_admin_user_id, 'role', 'authenticated', 'aal', 'aal2')::text,
    true
  );

  select coalesce(sum(v.violation_count), 0) into v_violations
    from public.get_backoffice_financial_integrity_violations() v;

  if v_violations <> 0 then
    raise exception 'financeiro_constraint_validation_blocked: % legacy violations', v_violations;
  end if;
end;
$$;

alter table public.billing_records validate constraint billing_records_amount_positive_check;
alter table public.billing_records validate constraint billing_records_plan_type_format_check;
alter table public.billing_records validate constraint billing_records_currency_format_check;
alter table public.billing_records validate constraint billing_records_period_bounds_check;
alter table public.billing_records validate constraint billing_records_status_paid_at_check;

alter table public.saas_plans validate constraint saas_plans_monthly_price_check;
alter table public.saas_plans validate constraint saas_plans_annual_price_check;
alter table public.saas_plans validate constraint saas_plans_currency_format_check;

alter table public.apf_measurement_billing_requests validate constraint apf_billing_amount_formula_check;
alter table public.apf_measurement_billing_requests validate constraint apf_billing_currency_format_check;
alter table public.apf_measurement_billing_requests validate constraint apf_billing_link_status_check;

do $$
declare
  v_pending integer;
begin
  select count(*) into v_pending
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
   ) and not c.convalidated;

  if v_pending <> 0 then
    raise exception 'financeiro_constraint_validation_incomplete: % constraints pending', v_pending;
  end if;
end;
$$;

commit;

select
  now() as validated_at,
  'financial_constraints_validated'::text as result;
