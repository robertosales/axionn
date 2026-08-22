-- P1 Financeiro: invariantes monetarios, geracao concorrente idempotente e
-- reconciliacao segura entre solicitacoes APF e faturas do backoffice.

-- NOT VALID preserva o deploy quando houver legado inconsistente, mas passa a
-- aplicar cada regra imediatamente a novas insercoes e atualizacoes.
alter table public.billing_records drop constraint if exists billing_records_amount_check;
alter table public.billing_records add constraint billing_records_amount_positive_check
  check (amount <> 'NaN'::numeric and amount > 0) not valid;

alter table public.billing_records drop constraint if exists billing_records_plan_type_check;
alter table public.billing_records add constraint billing_records_plan_type_format_check
  check (plan_type = trim(plan_type) and length(plan_type) between 1 and 64) not valid;

alter table public.billing_records add constraint billing_records_currency_format_check
  check (currency = upper(currency) and currency ~ '^[A-Z]{3}$') not valid;

alter table public.billing_records add constraint billing_records_period_bounds_check
  check (
    (period_start is null and period_end is null)
    or (period_start is not null and period_end is not null and period_end >= period_start)
  ) not valid;

alter table public.billing_records add constraint billing_records_status_paid_at_check
  check (
    (status in ('paid', 'refunded') and paid_at is not null)
    or (status in ('pending', 'overdue', 'cancelled') and paid_at is null)
  ) not valid;

alter table public.saas_plans drop constraint if exists saas_plans_monthly_price_check;
alter table public.saas_plans add constraint saas_plans_monthly_price_check
  check (monthly_price <> 'NaN'::numeric and monthly_price >= 0) not valid;

alter table public.saas_plans drop constraint if exists saas_plans_annual_price_check;
alter table public.saas_plans add constraint saas_plans_annual_price_check
  check (annual_price <> 'NaN'::numeric and annual_price >= 0) not valid;

alter table public.saas_plans add constraint saas_plans_currency_format_check
  check (currency = upper(currency) and currency ~ '^[A-Z]{3}$') not valid;

alter table public.apf_measurement_billing_requests
  add constraint apf_billing_amount_formula_check
  check (
    approved_pf <> 'NaN'::numeric
    and unit_price <> 'NaN'::numeric
    and gross_amount <> 'NaN'::numeric
    and gross_amount = round(approved_pf * unit_price, 2)
  ) not valid;

alter table public.apf_measurement_billing_requests
  add constraint apf_billing_currency_format_check
  check (currency = upper(currency) and currency ~ '^[A-Z]{3}$') not valid;

alter table public.apf_measurement_billing_requests
  add constraint apf_billing_link_status_check
  check (status not in ('linked', 'invoiced') or billing_record_id is not null) not valid;

create or replace function public.update_backoffice_plan_price(
  p_plan_id uuid,
  p_monthly_price numeric,
  p_annual_price numeric,
  p_currency text default 'BRL'
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.owner_staff_members;
  v_plan public.saas_plans%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_currency text;
begin
  v_actor := public.assert_backoffice_staff(array['admin', 'financeiro']);
  v_currency := upper(coalesce(nullif(trim(p_currency), ''), 'BRL'));

  if p_monthly_price is null or p_annual_price is null
    or p_monthly_price = 'NaN'::numeric or p_annual_price = 'NaN'::numeric
    or p_monthly_price < 0 or p_annual_price < 0 then
    raise exception using errcode = '22023', message = 'plan_price_invalid';
  end if;

  if v_currency !~ '^[A-Z]{3}$' then
    raise exception using errcode = '22023', message = 'billing_currency_invalid';
  end if;

  select p.* into v_plan
    from public.saas_plans p
   where p.id = p_plan_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'plan_not_found';
  end if;

  v_before := to_jsonb(v_plan);

  update public.saas_plans as p
     set monthly_price = p_monthly_price,
         annual_price = p_annual_price,
         currency = v_currency
   where p.id = p_plan_id
  returning to_jsonb(p) into v_after;

  insert into public.backoffice_audit_log(
    actor_staff_id, actor_user_id, action, resource_type, resource_id, before_values, after_values
  ) values (
    v_actor.id, auth.uid(), 'plan_price_updated', 'saas_plan', p_plan_id, v_before, v_after
  );
end;
$$;

create or replace function public.create_backoffice_billing_record(
  p_tenant_id uuid,
  p_billing_period text,
  p_due_date date,
  p_amount numeric default null,
  p_notes text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.owner_staff_members;
  v_id uuid;
  v_org public.organizations%rowtype;
  v_plan public.saas_plans%rowtype;
  v_period_start date;
  v_period_end date;
  v_amount numeric;
  v_currency text;
  v_after jsonb;
begin
  v_actor := public.assert_backoffice_staff(array['admin', 'financeiro']);

  if p_billing_period not in ('monthly', 'quarterly', 'annual') then
    raise exception using errcode = '22023', message = 'billing_period_invalid';
  end if;
  if p_due_date is null then
    raise exception using errcode = '22023', message = 'billing_due_date_required';
  end if;

  select o.* into v_org from public.organizations o where o.id = p_tenant_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'organization_not_found';
  end if;

  select p.* into v_plan
    from public.organization_subscriptions s
    join public.saas_plans p on p.id = s.plan_id
   where s.org_id = p_tenant_id
     and s.status in ('active', 'past_due', 'trialing')
     and p.status = 'active';
  if not found then
    raise exception using errcode = 'P0002', message = 'billable_subscription_plan_not_found';
  end if;

  v_period_start := date_trunc('month', p_due_date)::date;
  v_period_end := case p_billing_period
    when 'monthly' then (v_period_start + interval '1 month - 1 day')::date
    when 'quarterly' then (v_period_start + interval '3 months - 1 day')::date
    else (v_period_start + interval '1 year - 1 day')::date
  end;
  v_amount := coalesce(p_amount, case p_billing_period
    when 'monthly' then v_plan.monthly_price
    when 'quarterly' then v_plan.monthly_price * 3
    else v_plan.annual_price
  end);
  v_currency := upper(trim(v_plan.currency));

  if v_amount is null or v_amount = 'NaN'::numeric or v_amount <= 0 then
    raise exception using errcode = '22023', message = 'billing_amount_required';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception using errcode = '22023', message = 'billing_currency_invalid';
  end if;

  insert into public.billing_records as b(
    tenant_id, tenant_name, amount, currency, status, plan_type,
    billing_period, due_date, notes, created_by, period_start, period_end
  ) values (
    v_org.id, v_org.name, v_amount, v_currency, 'pending', trim(v_plan.code),
    p_billing_period, p_due_date, nullif(trim(p_notes), ''), v_actor.id,
    v_period_start, v_period_end
  )
  returning b.id, to_jsonb(b) into v_id, v_after;

  insert into public.backoffice_audit_log(
    actor_staff_id, actor_user_id, action, resource_type, resource_id, after_values
  ) values (
    v_actor.id, auth.uid(), 'billing_record_created', 'billing_record', v_id, v_after
  );

  return v_id;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'billing_record_already_exists_for_period';
end;
$$;

create or replace function public.generate_backoffice_monthly_billing(
  p_reference_date date default current_date,
  p_due_day integer default 10,
  p_dry_run boolean default false
)
returns integer
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.owner_staff_members;
  v_due date;
  v_period_start date;
  v_period_end date;
  v_count integer := 0;
begin
  v_actor := public.assert_backoffice_staff(array['admin', 'financeiro']);
  if p_reference_date is null then
    raise exception using errcode = '22023', message = 'billing_reference_date_required';
  end if;
  if p_due_day is null or p_due_day < 1 or p_due_day > 28 then
    raise exception using errcode = '22023', message = 'due_day_invalid';
  end if;

  v_due := date_trunc('month', p_reference_date)::date + (p_due_day - 1);
  v_period_start := date_trunc('month', v_due)::date;
  v_period_end := (v_period_start + interval '1 month - 1 day')::date;

  if p_dry_run then
    select count(*) into v_count
      from public.organizations o
      join public.organization_subscriptions s on s.org_id = o.id and s.status = 'active'
      join public.saas_plans p on p.id = s.plan_id and p.status = 'active' and p.monthly_price > 0
     where p.monthly_price <> 'NaN'::numeric
       and not exists (
         select 1 from public.billing_records b
          where b.tenant_id = o.id
            and b.period_start = v_period_start
            and b.billing_period = 'monthly'
            and b.status not in ('cancelled', 'refunded')
       );
    return v_count;
  end if;

  with inserted as (
    insert into public.billing_records(
      tenant_id, tenant_name, amount, currency, status, plan_type,
      billing_period, due_date, notes, created_by, period_start, period_end
    )
    select o.id, o.name, p.monthly_price, upper(trim(p.currency)), 'pending', trim(p.code),
      'monthly', v_due, 'Geracao mensal automatica', v_actor.id, v_period_start, v_period_end
      from public.organizations o
      join public.organization_subscriptions s on s.org_id = o.id and s.status = 'active'
      join public.saas_plans p on p.id = s.plan_id and p.status = 'active'
     where p.monthly_price <> 'NaN'::numeric
       and p.monthly_price > 0
    on conflict (tenant_id, period_start, billing_period)
      where tenant_id is not null and period_start is not null
        and status not in ('cancelled', 'refunded')
      do nothing
    returning *
  )
  insert into public.backoffice_audit_log(
    actor_staff_id, actor_user_id, action, resource_type, resource_id, after_values
  )
  select v_actor.id, auth.uid(), 'billing_record_created', 'billing_record', i.id, to_jsonb(i)
    from inserted i;

  get diagnostics v_count = row_count;

  if v_count > 0 then
    insert into public.backoffice_audit_log(
      actor_staff_id, actor_user_id, action, resource_type, resource_id, after_values
    ) values (
      v_actor.id, auth.uid(), 'billing_batch_generated', 'billing_record', null,
      jsonb_build_object(
        'reference_month', v_period_start,
        'due_date', v_due,
        'generated', v_count
      )
    );
  end if;

  return v_count;
end;
$$;

create or replace function public.link_apf_billing_record(
  p_request_id uuid,
  p_billing_record_id uuid,
  p_note text,
  p_mark_invoiced boolean default false
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.owner_staff_members;
  v_request public.apf_measurement_billing_requests%rowtype;
  v_billing public.billing_records%rowtype;
  v_event text;
  v_allocated_amount numeric;
  v_after jsonb;
begin
  v_actor := public.assert_backoffice_staff(array['admin', 'financeiro']);

  select r.* into v_request
    from public.apf_measurement_billing_requests r
   where r.id = p_request_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'apf_billing_request_not_found';
  end if;

  select b.* into v_billing
    from public.billing_records b
   where b.id = p_billing_record_id
   for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'billing_record_not_found';
  end if;

  v_event := case when p_mark_invoiced then 'invoiced' else 'linked' end;

  if v_request.status = v_event and v_request.billing_record_id = v_billing.id then
    return;
  end if;
  if v_request.status = 'invoiced'
    or v_request.status = 'cancelled'
    or (v_request.status = 'linked' and (
      v_request.billing_record_id is distinct from v_billing.id or not p_mark_invoiced
    )) then
    raise exception using errcode = '22023', message = 'apf_billing_transition_invalid';
  end if;
  if v_request.status not in ('submitted', 'linked') then
    raise exception using errcode = '22023', message = 'apf_billing_transition_invalid';
  end if;
  if v_billing.tenant_id is distinct from v_request.organization_id then
    raise exception using errcode = '22023', message = 'apf_billing_organization_mismatch';
  end if;
  if v_billing.status not in ('pending', 'overdue', 'paid') then
    raise exception using errcode = '22023', message = 'apf_billing_record_status_invalid';
  end if;
  if upper(v_billing.currency) <> upper(v_request.currency) then
    raise exception using errcode = '22023', message = 'apf_billing_currency_mismatch';
  end if;
  if v_billing.due_date <> v_request.due_date then
    raise exception using errcode = '22023', message = 'apf_billing_due_date_mismatch';
  end if;
  -- O lock da fatura serializa tambem a soma quando varias solicitacoes APF
  -- sao consolidadas no mesmo documento financeiro.
  select coalesce(sum(r.gross_amount), 0) into v_allocated_amount
    from public.apf_measurement_billing_requests r
   where r.billing_record_id = v_billing.id
     and r.id <> v_request.id
     and r.status in ('linked', 'invoiced');

  if v_allocated_amount + v_request.gross_amount > v_billing.amount then
    raise exception using errcode = '22023', message = 'apf_billing_amount_exceeds_invoice';
  end if;

  update public.apf_measurement_billing_requests as r
     set billing_record_id = v_billing.id,
         status = v_event,
         updated_at = now()
   where r.id = v_request.id
  returning to_jsonb(r) into v_after;

  insert into public.apf_measurement_billing_events(request_id, event_type, note, actor_id)
  values (
    v_request.id,
    v_event,
    coalesce(nullif(trim(p_note), ''), 'Vinculo financeiro registrado.'),
    auth.uid()
  );

  insert into public.backoffice_audit_log(
    actor_staff_id, actor_user_id, action, resource_type, resource_id, before_values, after_values
  ) values (
    v_actor.id,
    auth.uid(),
    'apf_billing_linked',
    'apf_measurement_billing_request',
    v_request.id,
    to_jsonb(v_request),
    v_after
  );
end;
$$;

create or replace function public.get_backoffice_financial_integrity_violations()
returns table(invariant_name text, violation_count bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_backoffice_staff(array['admin', 'financeiro']);

  return query
  select 'billing_amount_positive'::text, count(*)
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
    ) over_allocated;
end;
$$;

revoke all on function public.update_backoffice_plan_price(uuid, numeric, numeric, text) from public, anon;
revoke all on function public.create_backoffice_billing_record(uuid, text, date, numeric, text) from public, anon;
revoke all on function public.generate_backoffice_monthly_billing(date, integer, boolean) from public, anon;
revoke all on function public.link_apf_billing_record(uuid, uuid, text, boolean) from public, anon;
revoke all on function public.get_backoffice_financial_integrity_violations() from public, anon;

grant execute on function public.update_backoffice_plan_price(uuid, numeric, numeric, text) to authenticated, service_role;
grant execute on function public.create_backoffice_billing_record(uuid, text, date, numeric, text) to authenticated, service_role;
grant execute on function public.generate_backoffice_monthly_billing(date, integer, boolean) to authenticated, service_role;
grant execute on function public.link_apf_billing_record(uuid, uuid, text, boolean) to authenticated, service_role;
grant execute on function public.get_backoffice_financial_integrity_violations() to authenticated, service_role;
