begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(15);

-- ============================================================
-- 1. Estrutura das tabelas
-- ============================================================
select has_table('public','okr_objectives','okr_objectives exists');
select has_table('public','okr_key_results','okr_key_results exists');
select has_table('public','okr_check_ins','okr_check_ins exists');
select has_table('public','okr_initiatives','okr_initiatives exists');
select has_table('public','okr_key_result_snapshots','okr_key_result_snapshots exists');
select has_table('public','okr_audit_log','okr_audit_log exists');

-- ============================================================
-- 2. RLS habilitado nas 6 tabelas OKR
-- ============================================================
select is(
  (select count(*)::int from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname like 'okr_%'
     and c.relkind = 'r'
     and c.relrowsecurity),
  6,
  'RLS enabled on all 6 OKR tables'
);

-- ============================================================
-- 3. Permissões de tabela
-- ============================================================
select ok(not has_table_privilege('anon','public.okr_objectives','select'),
  'anon cannot read okr_objectives');
select ok(not has_table_privilege('authenticated','public.okr_objectives','insert'),
  'authenticated cannot INSERT into okr_objectives directly (must use RPC)');
select ok(not has_table_privilege('authenticated','public.okr_key_results','update'),
  'authenticated cannot UPDATE okr_key_results directly');

-- ============================================================
-- 4. RPC executável
-- ============================================================
select ok(has_function_privilege('authenticated',
  'public.set_okr_health_override(uuid,text,text)','execute'),
  'authenticated can call set_okr_health_override');
select ok(not has_function_privilege('anon',
  'public.set_okr_health_override(uuid,text,text)','execute'),
  'anon cannot call set_okr_health_override');

-- ============================================================
-- 5. Triggers de entitlement existem
-- ============================================================
select has_trigger('public','okr_objectives',
  'trg_enforce_okr_objective_entitlement',
  'entitlement trigger exists on okr_objectives');
select has_trigger('public','okr_key_results',
  'trg_enforce_okr_key_result_entitlement',
  'entitlement trigger exists on okr_key_results');
select has_trigger('public','okr_check_ins',
  'trg_enforce_okr_check_in_entitlement',
  'entitlement trigger exists on okr_check_ins');
select has_trigger('public','okr_initiatives',
  'trg_enforce_okr_initiative_entitlement',
  'entitlement trigger exists on okr_initiatives');

-- ============================================================
-- 6. Trigger de audit existe
-- ============================================================
select has_trigger('public','okr_objectives',
  'trg_okr_objective_audit',
  'audit trigger exists on okr_objectives');

-- ============================================================
-- 7. Trigger de snapshots existe
-- ============================================================
select has_trigger('public','okr_check_ins',
  'trg_okr_check_in_snapshot',
  'snapshot trigger exists on okr_check_ins');

select * from finish();
rollback;
