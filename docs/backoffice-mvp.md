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

## Financeiro (lote concluido)

Frontend: `src/backoffice/pages/BOFinanceiro.tsx` com abas Faturas e Cobrancas APF,
paginacao, filtros de status/periodo, exportacao CSV com BOM (`src/lib/exportToCsv`),
maquina de estados de status com motivo obrigatorio para cancelamento/reembolso,
marcacao rapida de pagamento, edicao de detalhes (URL/observacoes) e dialogo de
vinculo das cobrancas APF as faturas.

Banco:

- `supabase/migrations/20260708210000_backoffice_operations.sql` — `billing_records` base
- `supabase/migrations/20260708220000_backoffice_billing_cycle.sql` — precificacao e geracao recorrente
- `supabase/migrations/20260821000000_financeiro_hardening.sql` — MRR/ARR por assinatura ativa,
  `mark_overdue_invoices()`, maquina de estados em `update_backoffice_billing_status(uuid,text,text)`
  e geracao mensal idempotente com `p_dry_run`
- `supabase/migrations/20260821010000_financeiro_invoice_details.sql` —
  `update_backoffice_billing_details(uuid,text,text)`
- `supabase/migrations/20260822000000_financeiro_status_concurrency.sql` —
  serializacao das transicoes de status e auditoria completa antes/depois
- `supabase/migrations/20260822010000_financeiro_integrity.sql` — constraints
  monetarias, geracao mensal concorrente idempotente e reconciliacao APF/fatura

Integracao APF: a leitura usa `apf_measurement_billing_requests` (RLS libera staff do
backoffice) e o vinculo usa `link_apf_billing_record` (migration
`20260818140000_apf_billing_bridge.sql`). Toda mutacao grava em `backoffice_audit_log`.

Contract test: `src/backoffice/backofficeFinanceiro.contract.test.ts`.

Qualidade e rollout: `src/backoffice/backofficeFinancialIntegrity.contract.test.ts`,
`src/backoffice/backofficeFinancialQuality.contract.test.ts`,
`supabase/tests/database/22_backoffice_financial_integrity.test.sql` e
`docs/financeiro-rollout-runbook.md`.

## Proximos lotes

- Clientes: detalhes de tenant, historico e links de suporte.
- Suporte: `support_tickets` e workflow.
- Analytics: MRR, ARR, churn e snapshots diarios.
