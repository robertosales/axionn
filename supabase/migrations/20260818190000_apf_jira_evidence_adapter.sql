create table public.apf_jira_issue_links(id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id)on delete cascade,user_story_id uuid not null references public.user_stories(id)on delete cascade,external_ref text not null,title text not null,permanent_url text not null,status text,content_hash text not null,metadata jsonb not null default'{}'::jsonb,external_updated_at timestamptz,received_at timestamptz not null default now(),unique(organization_id,external_ref));
alter table public.apf_jira_issue_links enable row level security;revoke all on public.apf_jira_issue_links from public,anon,authenticated;grant select on public.apf_jira_issue_links to authenticated;grant all on public.apf_jira_issue_links to service_role;
create policy apf_jira_links_select on public.apf_jira_issue_links for select to authenticated using(public.is_organization_member(organization_id,auth.uid()));

create or replace function public.upsert_apf_jira_issue_link(p_organization_id uuid,p_user_story_id uuid,p_external_ref text,p_title text,p_permanent_url text,p_status text,p_content_hash text,p_metadata jsonb default'{}'::jsonb,p_external_updated_at timestamptz default null)returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare rid uuid;
begin
 if auth.role()<>'service_role'then raise exception'Somente o conector Jira pode registrar issues.'using errcode='42501';end if;
 if not exists(select 1 from public.user_stories u join public.teams t on t.id=u.team_id where u.id=p_user_story_id and t.org_id=p_organization_id)then raise exception'HU fora da organização.'using errcode='22023';end if;
 if nullif(trim(p_external_ref),'')is null or nullif(trim(p_title),'')is null or nullif(trim(p_permanent_url),'')is null or nullif(trim(p_content_hash),'')is null then raise exception'Dados Jira incompletos.'using errcode='22023';end if;
 insert into public.apf_jira_issue_links(organization_id,user_story_id,external_ref,title,permanent_url,status,content_hash,metadata,external_updated_at)values(p_organization_id,p_user_story_id,trim(p_external_ref),trim(p_title),trim(p_permanent_url),p_status,trim(p_content_hash),coalesce(p_metadata,'{}'),p_external_updated_at)
 on conflict(organization_id,external_ref)do update set user_story_id=excluded.user_story_id,title=excluded.title,permanent_url=excluded.permanent_url,status=excluded.status,content_hash=excluded.content_hash,metadata=excluded.metadata,external_updated_at=excluded.external_updated_at,received_at=now()returning id into rid;return rid;
end $$;

create or replace function public.import_apf_jira_evidence(p_dossier_id uuid)returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.apf_evidence_dossiers%rowtype;payload jsonb;
begin
 select*into d from public.apf_evidence_dossiers where id=p_dossier_id;if not found or auth.uid()is null or not public.apf_can_access_dossier(p_dossier_id)then raise exception'Acesso negado.'using errcode='42501';end if;if d.user_story_id is null then raise exception'O dossiê não possui história vinculada.'using errcode='22023';end if;
 select coalesce(jsonb_agg(jsonb_build_object('external_ref',j.external_ref,'artifact_kind','issue','title',j.external_ref||' · '||j.title,'permanent_url',j.permanent_url,'content_hash',j.content_hash,'metadata',j.metadata||jsonb_build_object('status',j.status,'external_updated_at',j.external_updated_at))order by j.external_ref),'[]'::jsonb)into payload from public.apf_jira_issue_links j where j.organization_id=d.organization_id and j.user_story_id=d.user_story_id;
 return public.import_apf_external_evidence(p_dossier_id,'jira',payload);
end $$;
revoke all on function public.upsert_apf_jira_issue_link(uuid,uuid,text,text,text,text,text,jsonb,timestamptz)from public,anon,authenticated;revoke all on function public.import_apf_jira_evidence(uuid)from public,anon;
grant execute on function public.upsert_apf_jira_issue_link(uuid,uuid,text,text,text,text,text,jsonb,timestamptz)to service_role;grant execute on function public.import_apf_jira_evidence(uuid)to authenticated;
