# Quality Intelligence — preflight do PR 1

## Referência

- Branch: `develop`.
- Maior migration local antes do PR: `20260718090000_commercial_usage_enforcement.sql`.
- Banco físico conferido em 2026-07-16: PostgreSQL 17.6, schema `public`.
- RLS confirmada em `organizations`, `organization_members`, `contracts`, `projects`, `projetos`, `teams`, `sprints`, `user_stories`, `releases`, `audit_log` e `audit_log_events`.

## Drift conhecido

A consulta de `supabase_migrations.schema_migrations` não retornou versões a partir de `20260716000000`. Isso não prova ausência física. Objetos devem ser conferidos pelo catálogo antes de qualquer execução e migrations não devem ser repetidas apenas porque faltam no histórico.

## Reutilização

- Membership: `is_organization_member`, `is_organization_admin` e `is_platform_admin`.
- Escopo: `resolve_contract_org_id`, `resolve_project_org_id` e `resolve_team_org_id`.
- Auditoria: `audit_log_events`.
- Timestamp: `update_updated_at_column`.
- Projeto canônico: `projects`.
- Releases: `releases`, com tenant derivado do time.

## Restrições operacionais

- Não usar Supabase CLI contra o Lovable Cloud de produção.
- Aplicar SQL somente pelo fluxo autorizado do Lovable.
- Não criar bucket durante este PR.
- Não habilitar `VITE_QUALITY_MANAGEMENT_ENABLED` antes das validações pós-aplicação.
