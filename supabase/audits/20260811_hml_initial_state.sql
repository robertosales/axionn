-- Axionn HML APF Contrato/TR — verificação de estado inicial (SOMENTE LEITURA)
-- Executar no PROJETO DE HOMOLOGAÇÃO, antes de qualquer migration APF.
-- Não altera dados nem schema.

-- 1. Identidade e versão
select current_database() as db, version() as pg_version;

-- 2. Extensões instaladas
select extname, extversion from pg_extension order by extname;

-- 3. Disponibilidade de pgTAP no catálogo
select name, default_version, installed_version
from pg_available_extensions
where name = 'pgtap';

-- 4. Superfície do schema replicado
select
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r') as tabelas,
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='v') as views,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public') as funcoes,
  (select count(*) from pg_policies where schemaname='public') as policies,
  (select count(*) from pg_trigger where not tgisinternal) as triggers;

-- 5. Tabelas públicas sem RLS habilitada (deve retornar vazio)
select c.relname
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and not c.relrowsecurity
order by 1;

-- 6. Confirmação de que M1–M4 NÃO foram aplicadas (deve retornar vazio)
select version, name
from supabase_migrations.schema_migrations
where version in (
  '20260810130000','20260810130100','20260810130200','20260810130300'
)
order by version;

-- 7. Automações internas ativas (pg_cron) — deve estar vazio no ambiente isolado
select jobid, schedule, jobname, active
from cron.job
order by jobid;

-- 8. Ausência de dados de produção: volumetria das tabelas sensíveis
select relname, n_live_tup
from pg_stat_user_tables
where relname in (
  'profiles','organizations','contracts','demandas','user_stories',
  'meeting_connections','git_integrations','redmine_integrations',
  'oracle_integrations','apex_integrations','ai_providers'
)
order by relname;

-- 9. Credenciais eventualmente copiadas (esperado: zero em todas as linhas)
select 'ai_providers' as tabela, count(*) from public.ai_providers
union all select 'git_integrations', count(*) from public.git_integrations
union all select 'meeting_connections', count(*) from public.meeting_connections;
