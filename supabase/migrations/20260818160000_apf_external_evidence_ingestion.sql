create table public.apf_external_evidence_imports(
 id uuid primary key default gen_random_uuid(),dossier_id uuid not null references public.apf_evidence_dossiers(id)on delete restrict,provider text not null check(provider in('github','jira','azure_devops','redmine')),external_ref text not null,artifact_kind text not null check(artifact_kind in('issue','pull_request','commit','file','build','test','work_item','link')),title text not null,permanent_url text,content_hash text not null,raw_metadata jsonb not null default'{}'::jsonb,evidence_source_id uuid not null references public.apf_evidence_sources(id)on delete restrict,imported_by uuid references auth.users(id)on delete set null default auth.uid(),imported_at timestamptz not null default now(),unique(dossier_id,provider,external_ref)
);
alter table public.apf_external_evidence_imports enable row level security;
revoke all on public.apf_external_evidence_imports from public,anon;grant select on public.apf_external_evidence_imports to authenticated;grant all on public.apf_external_evidence_imports to service_role;
create policy apf_external_imports_select on public.apf_external_evidence_imports for select to authenticated using(public.apf_can_access_dossier(dossier_id));

create or replace function public.import_apf_external_evidence(p_dossier_id uuid,p_provider text,p_artifacts jsonb)returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare artifact jsonb;eid uuid;v_ref text;v_title text;v_hash text;v_kind text;v_count integer:=0;v_stable text;
begin
 if p_provider not in('github','jira','azure_devops','redmine')then raise exception'Provedor externo inválido.'using errcode='22023';end if;
 if jsonb_typeof(p_artifacts)<>'array'or jsonb_array_length(p_artifacts)>200 then raise exception'Artefatos devem ser uma lista de até 200 itens.'using errcode='22023';end if;
 if auth.role()<>'service_role'and(auth.uid()is null or not public.apf_can_access_dossier(p_dossier_id))then raise exception'Acesso negado.'using errcode='42501';end if;
 if not exists(select 1 from public.apf_evidence_dossiers where id=p_dossier_id and status not in('homologated','superseded','cancelled'))then raise exception'Dossiê inexistente ou imutável.'using errcode='22023';end if;
 for artifact in select value from jsonb_array_elements(p_artifacts)loop
  v_ref:=nullif(trim(artifact->>'external_ref'),'');v_title:=nullif(trim(artifact->>'title'),'');v_kind:=coalesce(nullif(trim(artifact->>'artifact_kind'),''),'link');
  if v_ref is null or v_title is null or v_kind not in('issue','pull_request','commit','file','build','test','work_item','link')then raise exception'Artefato externo incompleto.'using errcode='22023';end if;
  if exists(select 1 from public.apf_external_evidence_imports where dossier_id=p_dossier_id and provider=p_provider and external_ref=v_ref)then continue;end if;
  v_hash:=coalesce(nullif(trim(artifact->>'content_hash'),''),encode(digest(artifact::text,'sha256'),'hex'));v_stable:='EV-'||upper(left(replace(p_provider,'_',''),5))||'-'||upper(left(encode(digest(v_ref,'sha256'),'hex'),8));
  insert into public.apf_evidence_sources(dossier_id,source_type,category,repository,commit_sha,file_path,permanent_url,summary,content_hash,verification_status,metadata)
  values(p_dossier_id,case when v_kind='pull_request'then'merge_request'when v_kind='commit'then'commit'when v_kind='file'then'file'when v_kind='test'then'test'else'link'end,case when v_kind='test'then'test'when v_kind in('issue','work_item')then'document'else'integration'end,artifact->>'repository',artifact->>'commit_sha',artifact->>'file_path',artifact->>'permanent_url',v_title,v_hash,'unverified',jsonb_build_object('provider',p_provider,'external_ref',v_ref,'artifact_kind',v_kind)||coalesce(artifact->'metadata','{}'::jsonb))returning id into eid;
  insert into public.apf_evidence_catalog_entries(dossier_id,evidence_source_id,stable_id,display_title,display_summary)values(p_dossier_id,eid,v_stable,v_title,artifact->>'summary');
  insert into public.apf_external_evidence_imports(dossier_id,provider,external_ref,artifact_kind,title,permanent_url,content_hash,raw_metadata,evidence_source_id)values(p_dossier_id,p_provider,v_ref,v_kind,v_title,artifact->>'permanent_url',v_hash,coalesce(artifact->'metadata','{}'::jsonb),eid);v_count:=v_count+1;
 end loop;
 if v_count>0 then insert into public.apf_dossier_events(dossier_id,event_type,event_data)values(p_dossier_id,'evidence_collected',jsonb_build_object('provider',p_provider,'imported_count',v_count));end if;return v_count;
end $$;
revoke all on function public.import_apf_external_evidence(uuid,text,jsonb)from public,anon;grant execute on function public.import_apf_external_evidence(uuid,text,jsonb)to authenticated,service_role;
