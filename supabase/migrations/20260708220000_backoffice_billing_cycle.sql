-- Ciclo financeiro completo: precificacao, criacao e geracao recorrente de faturas.

alter table public.saas_plans
  add column if not exists monthly_price numeric(12,2) not null default 0,
  add column if not exists annual_price numeric(12,2) not null default 0,
  add column if not exists currency text not null default 'BRL';

alter table public.saas_plans drop constraint if exists saas_plans_monthly_price_check;
alter table public.saas_plans add constraint saas_plans_monthly_price_check check (monthly_price >= 0);
alter table public.saas_plans drop constraint if exists saas_plans_annual_price_check;
alter table public.saas_plans add constraint saas_plans_annual_price_check check (annual_price >= 0);

alter table public.billing_records drop constraint if exists billing_records_plan_type_check;
alter table public.billing_records add constraint billing_records_plan_type_check
  check (plan_type in ('starter', 'pro', 'professional', 'enterprise', 'custom'));

alter table public.billing_records
  add column if not exists period_start date,
  add column if not exists period_end date;

create unique index if not exists uq_billing_tenant_period
  on public.billing_records(tenant_id, period_start, billing_period)
  where tenant_id is not null and period_start is not null
    and status not in ('cancelled', 'refunded');

create or replace function public.list_backoffice_plan_prices()
returns table (
  id uuid, code text, name text, monthly_price numeric,
  annual_price numeric, currency text, status text
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.assert_backoffice_staff(array['admin', 'financeiro']);
  return query
  select p.id, p.code, p.name, p.monthly_price, p.annual_price, p.currency, p.status
  from public.saas_plans p
  where p.status <> 'archived'
  order by case p.code when 'starter' then 1 when 'pro' then 2 when 'enterprise' then 3 else 10 end;
end; $$;

create or replace function public.list_backoffice_billing_customers()
returns table (org_id uuid, org_name text, plan_name text, plan_code text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.assert_backoffice_staff(array['admin', 'financeiro']);
  return query
  select o.id, o.name, p.name, p.code
  from public.organizations o
  join public.organization_subscriptions s on s.org_id = o.id
  join public.saas_plans p on p.id = s.plan_id
  where s.status in ('active', 'past_due', 'trialing')
  order by o.name;
end; $$;

create or replace function public.update_backoffice_plan_price(
  p_plan_id uuid, p_monthly_price numeric, p_annual_price numeric, p_currency text default 'BRL'
)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_actor public.owner_staff_members; v_before jsonb;
begin
  v_actor := public.assert_backoffice_staff(array['admin', 'financeiro']);
  if p_monthly_price < 0 or p_annual_price < 0 then
    raise exception using errcode = '22023', message = 'plan_price_invalid';
  end if;
  select jsonb_build_object('monthly_price', monthly_price, 'annual_price', annual_price, 'currency', currency)
  into v_before from public.saas_plans where id = p_plan_id;
  update public.saas_plans set monthly_price = p_monthly_price, annual_price = p_annual_price,
    currency = upper(coalesce(nullif(trim(p_currency), ''), 'BRL'))
  where id = p_plan_id;
  if not found then raise exception using errcode = 'P0002', message = 'plan_not_found'; end if;
  insert into public.backoffice_audit_log(actor_staff_id, actor_user_id, action, resource_type, resource_id, before_values, after_values)
  values (v_actor.id, auth.uid(), 'plan_price_updated', 'saas_plan', p_plan_id, v_before,
    jsonb_build_object('monthly_price', p_monthly_price, 'annual_price', p_annual_price, 'currency', upper(p_currency)));
end; $$;

create or replace function public.create_backoffice_billing_record(
  p_tenant_id uuid, p_billing_period text, p_due_date date,
  p_amount numeric default null, p_notes text default null
)
returns uuid language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_actor public.owner_staff_members; v_id uuid; v_org public.organizations;
  v_plan public.saas_plans; v_period_start date; v_period_end date; v_amount numeric;
begin
  v_actor := public.assert_backoffice_staff(array['admin', 'financeiro']);
  if p_billing_period not in ('monthly', 'quarterly', 'annual') then
    raise exception using errcode = '22023', message = 'billing_period_invalid';
  end if;
  select * into v_org from public.organizations where id = p_tenant_id;
  if v_org.id is null then raise exception using errcode = 'P0002', message = 'organization_not_found'; end if;
  select p.* into v_plan from public.organization_subscriptions s
    join public.saas_plans p on p.id = s.plan_id where s.org_id = p_tenant_id;
  if v_plan.id is null then raise exception using errcode = 'P0002', message = 'subscription_plan_not_found'; end if;
  v_period_start := date_trunc('month', p_due_date)::date;
  v_period_end := case p_billing_period
    when 'monthly' then (v_period_start + interval '1 month - 1 day')::date
    when 'quarterly' then (v_period_start + interval '3 months - 1 day')::date
    else (v_period_start + interval '1 year - 1 day')::date end;
  v_amount := coalesce(p_amount, case p_billing_period
    when 'monthly' then v_plan.monthly_price
    when 'quarterly' then v_plan.monthly_price * 3
    else v_plan.annual_price end);
  if v_amount <= 0 then raise exception using errcode = '22023', message = 'billing_amount_required'; end if;
  insert into public.billing_records(tenant_id, tenant_name, amount, currency, status, plan_type,
    billing_period, due_date, notes, created_by, period_start, period_end)
  values (v_org.id, v_org.name, v_amount, v_plan.currency, 'pending', v_plan.code,
    p_billing_period, p_due_date, nullif(trim(p_notes), ''), v_actor.id, v_period_start, v_period_end)
  returning id into v_id;
  insert into public.backoffice_audit_log(actor_staff_id, actor_user_id, action, resource_type, resource_id, after_values)
  values (v_actor.id, auth.uid(), 'billing_record_created', 'billing_record', v_id,
    jsonb_build_object('tenant_id', p_tenant_id, 'amount', v_amount, 'period', p_billing_period));
  return v_id;
exception when unique_violation then
  raise exception using errcode = '23505', message = 'billing_record_already_exists_for_period';
end; $$;

create or replace function public.generate_backoffice_monthly_billing(
  p_reference_date date default current_date, p_due_day integer default 10
)
returns integer language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_actor public.owner_staff_members; v_count integer := 0; v_row record; v_due date;
begin
  v_actor := public.assert_backoffice_staff(array['admin', 'financeiro']);
  if p_due_day < 1 or p_due_day > 28 then
    raise exception using errcode = '22023', message = 'due_day_invalid';
  end if;
  v_due := date_trunc('month', p_reference_date)::date + (p_due_day - 1);
  for v_row in
    select o.id from public.organizations o
    join public.organization_subscriptions s on s.org_id = o.id
    join public.saas_plans p on p.id = s.plan_id
    where s.status = 'active' and p.status = 'active' and p.monthly_price > 0
  loop
    begin
      perform public.create_backoffice_billing_record(v_row.id, 'monthly', v_due, null, 'Geracao mensal automatica');
      v_count := v_count + 1;
    exception when unique_violation then
      null;
    end;
  end loop;
  return v_count;
end; $$;

revoke all on function public.list_backoffice_plan_prices() from public, anon;
revoke all on function public.list_backoffice_billing_customers() from public, anon;
revoke all on function public.update_backoffice_plan_price(uuid, numeric, numeric, text) from public, anon;
revoke all on function public.create_backoffice_billing_record(uuid, text, date, numeric, text) from public, anon;
revoke all on function public.generate_backoffice_monthly_billing(date, integer) from public, anon;
grant execute on function public.list_backoffice_plan_prices() to authenticated, service_role;
grant execute on function public.list_backoffice_billing_customers() to authenticated, service_role;
grant execute on function public.update_backoffice_plan_price(uuid, numeric, numeric, text) to authenticated, service_role;
grant execute on function public.create_backoffice_billing_record(uuid, text, date, numeric, text) to authenticated, service_role;
grant execute on function public.generate_backoffice_monthly_billing(date, integer) to authenticated, service_role;
