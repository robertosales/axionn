# Backoffice Axionn - MVP implementado

## Escopo

Este lote cria a fundacao segura do Backoffice interno da Roberto Sales LTDA.

Rotas:

- `/backoffice`
- `/backoffice/clientes`
- `/backoffice/financeiro`
- `/backoffice/equipe`
- `/backoffice/suporte`
- `/backoffice/analitico`
- `/backoffice/configuracoes`

## Banco

Migration:

- `supabase/migrations/20260708143000_backoffice_foundation.sql`

Objetos principais:

- `owner_staff_members`
- `backoffice_audit_log`
- `get_my_backoffice_staff_profile()`
- `list_backoffice_staff_members()`
- `upsert_backoffice_staff_member(...)`
- `deactivate_backoffice_staff_member(uuid)`
- `get_backoffice_dashboard_summary()`

O bootstrap inclui Roberto como staff `admin` quando o usuario Auth
`3c472f37-eabb-4a95-a859-1a1cf89f5d37` existir no ambiente.

## Frontend

Estrutura:

- `src/backoffice/guards/BackofficeGuard.tsx`
- `src/backoffice/hooks/useBackofficeAuth.ts`
- `src/backoffice/components/BackofficeLayout.tsx`
- `src/backoffice/pages/BODashboard.tsx`
- `src/backoffice/pages/BOEquipe.tsx`

O Backoffice usa `AuthenticatedRoute`, sem `OrganizationOperationalGuard`, para
nao depender da organizacao ativa do cliente.

## Proximos lotes

- Clientes: detalhes de tenant, historico e links de suporte.
- Financeiro: `billing_records`, faturas e exportacao.
- Suporte: `support_tickets` e workflow.
- Analytics: MRR, ARR, churn e snapshots diarios.
