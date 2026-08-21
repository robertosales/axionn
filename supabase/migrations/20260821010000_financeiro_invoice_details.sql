-- Financeiro: edicao de detalhes da fatura (URL do documento e observacoes).

create or replace function public.update_backoffice_billing_details(
  p_billing_id uuid, p_invoice_url text, p_notes text
)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_actor public.owner_staff_members; v_before jsonb; v_invoice_url text; v_notes text;
begin
  v_actor := public.assert_backoffice_staff(array['admin', 'financeiro']);
  select to_jsonb(b) into v_before from public.billing_records b where id = p_billing_id;
  if v_before is null then raise exception using errcode = 'P0002', message = 'billing_record_not_found'; end if;
  v_invoice_url := nullif(trim(p_invoice_url), '');
  v_notes := nullif(trim(p_notes), '');
  update public.billing_records set invoice_url = v_invoice_url, notes = v_notes where id = p_billing_id;
  insert into public.backoffice_audit_log(actor_staff_id, actor_user_id, action, resource_type, resource_id, before_values, after_values)
  values (v_actor.id, auth.uid(), 'billing_details_updated', 'billing_record', p_billing_id, v_before,
    jsonb_build_object('invoice_url', v_invoice_url, 'notes', v_notes));
end; $$;

revoke all on function public.update_backoffice_billing_details(uuid, text, text) from public, anon;
grant execute on function public.update_backoffice_billing_details(uuid, text, text) to authenticated, service_role;
