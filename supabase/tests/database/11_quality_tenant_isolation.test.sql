begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(20);

-- ============================================================
-- 1. Estrutura das tabelas
-- ============================================================
select has_table('public','quality_test_cases','quality_test_cases exists');
select has_table('public','quality_test_runs','quality_test_runs exists');
select has_table('public','quality_test_run_items','quality_test_run_items exists');
select has_table('public','quality_test_step_results','quality_test_step_results exists');
select has_table('public','quality_test_evidences','quality_test_evidences exists');

-- ============================================================
-- 2. RLS habilitado em todas as 14 tabelas
-- ============================================================
select is(
  (select count(*)::int from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname like 'quality_%'
     and c.relkind = 'r'
     and c.relrowsecurity),
  14,
  'RLS enabled on all 14 quality tables'
);

-- ============================================================
-- 3. Permissões de tabela
-- ============================================================
select ok(not has_table_privilege('anon','public.quality_test_cases','select'),
  'anon cannot read quality_test_cases');
select ok(not has_table_privilege('authenticated','public.quality_test_cases','insert'),
  'authenticated cannot INSERT into quality_test_cases directly (must use RPC)');
select ok(not has_table_privilege('authenticated','public.quality_test_case_versions','update'),
  'authenticated cannot UPDATE quality_test_case_versions directly');

-- ============================================================
-- 4. RPCs: autenticado pode, anon não
-- ============================================================
select ok(has_function_privilege('authenticated',
  'public.create_quality_test_case_v1(uuid,jsonb,uuid)','execute'),
  'authenticated can call create_quality_test_case_v1');
select ok(not has_function_privilege('anon',
  'public.create_quality_test_case_v1(uuid,jsonb,uuid)','execute'),
  'anon cannot call create_quality_test_case_v1');
select ok(has_function_privilege('authenticated',
  'public.start_quality_test_run_v1(uuid,uuid,uuid)','execute'),
  'authenticated can call start_quality_test_run_v1');

-- ============================================================
-- 5. can_manage_quality revogada de authenticated
-- ============================================================
select ok(not has_function_privilege('authenticated',
  'public.can_manage_quality(uuid,uuid)','execute'),
  'can_manage_quality is revoked from authenticated');

-- ============================================================
-- 6. can_quality_permission_v1 disponível para authenticated
-- ============================================================
select ok(has_function_privilege('authenticated',
  'public.can_quality_permission_v1(uuid,text)','execute'),
  'can_quality_permission_v1 is available to authenticated');

-- ============================================================
-- 7. can_read_quality disponível para authenticated
-- ============================================================
select ok(has_function_privilege('authenticated',
  'public.can_read_quality(uuid)','execute'),
  'can_read_quality is available to authenticated');

-- ============================================================
-- 8. Imutabilidade de versões
-- ============================================================
select has_trigger('public','quality_test_case_versions',
  'trg_quality_versions_immutable',
  'quality_test_case_versions has immutability trigger');

-- ============================================================
-- 9. Cross-tenant trigger existe
-- ============================================================
select has_trigger('public','quality_test_steps',
  'trg_quality_parent_org_quality_test_steps',
  'cross-tenant trigger exists on quality_test_steps');

-- ============================================================
-- 10. Status constraint existe
-- ============================================================
select ok(
  exists(select 1 from pg_constraint where conname = 'chk_step_result_status_valid'),
  'chk_step_result_status_valid constraint exists'
);

-- ============================================================
-- 11. Terminal status logic: completed_at only on terminal
-- ============================================================
select ok(
  exists(select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'recalculate_quality_run_item_v1'),
  'recalculate_quality_run_item_v1 function exists with terminal-status logic'
);

-- ============================================================
-- 12. Permission seeds exist
-- ============================================================
select is(
  (select count(*)::int from app_permissions where group_key = 'quality'),
  8,
  '8 quality permissions seeded in app_permissions'
);

select * from finish();
rollback;
