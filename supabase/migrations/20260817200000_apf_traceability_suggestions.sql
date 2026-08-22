create table public.apf_traceability_suggestions (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.apf_evidence_dossiers(id) on delete cascade,
  acceptance_criterion_id uuid not null references public.apf_acceptance_criteria(id) on delete cascade,
  evidence_source_id uuid not null references public.apf_evidence_sources(id) on delete cascade,
  method text not null default 'lexical' check (method in ('lexical', 'ai')),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  rationale text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (dossier_id, acceptance_criterion_id, evidence_source_id, method)
);

alter table public.apf_traceability_suggestions enable row level security;
create policy apf_traceability_suggestions_select on public.apf_traceability_suggestions for select to authenticated using (public.apf_can_access_dossier(dossier_id));
create policy apf_traceability_suggestions_insert on public.apf_traceability_suggestions for insert to authenticated with check (public.apf_can_access_dossier(dossier_id));
create policy apf_traceability_suggestions_update on public.apf_traceability_suggestions for update to authenticated using (public.apf_can_access_dossier(dossier_id)) with check (public.apf_can_access_dossier(dossier_id));

create or replace function public.generate_apf_traceability_suggestions(p_dossier_id uuid)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
begin
  if auth.uid() is null or not public.apf_can_access_dossier(p_dossier_id) then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  with criterion_words as (
    select criterion.id, array_agg(distinct word) filter (where length(word) >= 4) words
    from public.apf_acceptance_criteria criterion
    cross join lateral regexp_split_to_table(lower(criterion.original_text || ' ' || coalesce(criterion.expected_behavior, '')), '[^a-z0-9áàâãéêíóôõúç]+') word
    where criterion.dossier_id = p_dossier_id group by criterion.id
  ), evidence_words as (
    select evidence.id, array_agg(distinct word) filter (where length(word) >= 4) words
    from public.apf_evidence_sources evidence
    cross join lateral regexp_split_to_table(lower(evidence.summary || ' ' || coalesce(evidence.file_path, '') || ' ' || coalesce(evidence.symbol_ref, '')), '[^a-z0-9áàâãéêíóôõúç]+') word
    where evidence.dossier_id = p_dossier_id group by evidence.id
  ), ranked as (
    select cw.id criterion_id, ew.id evidence_id, overlap.matches,
      row_number() over (partition by cw.id order by overlap.matches desc, ew.id) rank
    from criterion_words cw cross join evidence_words ew
    cross join lateral (select count(*)::integer matches from unnest(coalesce(cw.words, '{}')) word where word = any(coalesce(ew.words, '{}'))) overlap
    where overlap.matches > 0
  )
  insert into public.apf_traceability_suggestions (dossier_id, acceptance_criterion_id, evidence_source_id, method, confidence, rationale)
  select p_dossier_id, criterion_id, evidence_id, 'lexical', least(0.95, 0.35 + matches * 0.12),
    matches || ' termo(s) funcional(is) em comum entre o critério e a evidência.'
  from ranked where rank <= 3
  on conflict (dossier_id, acceptance_criterion_id, evidence_source_id, method)
  do update set confidence = excluded.confidence, rationale = excluded.rationale
    where apf_traceability_suggestions.status = 'pending';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

create or replace function public.review_apf_traceability_suggestion(p_suggestion_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_suggestion public.apf_traceability_suggestions%rowtype;
begin
  select * into v_suggestion from public.apf_traceability_suggestions where id = p_suggestion_id for update;
  if not found or auth.uid() is null or not public.apf_can_access_dossier(v_suggestion.dossier_id) then raise exception 'Sugestão não encontrada ou acesso negado.' using errcode = '42501'; end if;
  if v_suggestion.status <> 'pending' then raise exception 'Sugestão já revisada.' using errcode = '22023'; end if;
  if p_accept and not exists (select 1 from public.apf_traceability_links where dossier_id = v_suggestion.dossier_id and acceptance_criterion_id = v_suggestion.acceptance_criterion_id and evidence_source_id = v_suggestion.evidence_source_id and counting_item_id is null) then
    insert into public.apf_traceability_links (dossier_id, acceptance_criterion_id, evidence_source_id, functional_result, suggested_by_ai, confirmed_by, confirmed_at)
    values (v_suggestion.dossier_id, v_suggestion.acceptance_criterion_id, v_suggestion.evidence_source_id, 'pending', v_suggestion.method = 'ai', auth.uid(), now());
  end if;
  update public.apf_traceability_suggestions set status = case when p_accept then 'accepted' else 'rejected' end, reviewed_by = auth.uid(), reviewed_at = now() where id = p_suggestion_id;
  insert into public.apf_dossier_events (dossier_id, event_type, event_data) values (v_suggestion.dossier_id, 'reviewed', jsonb_build_object('suggestion_id', p_suggestion_id, 'decision', case when p_accept then 'accepted' else 'rejected' end, 'method', v_suggestion.method));
end $$;

revoke all on function public.generate_apf_traceability_suggestions(uuid) from public;
revoke all on function public.review_apf_traceability_suggestion(uuid, boolean) from public;
grant execute on function public.generate_apf_traceability_suggestions(uuid) to authenticated;
grant execute on function public.review_apf_traceability_suggestion(uuid, boolean) to authenticated;
