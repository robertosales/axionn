begin;
insert into public.app_permissions(key,label,group_key)values
('apf.dossier.view','Visualizar dossiês APF','apf_dossier'),('apf.dossier.create','Criar dossiês APF','apf_dossier'),('apf.dossier.collect_evidence','Coletar evidências APF','apf_dossier'),('apf.dossier.review','Revisar dossiês APF','apf_dossier'),('apf.dossier.validate','Validar dossiês APF','apf_dossier'),('apf.dossier.homologate','Homologar dossiês APF','apf_dossier'),('apf.dossier.export','Exportar dossiês APF','apf_dossier'),('apf.dossier.manage_templates','Gerenciar templates APF','apf_dossier')on conflict(key)do nothing;
insert into public.role_permissions(role_name,permission_key)
select role_name,permission_key from(values
('admin','apf.dossier.view'),('admin','apf.dossier.create'),('admin','apf.dossier.collect_evidence'),('admin','apf.dossier.review'),('admin','apf.dossier.validate'),('admin','apf.dossier.homologate'),('admin','apf.dossier.export'),('admin','apf.dossier.manage_templates'),
('analyst','apf.dossier.view'),('analyst','apf.dossier.create'),('analyst','apf.dossier.collect_evidence'),('analyst','apf.dossier.review'),('analyst','apf.dossier.validate'),('analyst','apf.dossier.export'),
('architect','apf.dossier.view'),('architect','apf.dossier.create'),('architect','apf.dossier.collect_evidence'),('architect','apf.dossier.review'),('architect','apf.dossier.validate'),('architect','apf.dossier.export'),
('product_owner','apf.dossier.view'),('product_owner','apf.dossier.review'),('product_owner','apf.dossier.homologate'),('product_owner','apf.dossier.export'),
('member','apf.dossier.view'),('member','apf.dossier.export'))seed(role_name,permission_key)on conflict(role_name,permission_key)do nothing;

create or replace function public.has_apf_dossier_permission(p_organization_id uuid,p_permission text,p_user_id uuid default auth.uid())returns boolean language sql stable security definer set search_path=public,pg_temp as $$
 select p_user_id is not null and public.is_organization_member(p_organization_id,p_user_id)and(
  coalesce(public.is_platform_admin(p_user_id),false)or coalesce(public.is_organization_admin(p_organization_id,p_user_id),false)or exists(
   select 1 from public.user_roles ur join public.team_members tm on tm.user_id=ur.user_id join public.teams t on t.id=tm.team_id join public.role_permissions rp on rp.role_name=ur.role::text
   where ur.user_id=p_user_id and coalesce(t.org_id,public.resolve_team_org_id(t.id))=p_organization_id and rp.permission_key=p_permission)
 );
$$;
create or replace function public.apf_can_access_dossier(p_dossier_id uuid)returns boolean language sql stable security definer set search_path=public,pg_temp as $$select exists(select 1 from public.apf_evidence_dossiers d where d.id=p_dossier_id and public.has_apf_dossier_permission(d.organization_id,'apf.dossier.view',auth.uid()));$$;

create or replace function public.apf_assert_dossier_permission(p_dossier_id uuid,p_permission text)returns void language plpgsql stable security definer set search_path=public,pg_temp as $$declare oid uuid;begin select organization_id into oid from public.apf_evidence_dossiers where id=p_dossier_id;if oid is null or not public.has_apf_dossier_permission(oid,p_permission,auth.uid())then raise exception'Permissão APF insuficiente: %',p_permission using errcode='42501';end if;end $$;
create or replace function public.apf_enforce_record_permission()returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare did uuid;oid uuid;permission text;
begin
 if auth.role()='service_role'then if tg_op='DELETE'then return old;else return new;end if;end if;
 if tg_table_name='apf_evidence_dossiers'then oid:=coalesce(new.organization_id,old.organization_id);permission:=case when tg_op='INSERT'then'apf.dossier.create'when new.status='homologated'and old.status is distinct from new.status then'apf.dossier.homologate'when new.status='validated'and old.status is distinct from new.status then'apf.dossier.validate'else'apf.dossier.review'end;
 else did:=coalesce(new.dossier_id,old.dossier_id);select organization_id into oid from public.apf_evidence_dossiers where id=did;permission:=case when tg_table_name in('apf_evidence_sources','apf_evidence_catalog_entries','apf_external_evidence_imports')then'apf.dossier.collect_evidence'when tg_table_name='apf_dossier_versions'then'apf.dossier.validate'else'apf.dossier.review'end;end if;
 if not public.has_apf_dossier_permission(oid,permission,auth.uid())then raise exception'Permissão APF insuficiente: %',permission using errcode='42501';end if;if tg_op='DELETE'then return old;else return new;end if;
end $$;
do $$declare t text;begin foreach t in array array['apf_evidence_dossiers','apf_acceptance_criteria','apf_evidence_sources','apf_evidence_catalog_entries','apf_traceability_links','apf_audit_scenarios','apf_dossier_versions','apf_external_evidence_imports']loop execute format('drop trigger if exists apf_permission_guard on public.%I',t);execute format('create trigger apf_permission_guard before insert or update or delete on public.%I for each row execute function public.apf_enforce_record_permission()',t);end loop;end $$;
revoke all on function public.has_apf_dossier_permission(uuid,text,uuid)from public,anon;revoke all on function public.apf_assert_dossier_permission(uuid,text)from public,anon;grant execute on function public.has_apf_dossier_permission(uuid,text,uuid)to authenticated,service_role;grant execute on function public.apf_assert_dossier_permission(uuid,text)to authenticated,service_role;
commit;
