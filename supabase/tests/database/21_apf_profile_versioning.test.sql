\ir ../../migrations/20260810130000_apf_profile_versioning_foundation.sql
\ir ../../migrations/20260810130100_apf_versioned_ruleset_catalogs.sql
\ir ../../migrations/20260810130200_apf_profile_version_lifecycle.sql
\ir ../../migrations/20260810130300_apf_profile_security_audit.sql

begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(15);

create or replace function pg_temp.authenticate_as(p_user_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
end;
$$;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at) values
 ('22a00000-0000-0000-0000-000000000001','authenticated','authenticated','apf-owner-a@test.local','',now(),now(),now()),
 ('22a00000-0000-0000-0000-000000000002','authenticated','authenticated','apf-member-b@test.local','',now(),now(),now())
on conflict (id) do nothing;
insert into public.organizations(id,name,slug,status,plan) values
 ('12a00000-0000-0000-0000-000000000001','APF Tenant A','apf-profile-a','active','pro'),
 ('12a00000-0000-0000-0000-000000000002','APF Tenant B','apf-profile-b','active','pro')
on conflict (id) do nothing;
insert into public.organization_members(org_id,user_id,role,is_active) values
 ('12a00000-0000-0000-0000-000000000001','22a00000-0000-0000-0000-000000000001','owner',true),
 ('12a00000-0000-0000-0000-000000000002','22a00000-0000-0000-0000-000000000002','member',true)
on conflict (org_id,user_id) do update set role=excluded.role,is_active=true;
insert into public.contracts(id,org_id,name,status) values
 ('42a00000-0000-0000-0000-000000000001','12a00000-0000-0000-0000-000000000001','APF Contract A','active'),
 ('42a00000-0000-0000-0000-000000000002','12a00000-0000-0000-0000-000000000002','APF Contract B','active')
on conflict (id) do nothing;

set local role authenticated;
select pg_temp.authenticate_as('22a00000-0000-0000-0000-000000000001');

insert into public.apf_profiles(id,contract_id,profile_code,name,is_default,created_by,updated_by)
values ('a3a00000-0000-0000-0000-000000000001','42a00000-0000-0000-0000-000000000001','default_apf','Default APF',true,'22a00000-0000-0000-0000-000000000001','22a00000-0000-0000-0000-000000000001');
insert into public.apf_profile_versions(id,profile_id,version_no,effective_from,created_by,updated_by)
values ('a4a00000-0000-0000-0000-000000000001','a3a00000-0000-0000-0000-000000000001',1,'2026-01-01','22a00000-0000-0000-0000-000000000001','22a00000-0000-0000-0000-000000000001');
insert into public.apf_profile_rulesets(profile_version_id,schema_version,algorithm_version,rounding_mode,decimal_scale,rounding_stage,created_by,updated_by)
values ('a4a00000-0000-0000-0000-000000000001','apf-ruleset-v1','legacy-equivalent-v1','half_up',2,'item','22a00000-0000-0000-0000-000000000001','22a00000-0000-0000-0000-000000000001');
insert into public.apf_profile_function_types(id,profile_version_id,code,name,function_class)
values ('a5a00000-0000-0000-0000-000000000001','a4a00000-0000-0000-0000-000000000001','TRN','Transacao','transactional');
insert into public.apf_profile_function_weights(profile_version_id,function_type_id,complexity,weight)
values ('a4a00000-0000-0000-0000-000000000001','a5a00000-0000-0000-0000-000000000001','Padrao',4.6);
insert into public.apf_profile_factors(profile_version_id,code,name,contribution_pct)
values ('a4a00000-0000-0000-0000-000000000001','A','Alteracao',60);

select lives_ok($sql$select public.transition_apf_profile_version('a4a00000-0000-0000-0000-000000000001',1,'in_review','ready')$sql$,'owner submits draft');
select lives_ok($sql$select public.transition_apf_profile_version('a4a00000-0000-0000-0000-000000000001',2,'approved','approved')$sql$,'owner approves version');
select lives_ok($sql$select public.publish_apf_profile_version('a4a00000-0000-0000-0000-000000000001',3,'publish')$sql$,'owner publishes complete version');
select is(length((select configuration_hash from public.apf_profile_versions where id='a4a00000-0000-0000-0000-000000000001')),64,'publication stores SHA-256');
select is((select canonicalization_version from public.apf_profile_versions where id='a4a00000-0000-0000-0000-000000000001'),'apf-c14n-v1','publication records canonicalization version');
reset role;
select is(
  public.apf_canonical_jsonb('{"z":null,"created_at":"2026-08-10T10:00:00-03:00","nested":{"beta":true,"alpha":"ação"},"a":1}'::jsonb),
  '{"a":1,"nested":{"alpha":"ação","beta":true},"z":null}',
  'PostgreSQL canonical JSON matches TypeScript vector 1'
);
select is(
  encode(public.digest(public.apf_canonical_jsonb('{"z":null,"created_at":"2026-08-10T10:00:00-03:00","nested":{"beta":true,"alpha":"ação"},"a":1}'::jsonb),'sha256'),'hex'),
  '0310097cc699d452e9cad452ec5919f9dc38cd2dae67d233f2c6878fafbba200',
  'PostgreSQL SHA-256 matches TypeScript vector 1'
);
select is(
  public.apf_canonical_jsonb('{"values":["ac\u0327a\u0303o","AÇÃO",null],"version":1}'::jsonb),
  '{"values":["ação","AÇÃO",null],"version":1}',
  'PostgreSQL canonical JSON matches TypeScript vector 2'
);
select is(
  encode(public.digest(public.apf_canonical_jsonb('{"values":["ac\u0327a\u0303o","AÇÃO",null],"version":1}'::jsonb),'sha256'),'hex'),
  '4e195783c6a29d6ce9a7cb70171a3a17aab144ccaaec435d0a6d3511020bed72',
  'PostgreSQL SHA-256 matches TypeScript vector 2'
);
select throws_ok(
  $sql$update public.apf_profile_factors set contribution_pct=70 where profile_version_id='a4a00000-0000-0000-0000-000000000001'$sql$,
  '55000','apf_published_version_configuration_immutable','published catalog is immutable'
);
select throws_ok(
  $sql$update public.apf_profile_versions set tr_reference='changed',updated_by='22a00000-0000-0000-0000-000000000001' where id='a4a00000-0000-0000-0000-000000000001'$sql$,
  '55000','apf_published_version_update_forbidden','published semantic fields are immutable'
);
select ok((select count(*) >= 7 from public.apf_profile_audit_events where profile_id='a3a00000-0000-0000-0000-000000000001'),'configuration and lifecycle are audited');
select is(public.apf_calculate_profile_version_hash('a4a00000-0000-0000-0000-000000000001'),(select configuration_hash from public.apf_profile_versions where id='a4a00000-0000-0000-0000-000000000001'),'hash is reproducible');

set local role authenticated;
select pg_temp.authenticate_as('22a00000-0000-0000-0000-000000000002');
select is((select count(*)::integer from public.apf_profiles where id='a3a00000-0000-0000-0000-000000000001'),0,'cross-tenant profile read is denied');
select ok(not has_function_privilege('anon','public.publish_apf_profile_version(uuid,bigint,text)','execute'),'anon cannot publish profile versions');

select * from finish();
rollback;
