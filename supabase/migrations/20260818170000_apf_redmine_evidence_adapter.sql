create or replace function public.import_apf_redmine_evidence(p_dossier_id uuid)returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.apf_evidence_dossiers%rowtype;payload jsonb;
begin
 select*into d from public.apf_evidence_dossiers where id=p_dossier_id;
 if not found or auth.uid()is null or not public.apf_can_access_dossier(p_dossier_id)then raise exception'Acesso negado.'using errcode='42501';end if;
 if d.user_story_id is null then raise exception'O dossiê não possui história vinculada.'using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('external_ref',i.id::text||':'||l.redmine_issue_id::text,'artifact_kind','issue','title','Redmine #'||l.redmine_issue_id,'permanent_url',rtrim(i.base_url,'/')||'/issues/'||l.redmine_issue_id,'content_hash',encode(digest(concat_ws('|',i.id,l.redmine_issue_id,l.last_redmine_updated_on,l.sync_status),'sha256'),'hex'),'metadata',jsonb_build_object('integration_id',i.id,'project_id',l.redmine_project_id,'tracker_id',l.redmine_tracker_id,'status_id',l.redmine_status_id,'priority_id',l.redmine_priority_id,'sync_status',l.sync_status,'last_synced_at',l.last_synced_at))order by l.redmine_issue_id),'[]'::jsonb)into payload
 from public.redmine_issue_links l join public.redmine_integrations i on i.id=l.integration_id and i.organization_id=d.organization_id and i.is_active
 where l.organization_id=d.organization_id and l.axionn_entity_type='user_story'and l.axionn_entity_id=d.user_story_id;
 return public.import_apf_external_evidence(p_dossier_id,'redmine',payload);
end $$;
revoke all on function public.import_apf_redmine_evidence(uuid)from public,anon;grant execute on function public.import_apf_redmine_evidence(uuid)to authenticated;
