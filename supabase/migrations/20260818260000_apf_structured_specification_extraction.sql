begin;
create or replace function public.import_apf_functional_specification_v2(p_dossier_id uuid,p_file_name text,p_content text,p_content_hash text,p_criteria jsonb,p_extraction jsonb)returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare imported integer;
begin
 if jsonb_typeof(p_extraction)<>'object'then raise exception'Extração funcional inválida.'using errcode='22023';end if;
 imported:=public.import_apf_functional_specification(p_dossier_id,p_file_name,p_content,p_content_hash,p_criteria);
 update public.apf_evidence_sources set metadata=metadata||jsonb_build_object('structured_extraction',p_extraction-'criteria')where dossier_id=p_dossier_id and content_hash=p_content_hash and metadata->>'functional_specification'='true';
 insert into public.apf_dossier_events(dossier_id,event_type,event_data)values(p_dossier_id,'reviewed',jsonb_build_object('scope','functional_specification_extraction','content_hash',p_content_hash,'fields',(select jsonb_agg(key)from jsonb_object_keys(p_extraction-'criteria')as key)));
 return imported;
end $$;
revoke all on function public.import_apf_functional_specification_v2(uuid,text,text,text,jsonb,jsonb)from public,anon;
grant execute on function public.import_apf_functional_specification_v2(uuid,text,text,text,jsonb,jsonb)to authenticated;
commit;
