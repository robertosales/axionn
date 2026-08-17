create table public.apf_audit_findings (
  id uuid primary key default gen_random_uuid(), dossier_id uuid not null references public.apf_evidence_dossiers(id) on delete cascade,
  fingerprint text not null, finding_type text not null, severity text not null check (severity in ('critical', 'warning', 'info')),
  title text not null, detail text not null, entity_type text, entity_id uuid,
  status text not null default 'open' check (status in ('open', 'resolved', 'accepted_risk')),
  resolution_note text, reviewed_by uuid references auth.users(id) on delete set null, reviewed_at timestamptz,
  detected_at timestamptz not null default now(), unique (dossier_id, fingerprint)
);
alter table public.apf_audit_findings enable row level security;
create policy apf_audit_findings_select on public.apf_audit_findings for select to authenticated using (public.apf_can_access_dossier(dossier_id));

create or replace function public.scan_apf_dossier_audit(p_dossier_id uuid) returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_dossier public.apf_evidence_dossiers%rowtype; v_count integer;
begin
  if auth.uid() is null or not public.apf_can_access_dossier(p_dossier_id) then raise exception 'Acesso negado.' using errcode = '42501'; end if;
  select * into v_dossier from public.apf_evidence_dossiers where id = p_dossier_id;
  if v_dossier.status in ('homologated', 'superseded', 'cancelled') then raise exception 'O status atual não permite nova varredura.' using errcode = '22023'; end if;
  update public.apf_audit_findings set status = 'resolved', resolution_note = 'Não detectado na varredura mais recente.', reviewed_at = now()
   where dossier_id = p_dossier_id and status = 'open';
  with findings as (
    select 'criterion-decision:' || c.id fingerprint, 'criterion_without_decision' finding_type, 'critical' severity, 'Critério sem decisão' title, c.stable_id || ' ainda não possui decisão funcional.' detail, 'acceptance_criterion' entity_type, c.id entity_id from public.apf_acceptance_criteria c where c.dossier_id = p_dossier_id and c.decision is null
    union all select 'criterion-evidence:' || c.id, 'criterion_without_evidence', 'critical', 'Critério sem evidência', c.stable_id || ' não possui evidência rastreada.', 'acceptance_criterion', c.id from public.apf_acceptance_criteria c where c.dossier_id = p_dossier_id and not exists (select 1 from public.apf_traceability_links l where l.acceptance_criterion_id = c.id)
    union all select 'evidence-verification:' || e.id, 'unverified_evidence', 'warning', 'Evidência não verificada', coalesce(cat.stable_id, e.id::text) || ' está com status ' || e.verification_status || '.', 'evidence_source', e.id from public.apf_evidence_sources e left join public.apf_evidence_catalog_entries cat on cat.evidence_source_id = e.id and cat.dossier_id = e.dossier_id where e.dossier_id = p_dossier_id and e.verification_status <> 'verified'
    union all select 'counting-evidence:' || i.id, 'counting_item_without_evidence', 'critical', 'Item APF sem evidência', i.ef_description || ' possui PF e não está ligado a evidência.', 'counting_item', i.id from public.apf_counting_items i where i.session_id = v_dossier.counting_session_id and coalesce(i.corrected_pf_fs, i.pf_fs, 0) > 0 and not exists (select 1 from public.apf_traceability_links l where l.dossier_id = p_dossier_id and l.counting_item_id = i.id)
    union all select 'override-reason:' || i.id, 'override_without_reason', 'critical', 'Override sem justificativa', i.ef_description || ' foi corrigido manualmente sem justificativa.', 'counting_item', i.id from public.apf_counting_items i where i.session_id = v_dossier.counting_session_id and (i.corrected_pf_fs is not null or i.corrected_pf_bruto is not null) and nullif(trim(i.justification), '') is null
    union all select 'memory-total', 'counting_memory_mismatch', 'critical', 'Memória de cálculo divergente', 'A soma dos itens difere do total da sessão.', 'counting_session', v_dossier.counting_session_id where v_dossier.counting_session_id is not null and exists (select 1 from public.apf_counting_sessions s where s.id = v_dossier.counting_session_id and abs(coalesce(s.total_pf_fs, 0) - coalesce((select sum(coalesce(i.corrected_pf_fs, i.pf_fs, 0)) from public.apf_counting_items i where i.session_id = s.id), 0)) > 0.01)
  )
  insert into public.apf_audit_findings(dossier_id, fingerprint, finding_type, severity, title, detail, entity_type, entity_id)
  select p_dossier_id, fingerprint, finding_type, severity, title, detail, entity_type, entity_id from findings
  on conflict (dossier_id, fingerprint) do update set finding_type = excluded.finding_type, severity = excluded.severity, title = excluded.title, detail = excluded.detail, status = 'open', resolution_note = null, reviewed_by = null, reviewed_at = null, detected_at = now();
  get diagnostics v_count = row_count; return v_count;
end $$;

create or replace function public.review_apf_audit_finding(p_finding_id uuid, p_status text, p_note text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_dossier_id uuid;
begin
  if p_status not in ('resolved', 'accepted_risk') or nullif(trim(p_note), '') is null then raise exception 'Decisão e justificativa são obrigatórias.' using errcode = '22023'; end if;
  select dossier_id into v_dossier_id from public.apf_audit_findings where id = p_finding_id;
  if not found or auth.uid() is null or not public.apf_can_access_dossier(v_dossier_id) then raise exception 'Achado não encontrado ou acesso negado.' using errcode = '42501'; end if;
  update public.apf_audit_findings set status = p_status, resolution_note = trim(p_note), reviewed_by = auth.uid(), reviewed_at = now() where id = p_finding_id;
  insert into public.apf_dossier_events(dossier_id, event_type, event_data) values (v_dossier_id, 'reviewed', jsonb_build_object('finding_id', p_finding_id, 'status', p_status, 'note', trim(p_note)));
end $$;
revoke all on function public.scan_apf_dossier_audit(uuid) from public;
revoke all on function public.review_apf_audit_finding(uuid, text, text) from public;
grant execute on function public.scan_apf_dossier_audit(uuid) to authenticated;
grant execute on function public.review_apf_audit_finding(uuid, text, text) to authenticated;
