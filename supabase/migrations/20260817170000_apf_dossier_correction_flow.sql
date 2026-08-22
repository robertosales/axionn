-- Corrections never mutate an homologated dossier. They create a successor.
create or replace function public.create_apf_dossier_successor(
  p_source_dossier_id uuid,
  p_dossier_code text,
  p_title text
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_source public.apf_evidence_dossiers%rowtype;
  v_new_dossier_id uuid;
  v_criterion record;
  v_evidence record;
  v_new_id uuid;
  v_criterion_map jsonb := '{}'::jsonb;
  v_evidence_map jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into v_source from public.apf_evidence_dossiers where id = p_source_dossier_id for update;
  if not found or not public.is_organization_member(v_source.organization_id, auth.uid()) then raise exception 'dossier_access_denied' using errcode = '42501'; end if;
  if v_source.status <> 'homologated' then raise exception 'only_homologated_dossier_can_be_corrected' using errcode = '55000'; end if;
  if nullif(trim(p_dossier_code), '') is null or nullif(trim(p_title), '') is null then raise exception 'successor_identity_required' using errcode = '22023'; end if;

  insert into public.apf_evidence_dossiers(organization_id, contract_id, project_id, sprint_id, user_story_id, counting_session_id, baseline_id, counting_model_id, previous_dossier_id, dossier_code, title, counting_type, status, contract_snapshot, baseline_snapshot, ruleset_snapshot, total_impacted_pf, created_by)
  values (v_source.organization_id, v_source.contract_id, v_source.project_id, v_source.sprint_id, v_source.user_story_id, v_source.counting_session_id, v_source.baseline_id, v_source.counting_model_id, v_source.id, trim(p_dossier_code), trim(p_title), v_source.counting_type, 'draft', v_source.contract_snapshot, v_source.baseline_snapshot, v_source.ruleset_snapshot, v_source.total_impacted_pf, auth.uid())
  returning id into v_new_dossier_id;

  for v_criterion in select * from public.apf_acceptance_criteria where dossier_id = v_source.id order by sort_order loop
    insert into public.apf_acceptance_criteria(dossier_id, stable_id, sort_order, original_text, source_type, source_ref, expected_behavior)
    values (v_new_dossier_id, v_criterion.stable_id, v_criterion.sort_order, v_criterion.original_text, v_criterion.source_type, v_criterion.source_ref, v_criterion.expected_behavior)
    returning id into v_new_id;
    v_criterion_map := v_criterion_map || jsonb_build_object(v_criterion.id::text, v_new_id::text);
  end loop;

  for v_evidence in select * from public.apf_evidence_sources where dossier_id = v_source.id order by collected_at loop
    insert into public.apf_evidence_sources(dossier_id, source_type, category, repository, commit_sha, merge_request_ref, file_path, symbol_ref, permanent_url, summary, content_hash, verification_status, collected_at, collected_by, metadata)
    values (v_new_dossier_id, v_evidence.source_type, v_evidence.category, v_evidence.repository, v_evidence.commit_sha, v_evidence.merge_request_ref, v_evidence.file_path, v_evidence.symbol_ref, v_evidence.permanent_url, v_evidence.summary, v_evidence.content_hash, 'unverified', now(), auth.uid(), v_evidence.metadata)
    returning id into v_new_id;
    v_evidence_map := v_evidence_map || jsonb_build_object(v_evidence.id::text, v_new_id::text);
  end loop;

  insert into public.apf_evidence_catalog_entries(dossier_id, evidence_source_id, stable_id, display_title, display_summary, sort_order)
  select v_new_dossier_id, (v_evidence_map ->> catalog.evidence_source_id::text)::uuid, catalog.stable_id, catalog.display_title, catalog.display_summary, catalog.sort_order
  from public.apf_evidence_catalog_entries catalog where catalog.dossier_id = v_source.id;

  insert into public.apf_traceability_links(dossier_id, acceptance_criterion_id, evidence_source_id, functional_result, apf_treatment, justification, suggested_by_ai)
  select v_new_dossier_id, (v_criterion_map ->> link.acceptance_criterion_id::text)::uuid, (v_evidence_map ->> link.evidence_source_id::text)::uuid, 'pending', link.apf_treatment, link.justification, false
  from public.apf_traceability_links link where link.dossier_id = v_source.id and link.counting_item_id is null;

  insert into public.apf_dossier_events(dossier_id, event_type, actor_id, event_data)
  values (v_new_dossier_id, 'created', auth.uid(), jsonb_build_object('correction_of', v_source.id, 'source_hash', (select content_hash from public.apf_dossier_versions where dossier_id = v_source.id order by version_number desc limit 1)));
  return v_new_dossier_id;
end;
$$;

revoke all on function public.create_apf_dossier_successor(uuid, text, text) from public, anon;
grant execute on function public.create_apf_dossier_successor(uuid, text, text) to authenticated, service_role;

create or replace function public.apf_supersede_previous_dossier_on_homologation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'homologated' and old.status is distinct from 'homologated' and new.previous_dossier_id is not null then
    update public.apf_evidence_dossiers set status = 'superseded' where id = new.previous_dossier_id and status = 'homologated';
    insert into public.apf_dossier_events(dossier_id, event_type, actor_id, event_data)
    values (new.previous_dossier_id, 'superseded', auth.uid(), jsonb_build_object('successor_dossier_id', new.id));
  end if;
  return new;
end;
$$;

create trigger apf_dossier_supersede_previous after update of status on public.apf_evidence_dossiers
for each row execute function public.apf_supersede_previous_dossier_on_homologation();
