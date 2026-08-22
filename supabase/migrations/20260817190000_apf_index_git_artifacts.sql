-- Expande commits Git selecionados em evidências de arquivos técnicos.
create or replace function public.index_apf_git_artifacts(
  p_dossier_id uuid,
  p_commit_shas text[] default '{}'
) returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_dossier public.apf_evidence_dossiers%rowtype;
  v_artifact record;
  v_source_id uuid;
  v_prefix text;
  v_next integer;
  v_indexed integer := 0;
begin
  if auth.uid() is null or not public.apf_can_access_dossier(p_dossier_id) then
    raise exception 'Dossiê não encontrado ou acesso negado.' using errcode = '42501';
  end if;

  select * into v_dossier from public.apf_evidence_dossiers where id = p_dossier_id for update;
  if v_dossier.status in ('homologated', 'superseded', 'cancelled') then
    raise exception 'O status atual não permite indexar evidências.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_dossier_id::text));

  for v_artifact in
    select distinct on (gc.commit_sha, changed.path)
      gc.commit_sha,
      gc.web_url,
      gi.repository_path,
      changed.path,
      coalesce(changed.change_type, changed.status, 'modified') as change_type,
      coalesce((changed.additions)::integer, 0) as additions,
      coalesce((changed.deletions)::integer, 0) as deletions,
      case
        when changed.path ~* '(^|/)(__tests__|tests?|specs?)(/|\.)' or changed.path ~* '\.(test|spec)\.[^.]+$' then 'test'
        when changed.path ~* '(^|/)(migrations?|database|db)/' or changed.path ~* '\.sql$' then 'database'
        when changed.path ~* '(^|/)(api|routes?|controllers?|endpoints?)/' then 'api'
        when changed.path ~* '\.(tsx|jsx|vue|svelte|html|css|scss)$' then 'interface'
        else 'code'
      end as category
    from public.git_commits gc
    join public.git_integrations gi on gi.id = gc.integration_id
    cross join lateral jsonb_to_recordset(coalesce(gc.files_changed, '[]'::jsonb))
      as changed(path text, change_type text, status text, additions text, deletions text)
    where gc.commit_sha = any(coalesce(p_commit_shas, '{}'))
      and gc.organization_id = v_dossier.organization_id
      and changed.path is not null
      and changed.path <> ''
      and exists (
        select 1 from public.apf_evidence_sources parent
         where parent.dossier_id = p_dossier_id
           and parent.source_type = 'commit'
           and parent.commit_sha = gc.commit_sha
      )
      and not exists (
        select 1 from public.apf_evidence_sources evidence
         where evidence.dossier_id = p_dossier_id
           and evidence.commit_sha = gc.commit_sha
           and evidence.file_path = changed.path
      )
    order by gc.commit_sha, changed.path
  loop
    v_prefix := case v_artifact.category when 'api' then 'API' when 'database' then 'DB' when 'interface' then 'UI' when 'test' then 'TEST' else 'CODE' end;
    select coalesce(max((regexp_match(stable_id, '^EV-' || v_prefix || '-([0-9]+)$'))[1]::integer), 0) + 1
      into v_next from public.apf_evidence_catalog_entries where dossier_id = p_dossier_id;

    insert into public.apf_evidence_sources
      (dossier_id, source_type, category, repository, commit_sha, file_path, permanent_url, summary, content_hash, verification_status, metadata)
    values
      (p_dossier_id,
       case when v_artifact.category = 'api' then 'endpoint' when v_artifact.category = 'database' then 'database' when v_artifact.category = 'test' then 'test' else 'file' end,
       v_artifact.category, v_artifact.repository_path, v_artifact.commit_sha, v_artifact.path, v_artifact.web_url,
       v_artifact.path || ' · ' || v_artifact.change_type,
       v_artifact.commit_sha || ':' || v_artifact.path, 'verified',
       jsonb_build_object('provider', 'gitlab', 'change_type', v_artifact.change_type, 'additions', v_artifact.additions, 'deletions', v_artifact.deletions, 'parent_commit_sha', v_artifact.commit_sha))
    returning id into v_source_id;

    insert into public.apf_evidence_catalog_entries
      (dossier_id, evidence_source_id, stable_id, display_title, display_summary, sort_order)
    values
      (p_dossier_id, v_source_id, 'EV-' || v_prefix || '-' || lpad(v_next::text, 2, '0'),
       v_artifact.path, v_artifact.change_type || ' · +' || v_artifact.additions || ' -' || v_artifact.deletions, v_next);
    v_indexed := v_indexed + 1;
  end loop;

  if v_indexed > 0 then
    update public.apf_evidence_dossiers set updated_at = now() where id = p_dossier_id;
    insert into public.apf_dossier_events (dossier_id, event_type, event_data)
    values (p_dossier_id, 'evidence_collected', jsonb_build_object('source', 'gitlab_artifacts', 'indexed_count', v_indexed));
  end if;
  return v_indexed;
end;
$$;

revoke all on function public.index_apf_git_artifacts(uuid, text[]) from public;
grant execute on function public.index_apf_git_artifacts(uuid, text[]) to authenticated;

comment on function public.index_apf_git_artifacts(uuid, text[]) is
  'Indexa arquivos alterados de commits já materializados, classificando API, banco, interface, testes e código.';
