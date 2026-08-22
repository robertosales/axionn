-- P0 Financeiro: serializa mudancas de status da mesma fatura e garante que
-- a auditoria represente exatamente o estado persistido.

create or replace function public.update_backoffice_billing_status(
  p_billing_id uuid, p_status text, p_reason text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.owner_staff_members;
  v_record public.billing_records%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_current text;
begin
  v_actor := public.assert_backoffice_staff(array['admin', 'financeiro']);

  if p_status not in ('pending', 'paid', 'overdue', 'cancelled', 'refunded') then
    raise exception using errcode = '22023', message = 'billing_status_invalid';
  end if;

  if p_status in ('cancelled', 'refunded')
    and coalesce(nullif(trim(p_reason), ''), '') = '' then
    raise exception using errcode = '22023', message = 'billing_reason_required';
  end if;

  -- O lock faz uma segunda requisicao aguardar e validar a transicao contra
  -- o status ja confirmado pela primeira, evitando o comportamento last-write-wins.
  select b.*
    into v_record
    from public.billing_records b
   where b.id = p_billing_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'billing_record_not_found';
  end if;

  v_before := to_jsonb(v_record);
  v_current := v_record.status::text;

  if not (
    (v_current = 'pending' and p_status in ('paid', 'overdue', 'cancelled'))
    or (v_current = 'overdue' and p_status in ('paid', 'cancelled'))
    or (v_current = 'paid' and p_status = 'refunded')
  ) then
    raise exception using
      errcode = '22023',
      message = 'billing_transition_invalid',
      detail = format('transicao %s -> %s nao permitida', v_current, p_status);
  end if;

  update public.billing_records as b
     set status = p_status,
         paid_at = case
           when p_status = 'paid' then coalesce(b.paid_at, now())
           when p_status = 'refunded' then b.paid_at
           else null
         end,
         notes = case
           when p_status in ('cancelled', 'refunded') then
             trim(coalesce(b.notes, '')
               || case when coalesce(b.notes, '') = '' then '' else ' | ' end
               || case p_status when 'cancelled' then 'Cancelamento' else 'Reembolso' end
               || ': ' || trim(p_reason))
           else b.notes
         end
   where b.id = p_billing_id
     and b.status::text = v_current
  returning to_jsonb(b) into v_after;

  -- Defesa adicional caso a estrategia de lock seja alterada no futuro.
  if not found then
    raise exception using errcode = '40001', message = 'billing_status_concurrent_update';
  end if;

  insert into public.backoffice_audit_log(
    actor_staff_id,
    actor_user_id,
    action,
    resource_type,
    resource_id,
    before_values,
    after_values
  )
  values (
    v_actor.id,
    auth.uid(),
    'billing_status_updated',
    'billing_record',
    p_billing_id,
    v_before,
    v_after || jsonb_build_object('reason', nullif(trim(p_reason), ''))
  );
end;
$$;

revoke all on function public.update_backoffice_billing_status(uuid, text, text) from public, anon;
grant execute on function public.update_backoffice_billing_status(uuid, text, text) to authenticated, service_role;

comment on function public.update_backoffice_billing_status(uuid, text, text) is
  'Atualiza o status financeiro com lock pessimista, maquina de estados e auditoria antes/depois.';
