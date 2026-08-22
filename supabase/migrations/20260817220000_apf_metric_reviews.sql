create table public.apf_counting_metric_reviews (
  id uuid primary key default gen_random_uuid(), dossier_id uuid not null references public.apf_evidence_dossiers(id) on delete cascade,
  counting_item_id uuid not null references public.apf_counting_items(id) on delete cascade,
  suggested_det integer, suggested_ftr integer, suggested_ret integer,
  confirmed_det integer check (confirmed_det is null or confirmed_det >= 0), confirmed_ftr integer check (confirmed_ftr is null or confirmed_ftr >= 0), confirmed_ret integer check (confirmed_ret is null or confirmed_ret >= 0),
  justification text not null, reviewed_by uuid not null default auth.uid() references auth.users(id), reviewed_at timestamptz not null default now(),
  unique (dossier_id, counting_item_id)
);
alter table public.apf_counting_metric_reviews enable row level security;
create policy apf_metric_reviews_select on public.apf_counting_metric_reviews for select to authenticated using (public.apf_can_access_dossier(dossier_id));

create or replace function public.review_apf_counting_metrics(p_dossier_id uuid, p_counting_item_id uuid, p_det integer, p_ftr integer, p_ret integer, p_justification text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_dossier public.apf_evidence_dossiers%rowtype; v_payload jsonb;
begin
  if auth.uid() is null or not public.apf_can_access_dossier(p_dossier_id) then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  select * into v_dossier from public.apf_evidence_dossiers where id = p_dossier_id;
  if v_dossier.status in ('homologated','superseded','cancelled') then raise exception 'Dossiê imutável.' using errcode = '22023'; end if;
  if nullif(trim(p_justification),'') is null or coalesce(p_det,p_ftr,p_ret) is null or least(coalesce(p_det,0),coalesce(p_ftr,0),coalesce(p_ret,0)) < 0 then raise exception 'Métricas válidas e justificativa são obrigatórias.' using errcode = '22023'; end if;
  select source_payload into v_payload from public.apf_counting_items where id = p_counting_item_id and session_id = v_dossier.counting_session_id;
  if not found then raise exception 'Item não pertence ao dossiê.' using errcode = '42501'; end if;
  insert into public.apf_counting_metric_reviews(dossier_id,counting_item_id,suggested_det,suggested_ftr,suggested_ret,confirmed_det,confirmed_ftr,confirmed_ret,justification)
  values(p_dossier_id,p_counting_item_id,coalesce(nullif(v_payload->>'det','')::integer,nullif(v_payload->>'det_count','')::integer),coalesce(nullif(v_payload->>'ftr','')::integer,nullif(v_payload->>'ftr_count','')::integer),coalesce(nullif(v_payload->>'ret','')::integer,nullif(v_payload->>'ret_count','')::integer),p_det,p_ftr,p_ret,trim(p_justification))
  on conflict(dossier_id,counting_item_id) do update set confirmed_det=excluded.confirmed_det,confirmed_ftr=excluded.confirmed_ftr,confirmed_ret=excluded.confirmed_ret,justification=excluded.justification,reviewed_by=auth.uid(),reviewed_at=now();
  insert into public.apf_dossier_events(dossier_id,event_type,event_data) values(p_dossier_id,'reviewed',jsonb_build_object('counting_item_id',p_counting_item_id,'metrics',jsonb_build_object('det',p_det,'ftr',p_ftr,'ret',p_ret),'justification',trim(p_justification)));
end $$;
revoke all on function public.review_apf_counting_metrics(uuid,uuid,integer,integer,integer,text) from public;
grant execute on function public.review_apf_counting_metrics(uuid,uuid,integer,integer,integer,text) to authenticated;
