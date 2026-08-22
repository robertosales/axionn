create table public.apf_measurement_billing_requests(
 id uuid primary key default gen_random_uuid(),batch_id uuid not null unique references public.apf_measurement_batches(id)on delete restrict,organization_id uuid not null references public.organizations(id)on delete restrict,
 competence date not null,approved_pf numeric(14,4)not null check(approved_pf>=0),unit_price numeric(14,4)not null check(unit_price>=0),gross_amount numeric(14,2)not null check(gross_amount>=0),currency text not null default'BRL',due_date date not null,
 status text not null default'submitted'check(status in('submitted','linked','invoiced','cancelled')),billing_record_id uuid references public.billing_records(id)on delete restrict,note text,submitted_by uuid not null default auth.uid()references auth.users(id),submitted_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.apf_measurement_billing_events(id bigint generated always as identity primary key,request_id uuid not null references public.apf_measurement_billing_requests(id)on delete restrict,event_type text not null check(event_type in('submitted','linked','invoiced','cancelled')),note text not null,actor_id uuid not null default auth.uid()references auth.users(id),created_at timestamptz not null default now());
create index apf_billing_requests_org_competence_idx on public.apf_measurement_billing_requests(organization_id,competence desc);
alter table public.apf_measurement_billing_requests enable row level security;alter table public.apf_measurement_billing_events enable row level security;
create policy apf_billing_requests_select on public.apf_measurement_billing_requests for select to authenticated using(public.is_organization_member(organization_id,auth.uid())or public.is_backoffice_staff(auth.uid()));
create policy apf_billing_events_select on public.apf_measurement_billing_events for select to authenticated using(exists(select 1 from public.apf_measurement_billing_requests r where r.id=request_id and(public.is_organization_member(r.organization_id,auth.uid())or public.is_backoffice_staff(auth.uid()))));

create or replace function public.submit_apf_batch_for_billing(p_batch_id uuid,p_unit_price numeric,p_due_date date,p_note text)returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare b public.apf_measurement_batches%rowtype;rid uuid;v_pf numeric;v_amount numeric;
begin
 select*into b from public.apf_measurement_batches where id=p_batch_id for update;
 if not found or auth.uid()is null or not public.is_organization_member(b.organization_id,auth.uid())then raise exception'Acesso negado.'using errcode='42501';end if;
 if b.status not in('approved','glosa_resolved','closed')then raise exception'O lote precisa estar aprovado para faturamento.'using errcode='22023';end if;
 if p_unit_price is null or p_unit_price<0 or p_due_date is null then raise exception'Preço unitário e vencimento válidos são obrigatórios.'using errcode='22023';end if;
 select id into rid from public.apf_measurement_billing_requests where batch_id=p_batch_id;if found then return rid;end if;
 v_pf:=greatest(b.total_pf-b.disputed_pf,0);v_amount:=round(v_pf*p_unit_price,2);
 insert into public.apf_measurement_billing_requests(batch_id,organization_id,competence,approved_pf,unit_price,gross_amount,due_date,note)values(b.id,b.organization_id,b.competence,v_pf,p_unit_price,v_amount,p_due_date,nullif(trim(p_note),''))returning id into rid;
 insert into public.apf_measurement_billing_events(request_id,event_type,note)values(rid,'submitted',coalesce(nullif(trim(p_note),''),'Lote APF enviado ao faturamento.'));return rid;
end $$;

create or replace function public.link_apf_billing_record(p_request_id uuid,p_billing_record_id uuid,p_note text,p_mark_invoiced boolean default false)returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare actor public.owner_staff_members;r public.apf_measurement_billing_requests%rowtype;br public.billing_records%rowtype;v_event text;
begin
 actor:=public.assert_backoffice_staff(array['admin','financeiro']);select*into r from public.apf_measurement_billing_requests where id=p_request_id for update;if not found then raise exception'Solicitação APF não encontrada.'using errcode='P0002';end if;
 select*into br from public.billing_records where id=p_billing_record_id;if not found or br.tenant_id is distinct from r.organization_id then raise exception'Registro financeiro incompatível com a organização.'using errcode='22023';end if;
 v_event:=case when p_mark_invoiced then'invoiced'else'linked'end;update public.apf_measurement_billing_requests set billing_record_id=br.id,status=v_event,updated_at=now()where id=r.id;
 insert into public.apf_measurement_billing_events(request_id,event_type,note,actor_id)values(r.id,v_event,coalesce(nullif(trim(p_note),''),'Vínculo financeiro registrado.'),auth.uid());
 insert into public.backoffice_audit_log(actor_staff_id,actor_user_id,action,resource_type,resource_id,before_values,after_values)values(actor.id,auth.uid(),'apf_billing_linked','apf_measurement_billing_request',r.id,to_jsonb(r),jsonb_build_object('billing_record_id',br.id,'status',v_event));
end $$;
revoke all on function public.submit_apf_batch_for_billing(uuid,numeric,date,text)from public,anon;revoke all on function public.link_apf_billing_record(uuid,uuid,text,boolean)from public,anon;
grant execute on function public.submit_apf_batch_for_billing(uuid,numeric,date,text)to authenticated;grant execute on function public.link_apf_billing_record(uuid,uuid,text,boolean)to authenticated,service_role;
