begin;
create or replace function public.transition_apf_measurement_batch(p_batch_id uuid,p_decision text,p_note text,p_disputed_pf numeric default null)returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.apf_measurement_batches%rowtype;next_status text;required_permission text;
begin
 select*into b from public.apf_measurement_batches where id=p_batch_id for update;
 if not found or auth.uid()is null then raise exception'Acesso negado.'using errcode='42501';end if;
 required_permission:=case when p_decision='submitted'then'apf.dossier.validate'else'apf.dossier.homologate'end;
 if not public.has_apf_dossier_permission(b.organization_id,required_permission,auth.uid())then raise exception'Permissão APF insuficiente: %',required_permission using errcode='42501';end if;
 if p_decision in('approved','glosa_resolved','closed')and b.created_by=auth.uid()then raise exception'O aprovador formal deve ser diferente do criador do lote.'using errcode='42501';end if;
 if nullif(trim(p_note),'')is null then raise exception'Justificativa obrigatória.'using errcode='22023';end if;
 next_status:=case when b.status='draft'and p_decision='submitted'then'under_review'when b.status='under_review'and p_decision='approved'then'approved'when b.status in('under_review','approved')and p_decision='glosa_requested'then'glosa_requested'when b.status='glosa_requested'and p_decision='glosa_resolved'then'glosa_resolved'when b.status in('approved','glosa_resolved')and p_decision='closed'then'closed'when b.status not in('closed','cancelled')and p_decision='cancelled'then'cancelled'end;
 if next_status is null then raise exception'Transição inválida.'using errcode='22023';end if;
 update public.apf_measurement_batches set status=next_status,disputed_pf=case when p_decision='glosa_requested'then coalesce(p_disputed_pf,0)when p_decision='glosa_resolved'then coalesce(p_disputed_pf,0)else disputed_pf end,updated_at=now()where id=p_batch_id;
 insert into public.apf_measurement_batch_decisions(batch_id,decision,note,disputed_pf)values(p_batch_id,p_decision,trim(p_note),p_disputed_pf);
end $$;
create or replace function public.submit_apf_batch_for_billing(p_batch_id uuid,p_unit_price numeric,p_due_date date,p_note text)returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.apf_measurement_batches%rowtype;rid uuid;v_pf numeric;v_amount numeric;
begin
 select*into b from public.apf_measurement_batches where id=p_batch_id for update;
 if not found or auth.uid()is null or not public.has_apf_dossier_permission(b.organization_id,'apf.dossier.homologate',auth.uid())then raise exception'Permissão APF insuficiente: apf.dossier.homologate'using errcode='42501';end if;
 if b.status not in('approved','glosa_resolved','closed')then raise exception'O lote precisa estar aprovado para faturamento.'using errcode='22023';end if;
 if p_unit_price is null or p_unit_price<0 or p_due_date is null then raise exception'Preço unitário e vencimento válidos são obrigatórios.'using errcode='22023';end if;
 select id into rid from public.apf_measurement_billing_requests where batch_id=p_batch_id;if found then return rid;end if;
 v_pf:=greatest(b.total_pf-b.disputed_pf,0);v_amount:=round(v_pf*p_unit_price,2);
 insert into public.apf_measurement_billing_requests(batch_id,organization_id,competence,approved_pf,unit_price,gross_amount,due_date,note)values(b.id,b.organization_id,b.competence,v_pf,p_unit_price,v_amount,p_due_date,nullif(trim(p_note),''))returning id into rid;
 insert into public.apf_measurement_billing_events(request_id,event_type,note)values(rid,'submitted',coalesce(nullif(trim(p_note),''),'Lote APF enviado ao faturamento.'));return rid;
end $$;
commit;
