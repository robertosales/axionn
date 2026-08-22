create or replace function public.import_apf_functional_specification(p_dossier_id uuid,p_file_name text,p_content text,p_content_hash text,p_criteria jsonb)returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare eid uuid;next_doc integer;criterion jsonb;imported integer:=0;
begin
 perform public.apf_assert_dossier_permission(p_dossier_id,'apf.dossier.collect_evidence');perform public.apf_assert_dossier_permission(p_dossier_id,'apf.dossier.review');
 if nullif(trim(p_file_name),'')is null or nullif(trim(p_content),'')is null or nullif(trim(p_content_hash),'')is null then raise exception'Arquivo, conteúdo e hash são obrigatórios.'using errcode='22023';end if;
 if octet_length(p_content)>2097152 then raise exception'A especificação excede 2 MB de texto.'using errcode='22023';end if;
 if jsonb_typeof(p_criteria)<>'array'or jsonb_array_length(p_criteria)>200 then raise exception'Critérios inválidos ou acima do limite de 200.'using errcode='22023';end if;
 if exists(select 1 from public.apf_evidence_sources where dossier_id=p_dossier_id and content_hash=p_content_hash and metadata->>'functional_specification'='true')then return 0;end if;
 select coalesce(max((regexp_match(stable_id,'^EV-DOC-([0-9]+)$'))[1]::integer),0)+1 into next_doc from public.apf_evidence_catalog_entries where dossier_id=p_dossier_id;
 insert into public.apf_evidence_sources(dossier_id,source_type,category,summary,content_hash,verification_status,metadata)values(p_dossier_id,'attachment','document','Especificação funcional · '||trim(p_file_name),trim(p_content_hash),'unverified',jsonb_build_object('functional_specification',true,'file_name',trim(p_file_name),'original_text',p_content))returning id into eid;
 insert into public.apf_evidence_catalog_entries(dossier_id,evidence_source_id,stable_id,display_title,display_summary,sort_order)values(p_dossier_id,eid,'EV-DOC-'||lpad(next_doc::text,2,'0'),'Especificação funcional · '||trim(p_file_name),'Documento-fonte dos critérios de aceite.',next_doc);
 for criterion in select value from jsonb_array_elements(p_criteria)loop
  if nullif(trim(criterion->>'original_text'),'')is null then continue;end if;
  insert into public.apf_acceptance_criteria(dossier_id,stable_id,sort_order,original_text,source_type,source_ref,expected_behavior)
  values(p_dossier_id,coalesce(nullif(trim(criterion->>'stable_id'),''),'CA-'||lpad((imported+1)::text,2,'0')),coalesce((criterion->>'sort_order')::integer,imported),trim(criterion->>'original_text'),'file',eid::text,nullif(trim(criterion->>'expected_behavior'),''))on conflict(dossier_id,stable_id)do nothing;
  if found then imported:=imported+1;end if;
 end loop;
 update public.apf_evidence_dossiers set status=case when status='draft'then'collecting_evidence'else status end where id=p_dossier_id;
 insert into public.apf_dossier_events(dossier_id,event_type,event_data)values(p_dossier_id,'evidence_collected',jsonb_build_object('source','functional_specification','file_name',trim(p_file_name),'content_hash',trim(p_content_hash),'criteria_imported',imported));return imported;
end $$;
revoke all on function public.import_apf_functional_specification(uuid,text,text,text,jsonb)from public,anon;grant execute on function public.import_apf_functional_specification(uuid,text,text,text,jsonb)to authenticated;
