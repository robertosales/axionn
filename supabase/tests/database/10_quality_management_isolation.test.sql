\ir ../../migrations/20260719090000_quality_management_mvp.sql

begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(12);

select has_table('public','quality_test_cases','quality cases exists');
select has_table('public','quality_test_case_versions','quality versions exists');
select has_table('public','quality_test_runs','quality runs exists');
select has_table('public','quality_findings','quality findings exists');

select is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'quality_%' and c.relkind='r' and c.relrowsecurity),14,'RLS enabled on every quality table');

select ok(not has_table_privilege('anon','public.quality_test_cases','select'),'anon cannot read quality cases');
select ok(not has_table_privilege('authenticated','public.quality_test_cases','insert'),'authenticated cannot insert cases directly');
select ok(not has_table_privilege('authenticated','public.quality_test_case_versions','update'),'authenticated cannot mutate versions directly');
select ok(has_table_privilege('authenticated','public.quality_test_cases','select'),'authenticated has RLS-governed reads');
select ok(has_function_privilege('authenticated','public.create_quality_test_case_v1(uuid,jsonb,uuid)','execute'),'authenticated can call case RPC');
select ok(not has_function_privilege('anon','public.create_quality_test_case_v1(uuid,jsonb,uuid)','execute'),'anon cannot call case RPC');
select has_trigger('public','quality_test_case_versions','trg_quality_versions_immutable','version snapshots have an immutability trigger');

select * from finish();
rollback;
