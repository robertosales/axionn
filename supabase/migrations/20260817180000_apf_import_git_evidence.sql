-- Importa atividade Git já sincronizada e vinculada à HU como evidência APF.
create or replace function public.get_hu_merge_requests(p_hu_id uuid)
returns setof public.git_merge_requests
language sql
security definer
set search_path = public, pg_temp
as $$
  select mr.*
    from public.git_merge_requests mr
   where public.is_organization_member(mr.organization_id, auth.uid())
     and exists (
       select 1 from public.hu_git_links link
        where link.hu_id = p_hu_id
          and link.organization_id = mr.organization_id
          and link.git_entity_type = 'merge_request'
          and link.integration_id = mr.integration_id
          and link.git_entity_id in (mr.id::text, mr.mr_iid::text)
     )
   order by mr.updated_at desc;
$$;

grant execute on function public.get_hu_merge_requests(uuid) to authenticated;

create or replace function public.import_apf_git_evidence(
  p_dossier_id uuid,
  p_merge_request_ids uuid[] default '{}',
  p_commit_shas text[] default '{}'
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dossier public.apf_evidence_dossiers%rowtype;
  v_mr record;
  v_commit record;
  v_source_id uuid;
  v_next integer;
  v_imported integer := 0;
begin
  if auth.uid() is null or not public.apf_can_access_dossier(p_dossier_id) then
    raise exception 'Dossiê não encontrado ou acesso negado.' using errcode = '42501';
  end if;

  select * into v_dossier from public.apf_evidence_dossiers where id = p_dossier_id for update;
  if v_dossier.status in ('homologated', 'superseded', 'cancelled') then
    raise exception 'O status atual não permite coletar evidências.' using errcode = '22023';
  end if;
  if v_dossier.user_story_id is null then
    raise exception 'O dossiê não possui história de usuário vinculada.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_dossier_id::text));
  select coalesce(max((regexp_match(stable_id, '^EV-CODE-([0-9]+)$'))[1]::integer), 0)
    into v_next from public.apf_evidence_catalog_entries where dossier_id = p_dossier_id;

  for v_mr in
    select mr.*, gi.repository_path
      from public.git_merge_requests mr
      join public.git_integrations gi on gi.id = mr.integration_id
     where mr.id = any(coalesce(p_merge_request_ids, '{}'))
       and mr.organization_id = v_dossier.organization_id
       and exists (
         select 1 from public.hu_git_links link
          where link.hu_id = v_dossier.user_story_id
            and link.organization_id = v_dossier.organization_id
            and link.git_entity_type = 'merge_request'
            and link.integration_id = mr.integration_id
            and link.git_entity_id in (mr.id::text, mr.mr_iid::text)
       )
       and not exists (
         select 1 from public.apf_evidence_sources evidence
          where evidence.dossier_id = p_dossier_id
            and evidence.source_type = 'merge_request'
            and evidence.metadata ->> 'git_entity_id' = mr.id::text
       )
  loop
    insert into public.apf_evidence_sources
      (dossier_id, source_type, category, repository, commit_sha, merge_request_ref, permanent_url, summary, content_hash, verification_status, metadata)
    values
      (p_dossier_id, 'merge_request', 'code', v_mr.repository_path, v_mr.merge_commit_sha,
       '!' || v_mr.mr_iid, v_mr.web_url, 'MR !' || v_mr.mr_iid || ' · ' || v_mr.title,
       coalesce(v_mr.merge_commit_sha, v_mr.source_sha), 'verified',
       jsonb_build_object('provider', 'gitlab', 'git_entity_id', v_mr.id, 'integration_id', v_mr.integration_id, 'state', v_mr.state))
    returning id into v_source_id;
    v_next := v_next + 1;
    insert into public.apf_evidence_catalog_entries
      (dossier_id, evidence_source_id, stable_id, display_title, display_summary, sort_order)
    values
      (p_dossier_id, v_source_id, 'EV-CODE-' || lpad(v_next::text, 2, '0'),
       'MR !' || v_mr.mr_iid || ' · ' || v_mr.title,
       v_mr.source_branch || ' → ' || v_mr.target_branch, v_next);
    v_imported := v_imported + 1;
  end loop;

  for v_commit in
    select gc.*, gi.repository_path
      from public.git_commits gc
      join public.git_integrations gi on gi.id = gc.integration_id
     where gc.commit_sha = any(coalesce(p_commit_shas, '{}'))
       and gc.organization_id = v_dossier.organization_id
       and exists (
         select 1 from public.hu_git_links link
          where link.hu_id = v_dossier.user_story_id
            and link.organization_id = v_dossier.organization_id
            and link.git_entity_type = 'commit'
            and link.integration_id = gc.integration_id
            and link.git_entity_id = gc.commit_sha
       )
       and not exists (
         select 1 from public.apf_evidence_sources evidence
          where evidence.dossier_id = p_dossier_id
            and evidence.source_type = 'commit'
            and evidence.commit_sha = gc.commit_sha
       )
  loop
    insert into public.apf_evidence_sources
      (dossier_id, source_type, category, repository, commit_sha, permanent_url, summary, content_hash, verification_status, metadata)
    values
      (p_dossier_id, 'commit', 'code', v_commit.repository_path, v_commit.commit_sha, v_commit.web_url,
       'Commit ' || substring(v_commit.commit_sha from 1 for 8) || ' · ' || split_part(v_commit.message, E'\n', 1),
       v_commit.commit_sha, 'verified',
       jsonb_build_object('provider', 'gitlab', 'git_entity_id', v_commit.commit_sha, 'integration_id', v_commit.integration_id))
    returning id into v_source_id;
    v_next := v_next + 1;
    insert into public.apf_evidence_catalog_entries
      (dossier_id, evidence_source_id, stable_id, display_title, display_summary, sort_order)
    values
      (p_dossier_id, v_source_id, 'EV-CODE-' || lpad(v_next::text, 2, '0'),
       'Commit ' || substring(v_commit.commit_sha from 1 for 8), split_part(v_commit.message, E'\n', 1), v_next);
    v_imported := v_imported + 1;
  end loop;

  if v_imported > 0 then
    update public.apf_evidence_dossiers
       set status = case when status = 'draft' then 'collecting_evidence' else status end,
           updated_at = now()
     where id = p_dossier_id;
    insert into public.apf_dossier_events (dossier_id, event_type, event_data)
    values (p_dossier_id, 'evidence_collected', jsonb_build_object('source', 'gitlab', 'imported_count', v_imported));
  end if;
  return v_imported;
end;
$$;

revoke all on function public.import_apf_git_evidence(uuid, uuid[], text[]) from public;
grant execute on function public.import_apf_git_evidence(uuid, uuid[], text[]) to authenticated;

comment on function public.import_apf_git_evidence(uuid, uuid[], text[]) is
  'Materializa MRs e commits Git vinculados à HU do dossiê, com proveniência, hash e catálogo estável.';
