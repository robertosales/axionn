-- Axion SaaS — Fase 1.4
-- Entrada legada mantida para execução manual via psql.
-- A suíte canônica está dividida em supabase/tests/database/*.test.sql.
--
-- Uso:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/tests/tenant_isolation.sql

\set ON_ERROR_STOP on
\ir database/01_tenancy_contract.test.sql
\ir database/02_tenancy_isolation.test.sql
