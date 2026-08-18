create table public.apf_exception_reviews (
 id uuid primary key default gen_random_uuid(), dossier_id uuid not null references public.apf_evidence_dossiers(id) on delete cascade,
 counting_item_id uuid not null references public.apf_counting_items(id) on delete cascade,
 disposition text not null check(disposition in ('counted','absorbed','reuse_zero_pf','not_countable','non_functional','pending_evidence','hu_implementation_divergence','audit_risk')),
 absorbed_by_item_id uuid references public.apf_counting_items(id) on delete set null,
 justification text not null, reviewed_by uuid not null default auth.uid() references auth.users(id), reviewed_at timestamptz not null default now(), unique(dossier_id,counting_item_id)
);
alter table public.apf_exception_reviews enable row level security;
create policy apf_exception_reviews_select on public.apf_exception_reviews for select to authenticated using(public.apf_can_access_dossier(dossier_id));
create or replace function public.review_apf_exception(p_dossier_id uuid,p_counting_item_id uuid,p_disposition text,p_absorbed_by uuid,p_justification text) returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.apf_evidence_dossiers%rowtype;
begin
 if auth.uid() is null or not public.apf_can_access_dossier(p_dossier_id) then raise exception 'Acesso negado.' using errcode='42501'; end if;
 select * into d from public.apf_evidence_dossiers where id=p_dossier_id;
 if d.status in('homologated','superseded','cancelled') then raise exception 'Dossiê imutável.' using errcode='22023'; end if;
 if p_disposition not in('counted','absorbed','reuse_zero_pf','not_countable','non_functional','pending_evidence','hu_implementation_divergence','audit_risk') or nullif(trim(p_justification),'') is null then raise exception 'Tratamento e justificativa são obrigatórios.' using errcode='22023'; end if;
 if not exists(select 1 from public.apf_counting_items where id=p_counting_item_id and session_id=d.counting_session_id) then raise exception 'Item fora do dossiê.' using errcode='42501'; end if;
 if p_disposition='absorbed' and (p_absorbed_by is null or not exists(select 1 from public.apf_counting_items where id=p_absorbed_by and session_id=d.counting_session_id and id<>p_counting_item_id)) then raise exception 'Informe o processo que absorve o item.' using errcode='22023'; end if;
 insert into public.apf_exception_reviews(dossier_id,counting_item_id,disposition,absorbed_by_item_id,justification) values(p_dossier_id,p_counting_item_id,p_disposition,case when p_disposition='absorbed' then p_absorbed_by end,trim(p_justification)) on conflict(dossier_id,counting_item_id) do update set disposition=excluded.disposition,absorbed_by_item_id=excluded.absorbed_by_item_id,justification=excluded.justification,reviewed_by=auth.uid(),reviewed_at=now();
 insert into public.apf_dossier_events(dossier_id,event_type,event_data) values(p_dossier_id,'reviewed',jsonb_build_object('counting_item_id',p_counting_item_id,'disposition',p_disposition,'absorbed_by',p_absorbed_by,'justification',trim(p_justification)));
end $$;
revoke all on function public.review_apf_exception(uuid,uuid,text,uuid,text) from public;grant execute on function public.review_apf_exception(uuid,uuid,text,uuid,text) to authenticated;
