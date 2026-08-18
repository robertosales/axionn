create or replace function public.import_apf_git_provider_evidence(p_dossier_id uuid,p_merge_request_ids uuid[],p_commit_shas text[])returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare imported integer;providers text[];
begin
 if auth.uid()is null or not public.apf_can_access_dossier(p_dossier_id)then raise exception'Acesso negado.'using errcode='42501';end if;
 if exists(select 1 from public.git_merge_requests mr join public.git_integrations gi on gi.id=mr.integration_id where mr.id=any(coalesce(p_merge_request_ids,'{}'))and gi.provider not in('gitlab','github','azure_devops'))or exists(select 1 from public.git_commits c join public.git_integrations gi on gi.id=c.integration_id where c.commit_sha=any(coalesce(p_commit_shas,'{}'))and gi.provider not in('gitlab','github','azure_devops'))then raise exception'Provedor Git não suportado neste fluxo.'using errcode='22023';end if;
 imported:=public.import_apf_git_evidence(p_dossier_id,p_merge_request_ids,p_commit_shas);
 update public.apf_evidence_sources e set metadata=jsonb_set(e.metadata,'{provider}',to_jsonb(gi.provider),true)
 from public.git_integrations gi where e.dossier_id=p_dossier_id and e.metadata->>'integration_id'=gi.id::text and gi.provider in('gitlab','github','azure_devops');
 select array_agg(distinct gi.provider order by gi.provider)into providers from public.apf_evidence_sources e join public.git_integrations gi on e.metadata->>'integration_id'=gi.id::text where e.dossier_id=p_dossier_id and gi.provider in('gitlab','github','azure_devops');
 if imported>0 then insert into public.apf_dossier_events(dossier_id,event_type,event_data)values(p_dossier_id,'evidence_collected',jsonb_build_object('source','git_providers','providers',coalesce(providers,'{}'),'imported_count',imported));end if;return imported;
end $$;
revoke all on function public.import_apf_git_provider_evidence(uuid,uuid[],text[])from public,anon;grant execute on function public.import_apf_git_provider_evidence(uuid,uuid[],text[])to authenticated;
