-- Financeiro backoffice: MRR/ARR derivados de assinaturas ativas, sincronizacao
-- de inadimplencia, maquina de estados de faturas e geracao mensal com dry-run.

-- 1. Metricas SaaS: MRR passa a ser a soma das assinaturas ativas (active/past_due)
--    em vez do acumulado historico de billing_records, que crescia sem limite.
create or replace function public.get_backoffice_saas_metrics()
returns table(mrr numeric, arr numeric, active_tenants bigint, trial_tenants bigint,
  churned_tenants bigint, churn_rate numeric, open_tickets bigint, overdue_invoices bigint, paid_revenue numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.assert_backoffice_staff(array['admin', 'financeiro', 'comercial']);
  return query
  with tenants as (
    select count(*) filter (where status::text = 'active') active,
           count(*) filter (where status::text = 'trial') trial,
           count(*) filter (where status::text in ('churned', 'cancelled')) churned
    from public.organizations
  ), recurring as (
    select coalesce(sum(coalesce(nullif(p.monthly_price, 0),
      round(coalesce(p.annual_price, 0) / 12.0, 2))), 0) mrr
    from public.organization_subscriptions s
    join public.saas_plans p on p.id = s.plan_id
    where s.status in ('active', 'past_due')
  ), finance as (
    select count(*) filter (where status = 'overdue' or (status = 'pending' and due_date < current_date)) overdue,
      coalesce(sum(amount) filter (where status = 'paid' and paid_at >= date_trunc('month', now())), 0) revenue
    from public.billing_records
  )
  select recurring.mrr, recurring.mrr * 12, tenants.active, tenants.trial, tenants.churned,
    case when tenants.active + tenants.churned = 0 then 0
      else round(tenants.churned::numeric * 100 / (tenants.active + tenants.churned), 2) end,
    (select count(*) from public.support_tickets where status in ('open', 'in_progress', 'waiting_client')),
    finance.overdue, finance.revenue
  from tenants, recurring, finance;
end; $$;

-- 2. Inadimplencia: move faturas pendentes vencidas para overdue de forma auditada.
create or replace function public.mark_overdue_invoices()
returns integer language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_actor public.owner_staff_members; v_count integer := 0;
begin
  v_actor := public.assert_backoffice_staff(array['admin', 'financeiro']);
  with moved as (
    update public.billing_records set status = 'overdue'
    where status = 'pending' and due_date < current_date
    returning id
  )
  select count(*) into v_count from moved;
  if v_count > 0 then
    insert into public.backoffice_audit_log(actor_staff_id, actor_user_id, action, resource_type, resource_id, after_values)
    values (v_actor.id, auth.uid(), 'billing_overdue_synced', 'billing_record', null,
      jsonb_build_object('marked_overdue', v_count));
  end if;
  return v_count;
end; $$;

-- 3. Maquina de estados da fatura:
--    pending -> paid | overdue | cancelled
--    overdue -> paid | cancelled
--    paid    -> refunded (preserva paid_at; pagamento aconteceu)
--    cancelled/refunded sao terminais e exigem motivo.
create or replace function public.update_backoffice_billing_status(
  p_billing_id uuid, p_status text, p_reason text default null
)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_actor public.owner_staff_members; v_before jsonb; v_current text;
begin
  v_actor := public.assert_backoffice_staff(array['admin', 'financeiro']);
  if p_status not in ('pending', 'paid', 'overdue', 'cancelled', 'refunded') then
    raise exception using errcode = '22023', message = 'billing_status_invalid';
  end if;
  if p_status in ('cancelled', 'refunded') and coalesce(nullif(trim(p_reason), ''), '') = '' then
    raise exception using errcode = '22023', message = 'billing_reason_required';
  end if;
  select to_jsonb(b), b.status into v_before, v_current
    from public.billing_records b where id = p_billing_id;
  if v_current is null then raise exception using errcode = 'P0002', message = 'billing_record_not_found'; end if;
  if not (
    (v_current = 'pending' and p_status in ('paid', 'overdue', 'cancelled'))
    or (v_current = 'overdue' and p_status in ('paid', 'cancelled'))
    or (v_current = 'paid' and p_status = 'refunded')
  ) then
    raise exception using errcode = '22023', message = 'billing_transition_invalid',
      detail = format('transicao %s -> %s nao permitida', v_current, p_status);
  end if;
  update public.billing_records set status = p_status,
    paid_at = case when p_status = 'paid' then coalesce(paid_at, now())
      when p_status = 'refunded' then paid_at else null end,
    notes = case when p_status in ('cancelled', 'refunded')
      then trim(coalesce(notes, '') || case when coalesce(notes, '') = '' then '' else ' | ' end ||
        case p_status when 'cancelled' then 'Cancelamento' else 'Reembolso' end || ': ' || trim(p_reason))
      else notes end
  where id = p_billing_id;
  insert into public.backoffice_audit_log(actor_staff_id, actor_user_id, action, resource_type, resource_id, before_values, after_values)
  values (v_actor.id, auth.uid(), 'billing_status_updated', 'billing_record', p_billing_id, v_before,
    jsonb_build_object('status', p_status, 'reason', nullif(trim(p_reason), '')));
end; $$;

drop function if exists public.update_backoffice_billing_status(uuid, text);

-- 4. Geracao mensal em conjunto unico (sem N+1), idempotente e com dry-run.
create or replace function public.generate_backoffice_monthly_billing(
  p_reference_date date default current_date, p_due_day integer default 10, p_dry_run boolean default false
)
returns integer language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_actor public.owner_staff_members; v_due date; v_period_start date; v_period_end date; v_count integer := 0;
begin
  v_actor := public.assert_backoffice_staff(array['admin', 'financeiro']);
  if p_due_day < 1 or p_due_day > 28 then
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
    where not exists (
      select 1 from public.billing_records b
      where b.tenant_id = o.id and b.period_start = v_period_start
        and b.billing_period = 'monthly' and b.status not in ('cancelled', 'refunded')
    );
    return v_count;
  end if;
  insert into public.billing_records(tenant_id, tenant_name, amount, currency, status, plan_type,
    billing_period, due_date, notes, created_by, period_start, period_end)
  select o.id, o.name, p.monthly_price, p.currency, 'pending', p.code, 'monthly', v_due,
    'Geracao mensal automatica', v_actor.id, v_period_start, v_period_end
  from public.organizations o
  join public.organization_subscriptions s on s.org_id = o.id and s.status = 'active'
  join public.saas_plans p on p.id = s.plan_id and p.status = 'active' and p.monthly_price > 0
  where not exists (
    select 1 from public.billing_records b
    where b.tenant_id = o.id and b.period_start = v_period_start
      and b.billing_period = 'monthly' and b.status not in ('cancelled', 'refunded')
  );
  get diagnostics v_count = row_count;
  if v_count > 0 then
    insert into public.backoffice_audit_log(actor_staff_id, actor_user_id, action, resource_type, resource_id, after_values)
    values (v_actor.id, auth.uid(), 'billing_batch_generated', 'billing_record', null,
      jsonb_build_object('reference_month', v_period_start, 'due_date', v_due, 'generated', v_count));
  end if;
  return v_count;
exception when unique_violation then
  raise exception using errcode = '23505', message = 'billing_record_already_exists_for_period';
end; $$;

drop function if exists public.generate_backoffice_monthly_billing(date, integer);

revoke all on function public.get_backoffice_saas_metrics() from public, anon;
revoke all on function public.mark_overdue_invoices() from public, anon;
revoke all on function public.update_backoffice_billing_status(uuid, text, text) from public, anon;
revoke all on function public.generate_backoffice_monthly_billing(date, integer, boolean) from public, anon;
grant execute on function public.get_backoffice_saas_metrics() to authenticated, service_role;
grant execute on function public.mark_overdue_invoices() to authenticated, service_role;
grant execute on function public.update_backoffice_billing_status(uuid, text, text) to authenticated, service_role;
grant execute on function public.generate_backoffice_monthly_billing(date, integer, boolean) to authenticated, service_role;
