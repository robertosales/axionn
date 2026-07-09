-- Backoffice Axionn: financeiro, suporte e metricas SaaS.

create table if not exists public.billing_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.organizations(id) on delete set null,
  tenant_name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'BRL',
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'overdue', 'cancelled', 'refunded')),
  plan_type text not null default 'custom'
    check (plan_type in ('starter', 'professional', 'enterprise', 'custom')),
  billing_period text not null default 'monthly'
    check (billing_period in ('monthly', 'quarterly', 'annual')),
  due_date date not null,
  paid_at timestamptz,
  invoice_url text,
  notes text,
  created_by uuid references public.owner_staff_members(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text unique not null default ('AX-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  tenant_id uuid references public.organizations(id) on delete set null,
  tenant_name text not null,
  reporter_name text not null,
  reporter_email text not null,
  subject text not null,
  description text not null,
  category text not null default 'other'
    check (category in ('bug', 'feature_request', 'billing', 'access', 'other')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'waiting_client', 'resolved', 'closed')),
  assigned_to uuid references public.owner_staff_members(id) on delete set null,
  resolved_at timestamptz,
  sla_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saas_metrics_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date unique not null default current_date,
  total_tenants integer not null default 0,
  active_tenants integer not null default 0,
  trial_tenants integer not null default 0,
  churned_tenants integer not null default 0,
  mrr numeric(12,2) not null default 0,
  arr numeric(12,2) not null default 0,
  new_mrr numeric(12,2) not null default 0,
  churned_mrr numeric(12,2) not null default 0,
  total_users integer not null default 0,
  active_users_30d integer not null default 0,
  open_tickets integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_status_due on public.billing_records(status, due_date);
create index if not exists idx_support_status_priority on public.support_tickets(status, priority);

drop trigger if exists trg_billing_updated_at on public.billing_records;
create trigger trg_billing_updated_at before update on public.billing_records
for each row execute function public.touch_backoffice_updated_at();
drop trigger if exists trg_support_updated_at on public.support_tickets;
create trigger trg_support_updated_at before update on public.support_tickets
for each row execute function public.touch_backoffice_updated_at();

alter table public.billing_records enable row level security;
alter table public.support_tickets enable row level security;
alter table public.saas_metrics_snapshots enable row level security;

revoke all on public.billing_records, public.support_tickets, public.saas_metrics_snapshots
  from public, anon, authenticated;
grant all on public.billing_records, public.support_tickets, public.saas_metrics_snapshots to service_role;

create or replace function public.list_backoffice_billing_records()
returns setof public.billing_records
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.assert_backoffice_staff(array['admin', 'financeiro']);
  return query select * from public.billing_records order by due_date desc, created_at desc;
end; $$;

create or replace function public.update_backoffice_billing_status(p_billing_id uuid, p_status text)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_actor public.owner_staff_members; v_before jsonb;
begin
  v_actor := public.assert_backoffice_staff(array['admin', 'financeiro']);
  if p_status not in ('pending', 'paid', 'overdue', 'cancelled', 'refunded') then
    raise exception using errcode = '22023', message = 'billing_status_invalid';
  end if;
  select to_jsonb(b) into v_before from public.billing_records b where id = p_billing_id;
  update public.billing_records set status = p_status,
    paid_at = case when p_status = 'paid' then coalesce(paid_at, now()) else paid_at end
  where id = p_billing_id;
  if not found then raise exception using errcode = 'P0002', message = 'billing_record_not_found'; end if;
  insert into public.backoffice_audit_log(actor_staff_id, actor_user_id, action, resource_type, resource_id, before_values, after_values)
  values (v_actor.id, auth.uid(), 'billing_status_updated', 'billing_record', p_billing_id, v_before,
    jsonb_build_object('status', p_status));
end; $$;

create or replace function public.list_backoffice_support_tickets()
returns setof public.support_tickets
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.assert_backoffice_staff(array['admin', 'suporte', 'comercial']);
  return query select * from public.support_tickets order by
    case priority when 'critical' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,
    created_at desc;
end; $$;

create or replace function public.update_backoffice_support_ticket_status(p_ticket_id uuid, p_status text)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_actor public.owner_staff_members; v_before jsonb;
begin
  v_actor := public.assert_backoffice_staff(array['admin', 'suporte', 'comercial']);
  if p_status not in ('open', 'in_progress', 'waiting_client', 'resolved', 'closed') then
    raise exception using errcode = '22023', message = 'support_status_invalid';
  end if;
  select to_jsonb(t) into v_before from public.support_tickets t where id = p_ticket_id;
  update public.support_tickets set status = p_status,
    resolved_at = case when p_status in ('resolved', 'closed') then coalesce(resolved_at, now()) else null end
  where id = p_ticket_id;
  if not found then raise exception using errcode = 'P0002', message = 'support_ticket_not_found'; end if;
  insert into public.backoffice_audit_log(actor_staff_id, actor_user_id, action, resource_type, resource_id, before_values, after_values)
  values (v_actor.id, auth.uid(), 'support_status_updated', 'support_ticket', p_ticket_id, v_before,
    jsonb_build_object('status', p_status));
end; $$;

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
  ), finance as (
    select coalesce(sum(case
      when status not in ('cancelled', 'refunded') and billing_period = 'monthly' then amount
      when status not in ('cancelled', 'refunded') and billing_period = 'quarterly' then amount / 3
      when status not in ('cancelled', 'refunded') and billing_period = 'annual' then amount / 12 else 0 end), 0) monthly,
      count(*) filter (where status = 'overdue' or (status = 'pending' and due_date < current_date)) overdue,
      coalesce(sum(amount) filter (where status = 'paid' and paid_at >= date_trunc('month', now())), 0) revenue
    from public.billing_records
  )
  select finance.monthly, finance.monthly * 12, tenants.active, tenants.trial, tenants.churned,
    case when tenants.active + tenants.churned = 0 then 0
      else round(tenants.churned::numeric * 100 / (tenants.active + tenants.churned), 2) end,
    (select count(*) from public.support_tickets where status in ('open', 'in_progress', 'waiting_client')),
    finance.overdue, finance.revenue
  from tenants, finance;
end; $$;

revoke all on function public.list_backoffice_billing_records() from public, anon;
revoke all on function public.update_backoffice_billing_status(uuid, text) from public, anon;
revoke all on function public.list_backoffice_support_tickets() from public, anon;
revoke all on function public.update_backoffice_support_ticket_status(uuid, text) from public, anon;
revoke all on function public.get_backoffice_saas_metrics() from public, anon;
grant execute on function public.list_backoffice_billing_records() to authenticated, service_role;
grant execute on function public.update_backoffice_billing_status(uuid, text) to authenticated, service_role;
grant execute on function public.list_backoffice_support_tickets() to authenticated, service_role;
grant execute on function public.update_backoffice_support_ticket_status(uuid, text) to authenticated, service_role;
grant execute on function public.get_backoffice_saas_metrics() to authenticated, service_role;
