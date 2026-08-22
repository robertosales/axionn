begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(6);
create or replace function pg_temp.authenticate_as(p_user_id uuid)returns void language plpgsql as $$begin perform set_config('request.jwt.claim.sub',p_user_id::text,true);perform set_config('request.jwt.claim.role','authenticated',true);perform set_config('request.jwt.claims',jsonb_build_object('sub',p_user_id,'role','authenticated')::text,true);end $$;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)values
('21000000-0000-0000-0000-000000000001','authenticated','authenticated','apf-a@axion.test','',now(),now(),now()),
('21000000-0000-0000-0000-000000000002','authenticated','authenticated','apf-b@axion.test','',now(),now(),now())on conflict(id)do nothing;
insert into public.organizations(id,name,slug,status,plan)values
('11000000-0000-0000-0000-000000000001','APF Tenant A','apf-tenant-a','active','pro'),
('11000000-0000-0000-0000-000000000002','APF Tenant B','apf-tenant-b','active','pro')on conflict(id)do nothing;
insert into public.organization_members(org_id,user_id,role)values
('11000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','owner'),
('11000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000002','owner')on conflict do nothing;
insert into public.companies(id,name,status,org_id)values
('31000000-0000-0000-0000-000000000001','APF Company A','active','11000000-0000-0000-0000-000000000001'),
('31000000-0000-0000-0000-000000000002','APF Company B','active','11000000-0000-0000-0000-000000000002')on conflict(id)do nothing;
insert into public.contracts(id,name,status,company_id,org_id)values
('41000000-0000-0000-0000-000000000001','APF Contract A','active','31000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001'),
('41000000-0000-0000-0000-000000000002','APF Contract B','active','31000000-0000-0000-0000-000000000002','11000000-0000-0000-0000-000000000002')on conflict(id)do nothing;
insert into public.projects(id,name,module_type,status,contract_id,org_id)values
('61000000-0000-0000-0000-000000000001','APF Project A','agile','active','41000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001'),
('61000000-0000-0000-0000-000000000002','APF Project B','agile','active','41000000-0000-0000-0000-000000000002','11000000-0000-0000-0000-000000000002')on conflict(id)do nothing;
insert into public.apf_evidence_dossiers(id,organization_id,contract_id,project_id,dossier_code,title,counting_type,created_by)values
('71000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001','41000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','APF-A','Tenant A','impact','21000000-0000-0000-0000-000000000001'),
('71000000-0000-0000-0000-000000000002','11000000-0000-0000-0000-000000000002','41000000-0000-0000-0000-000000000002','61000000-0000-0000-0000-000000000002','APF-B','Tenant B','impact','21000000-0000-0000-0000-000000000002')on conflict(id)do nothing;
select pg_temp.authenticate_as('21000000-0000-0000-0000-000000000001');set local role authenticated;
select is(public.apf_can_access_dossier('71000000-0000-0000-0000-000000000001'),true,'tenant A can view its dossier');
select is(public.apf_can_access_dossier('71000000-0000-0000-0000-000000000002'),false,'tenant A cannot view tenant B dossier');
select results_eq($q$select dossier_code from public.apf_evidence_dossiers order by dossier_code$q$,$q$values('APF-A'::text)$q$,'RLS exposes only tenant A dossier');
select lives_ok($q$select public.authorize_apf_dossier_export('71000000-0000-0000-0000-000000000001')$q$,'tenant A can authorize its export');
select throws_ok($q$select public.authorize_apf_dossier_export('71000000-0000-0000-0000-000000000002')$q$,'42501','Permissão APF insuficiente: apf.dossier.export','cross-tenant export is denied');
select throws_ok($q$insert into public.apf_acceptance_criteria(dossier_id,stable_id,original_text)values('71000000-0000-0000-0000-000000000002','CA-X','forbidden')$q$,'42501',null,'cross-tenant direct write is denied');
reset role;select * from finish();rollback;
