-- Financeiro P0/P1 - preflight somente leitura para o Lovable SQL Editor.
-- Executar antes das migrations 20260822000000 e 20260822010000.

begin;
set transaction read only;

do $$
declare
  v_missing text[] := array[]::text[];
begin
  if to_regclass('public.billing_records') is null then
    v_missing := array_append(v_missing, 'public.billing_records');
  end if;
  if to_regclass('public.saas_plans') is null then
    v_missing := array_append(v_missing, 'public.saas_plans');
  end if;
  if to_regclass('public.apf_measurement_billing_requests') is null then
    v_missing := array_append(v_missing, 'public.apf_measurement_billing_requests');
  end if;
  if to_regclass('public.backoffice_audit_log') is null then
    v_missing := array_append(v_missing, 'public.backoffice_audit_log');
  end if;
  if to_regclass('public.owner_staff_members') is null then
    v_missing := array_append(v_missing, 'public.owner_staff_members');
  end if;
  if to_regclass('public.uq_billing_tenant_period') is null then
    v_missing := array_append(v_missing, 'public.uq_billing_tenant_period');
  end if;
  if to_regprocedure('public.assert_backoffice_staff(text[])') is null then
    v_missing := array_append(v_missing, 'public.assert_backoffice_staff(text[])');
  end if;

  if coalesce(array_length(v_missing, 1), 0) > 0 then
    raise exception 'financeiro_preflight_missing_dependencies: %', array_to_string(v_missing, ', ');
  end if;

  if not exists (
    select 1 from public.owner_staff_members s
     where s.is_active and s.role in ('admin', 'financeiro')
  ) then
    raise exception 'financeiro_preflight_active_staff_required';
  end if;
end;
$$;

-- Guardar este resultado como evidencia anterior ao rollout. Violacoes legadas
-- nao bloqueiam as constraints NOT VALID, mas precisam ser saneadas antes da
-- operacao 03.
select invariant_name, violation_count
from (
  select 'billing_amount_positive'::text invariant_name, count(*)::bigint violation_count
    from public.billing_records b
   where not (b.amount <> 'NaN'::numeric and b.amount > 0)
  union all
  select 'billing_currency_format', count(*)
    from public.billing_records b
   where not (b.currency = upper(b.currency) and b.currency ~ '^[A-Z]{3}$')
  union all
  select 'billing_plan_type_format', count(*)
    from public.billing_records b
   where not (b.plan_type = trim(b.plan_type) and length(b.plan_type) between 1 and 64)
  union all
  select 'billing_period_bounds', count(*)
    from public.billing_records b
   where not (
     (b.period_start is null and b.period_end is null)
     or (b.period_start is not null and b.period_end is not null and b.period_end >= b.period_start)
   )
  union all
  select 'billing_status_paid_at', count(*)
    from public.billing_records b
   where not (
     (b.status in ('paid', 'refunded') and b.paid_at is not null)
     or (b.status in ('pending', 'overdue', 'cancelled') and b.paid_at is null)
   )
  union all
  select 'plan_price_and_currency', count(*)
    from public.saas_plans p
   where not (
     p.monthly_price <> 'NaN'::numeric and p.monthly_price >= 0
     and p.annual_price <> 'NaN'::numeric and p.annual_price >= 0
     and p.currency = upper(p.currency) and p.currency ~ '^[A-Z]{3}$'
   )
  union all
  select 'apf_amount_formula', count(*)
    from public.apf_measurement_billing_requests r
   where not (
     r.approved_pf <> 'NaN'::numeric
     and r.unit_price <> 'NaN'::numeric
     and r.gross_amount <> 'NaN'::numeric
     and r.gross_amount = round(r.approved_pf * r.unit_price, 2)
   )
  union all
  select 'apf_currency_format', count(*)
    from public.apf_measurement_billing_requests r
   where not (r.currency = upper(r.currency) and r.currency ~ '^[A-Z]{3}$')
  union all
  select 'apf_link_state', count(*)
    from public.apf_measurement_billing_requests r
   where r.status in ('linked', 'invoiced') and r.billing_record_id is null
  union all
  select 'apf_link_reconciliation', count(*)
    from public.apf_measurement_billing_requests r
    join public.billing_records b on b.id = r.billing_record_id
   where r.organization_id is distinct from b.tenant_id
      or upper(r.currency) <> upper(b.currency)
      or r.due_date <> b.due_date
      or b.status in ('cancelled', 'refunded')
  union all
  select 'apf_allocated_amount', count(*)
    from (
      select b.id
        from public.billing_records b
        join public.apf_measurement_billing_requests r on r.billing_record_id = b.id
       where r.status in ('linked', 'invoiced')
       group by b.id, b.amount
      having sum(r.gross_amount) > b.amount
    ) over_allocated
) diagnostics
order by invariant_name;

select
  current_database() as database_name,
  current_user as executed_by,
  now() as checked_at,
  'preflight_read_only_complete'::text as result;

rollback;
