-- Financeiro v2: automacao diaria, snapshots SaaS, lembretes de cobranca e
-- historico de precos dos planos.

-- 1. Rastreio do ultimo lembrete enviado por fatura.
alter table public.billing_records add column if not exists last_reminder_at timestamptz;

-- 2. Lembrete de cobranca: auditado por fatura (envio efetivo de e-mail entra
--    quando o provedor transacional for integrado).
create or replace function public.record_billing_reminder(p_billing_id uuid, p_note text default null)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_actor public.owner_staff_members; v_before jsonb;
begin
  v_actor := public.assert_backoffice_staff(array['admin', 'financeiro', 'comercial']);
  select to_jsonb(b) into v_before from public.billing_records b where id = p_billing_id;
  if v_before is null then raise exception using errcode = 'P0002', message = 'billing_record_not_found'; end if;
  update public.billing_records set last_reminder_at = now() where id = p_billing_id;
  insert into public.backoffice_audit_log(actor_staff_id, actor_user_id, action, resource_type, resource_id, before_values, after_values)
  values (v_actor.id, auth.uid(), 'billing_reminder_sent', 'billing_record', p_billing_id, v_before,
    jsonb_build_object('note', nullif(trim(p_note), '')));
end; $$;

-- 3. Sincronizacao de inadimplencia sem assert (cron-safe).
create or replace function public.mark_overdue_invoices_internal()
returns integer language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_count integer := 0;
begin
  with moved as (
    update public.billing_records set status = 'overdue'
    where status = 'pending' and due_date < current_date
    returning id
  )
  select count(*) into v_count from moved;
  if v_count > 0 then
    insert into public.backoffice_audit_log(actor_staff_id, actor_user_id, action, resource_type, resource_id, after_values)
    values (null, null, 'billing_overdue_synced', 'billing_record', null,
      jsonb_build_object('marked_overdue', v_count));
  end if;
  return v_count;
end; $$;

-- 4. Wrapper com assert para uso humano.
create or replace function public.mark_overdue_invoices()
returns integer language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_actor public.owner_staff_members; v_count integer;
begin
  v_actor := public.assert_backoffice_staff(array['admin', 'financeiro']);
  v_count := public.mark_overdue_invoices_internal();
  return v_count;
end; $$;

-- 5. Snapshot diario de metricas SaaS (cron-safe, upsert na data).
create or replace function public.refresh_saas_metrics_snapshot()
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  insert into public.saas_metrics_snapshots(
    snapshot_date, total_tenants, active_tenants, trial_tenants, churned_tenants,
    mrr, arr, open_tickets
  )
  select current_date, count(*),
    count(*) filter (where status::text = 'active'),
    count(*) filter (where status::text = 'trial'),
    count(*) filter (where status::text in ('churned', 'cancelled')),
    coalesce((select sum(coalesce(nullif(p.monthly_price, 0), round(coalesce(p.annual_price, 0) / 12.0, 2)))
      from public.organization_subscriptions s join public.saas_plans p on p.id = s.plan_id
      where s.status in ('active', 'past_due')), 0),
    coalesce((select sum(coalesce(nullif(p.monthly_price, 0), round(coalesce(p.annual_price, 0) / 12.0, 2))) * 12
      from public.organization_subscriptions s join public.saas_plans p on p.id = s.plan_id
      where s.status in ('active', 'past_due')), 0),
    (select count(*) from public.support_tickets where status in ('open', 'in_progress', 'waiting_client'))
  from public.organizations
  on conflict (snapshot_date) do update set
    total_tenants = excluded.total_tenants, active_tenants = excluded.active_tenants,
    trial_tenants = excluded.trial_tenants, churned_tenants = excluded.churned_tenants,
    mrr = excluded.mrr, arr = excluded.arr, open_tickets = excluded.open_tickets;
end; $$;

-- 6. Historico de snapshots (leitura para graficos futuros).
create or replace function public.list_backoffice_saas_snapshots(p_limit integer default 90)
returns setof public.saas_metrics_snapshots language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.assert_backoffice_staff(array['admin', 'financeiro', 'comercial']);
  return query select * from public.saas_metrics_snapshots
    order by snapshot_date desc
    limit least(greatest(p_limit, 1), 365);
end; $$;

-- 7. Historico de precos dos planos (do audit log).
create or replace function public.list_backoffice_plan_price_history(p_limit integer default 50)
returns table(
  action_at timestamptz, plan_code text, plan_name text,
  monthly_price numeric, annual_price numeric, currency text,
  actor_name text, actor_email text
) language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.assert_backoffice_staff(array['admin', 'financeiro']);
  return query
  select l.created_at, p.code, p.name,
    coalesce((l.after_values->>'monthly_price')::numeric, 0),
    coalesce((l.after_values->>'annual_price')::numeric, 0),
    coalesce(l.after_values->>'currency', 'BRL'),
    coalesce(s.full_name, ''),
    coalesce(s.email, '')
  from public.backoffice_audit_log l
  join public.saas_plans p on p.id = l.resource_id
  left join public.owner_staff_members s on s.id = l.actor_staff_id
  where l.action = 'plan_price_updated'
  order by l.created_at desc
  limit least(greatest(p_limit, 1), 200);
end; $$;

-- 8. Registro de lembrete de cobranca (staff admin/financeiro/comercial).
revoke all on function public.record_billing_reminder(uuid, text) from public, anon;
grant execute on function public.record_billing_reminder(uuid, text) to authenticated, service_role;

-- 9. Listagem de snapshots e historico de precos (staff admin/financeiro/comercial).
revoke all on function public.list_backoffice_saas_snapshots(integer) from public, anon;
revoke all on function public.list_backoffice_plan_price_history(integer) from public, anon;
grant execute on function public.list_backoffice_saas_snapshots(integer) to authenticated, service_role;
grant execute on function public.list_backoffice_plan_price_history(integer) to authenticated, service_role;

-- 10. Funcoes internas de cron (apenas service_role).
revoke all on function public.mark_overdue_invoices_internal() from public, anon, authenticated;
revoke all on function public.refresh_saas_metrics_snapshot() from public, anon, authenticated;
grant execute on function public.mark_overdue_invoices_internal() to service_role;
grant execute on function public.refresh_saas_metrics_snapshot() to service_role;

-- 11. Agendamento defensivo (pg_cron).
DO $do$
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE WARNING 'financeiro_cron_deferred: cron.job unavailable';
    RETURN;
  END IF;
  PERFORM cron.unschedule(job.jobid) FROM cron.job job
    WHERE job.jobname IN ('financeiro-overdue-sync', 'financeiro-saas-snapshot');
  BEGIN
    PERFORM cron.schedule('financeiro-overdue-sync', '30 5 * * *', 'SELECT public.mark_overdue_invoices_internal();');
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'financeiro_overdue_cron_deferred: %', SQLERRM; END;
  BEGIN
    PERFORM cron.schedule('financeiro-saas-snapshot', '0 6 * * *', 'SELECT public.refresh_saas_metrics_snapshot();');
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'financeiro_snapshot_cron_deferred: %', SQLERRM; END;
END;
$do$;