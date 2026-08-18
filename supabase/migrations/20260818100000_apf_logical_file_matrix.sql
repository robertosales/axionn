create table public.apf_logical_file_reviews (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.apf_evidence_dossiers(id) on delete cascade,
  counting_item_id uuid not null references public.apf_counting_items(id) on delete cascade,
  recognizable boolean not null,
  maintained_by_application boolean not null,
  independent_lifecycle boolean not null,
  inside_boundary boolean not null,
  used_by_transaction boolean not null,
  decision text not null check (decision in ('ALI', 'AIE', 'not_logical_file', 'pending')),
  justification text not null,
  reviewed_by uuid not null default auth.uid() references auth.users(id),
  reviewed_at timestamptz not null default now(),
  unique (dossier_id, counting_item_id)
);
alter table public.apf_logical_file_reviews enable row level security;
create policy apf_logical_file_reviews_select on public.apf_logical_file_reviews for select to authenticated using (public.apf_can_access_dossier(dossier_id));

create or replace function public.review_apf_logical_file(
  p_dossier_id uuid, p_counting_item_id uuid, p_recognizable boolean,
  p_maintained boolean, p_independent_lifecycle boolean, p_inside_boundary boolean,
  p_used_by_transaction boolean, p_decision text, p_justification text
) returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_dossier public.apf_evidence_dossiers%rowtype;
begin
  if auth.uid() is null or not public.apf_can_access_dossier(p_dossier_id) then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  select * into v_dossier from public.apf_evidence_dossiers where id = p_dossier_id;
  if v_dossier.status in ('homologated','superseded','cancelled') then raise exception 'Dossiê imutável.' using errcode = '22023'; end if;
  if p_decision not in ('ALI','AIE','not_logical_file','pending') or nullif(trim(p_justification),'') is null then raise exception 'Decisão e justificativa são obrigatórias.' using errcode = '22023'; end if;
  if not exists (select 1 from public.apf_counting_items where id=p_counting_item_id and session_id=v_dossier.counting_session_id and upper(function_sigla) in ('ARQ','ALI','AIE','ILF','EIF')) then raise exception 'Item não é arquivo lógico do dossiê.' using errcode = '42501'; end if;
  insert into public.apf_logical_file_reviews(dossier_id,counting_item_id,recognizable,maintained_by_application,independent_lifecycle,inside_boundary,used_by_transaction,decision,justification)
  values(p_dossier_id,p_counting_item_id,p_recognizable,p_maintained,p_independent_lifecycle,p_inside_boundary,p_used_by_transaction,p_decision,trim(p_justification))
  on conflict(dossier_id,counting_item_id) do update set recognizable=excluded.recognizable,maintained_by_application=excluded.maintained_by_application,independent_lifecycle=excluded.independent_lifecycle,inside_boundary=excluded.inside_boundary,used_by_transaction=excluded.used_by_transaction,decision=excluded.decision,justification=excluded.justification,reviewed_by=auth.uid(),reviewed_at=now();
  insert into public.apf_dossier_events(dossier_id,event_type,event_data) values(p_dossier_id,'reviewed',jsonb_build_object('counting_item_id',p_counting_item_id,'logical_file_decision',p_decision,'justification',trim(p_justification)));
end $$;
revoke all on function public.review_apf_logical_file(uuid,uuid,boolean,boolean,boolean,boolean,boolean,text,text) from public;
grant execute on function public.review_apf_logical_file(uuid,uuid,boolean,boolean,boolean,boolean,boolean,text,text) to authenticated;
