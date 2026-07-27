# OKR — Inventário de Migrations Existentes (baseline PR 0)

Snapshot dos objetos `okr_*` presentes no schema `public` antes do PR 1.
Usado como referência para migrations idempotentes dos PRs 1–10.

## Migrations aplicadas (histórico)

| Arquivo | Escopo |
| --- | --- |
| `20260609_okr_tables.sql` | Bootstrap das tabelas base. |
| `20260610240000_okr_tables.sql` | Refino inicial das tabelas base. |
| `20260710183612_*.sql` | Ajustes RLS/policies OKR (mix com outros módulos). |
| `20260716090000_okr_strategic_measurement_mvp.sql` | MVP de medição estratégica (snapshots, health calculada). |
| `20260716130000_okr_follow_up_governance.sql` | Governança/follow-up. |
| `20260718090000_okr_commercial_catalog_seed.sql` | Seed do catálogo comercial OKR. |
| `20260719090000_okr_entitlement_enforcement.sql` | Enforcement de entitlement. |

## Tabelas presentes (relevantes)

- `okr_objectives` (26 col.)
- `okr_key_results` (33 col.)
- `okr_check_ins` (14 col.)
- `okr_initiatives` (14 col.)
- `okr_key_result_snapshots` (20 col.)
- `okr_alerts` (11 col.)
- `okr_audit_log` (10 col.)
- `okr_recalculation_queue` (11 col.)

## Ausências (a criar pelos próximos PRs)

- `okr_cycles` — PR 3
- `okr_objective_alignments` — PR 4
- `okr_initiative_dependencies` — PR 8
- `okr_objective_reviews` — PR 9
- `okr_cycle_reviews` — PR 9
- `okr_carry_forward_links` — PR 9
- `okr_metric_definitions` / `okr_metric_versions` / `okr_metric_bindings` — PR 7

## RPCs canônicas a introduzir

Ver seção 8 do plano mestre. Nomes reservados (não colidem com atuais):
- Ciclos: `create_okr_cycle_v1`, `publish_okr_cycle_v1`, `start_okr_cycle_closing_v1`, `close_okr_cycle_v1`.
- Objectives: `create_okr_objective_v2`, `update_okr_objective_v2`, `publish_okr_objective_v2`, `archive_okr_objective_v2`, `reopen_okr_objective_v1`.
- KRs: `create_okr_key_result_v2`, `update_okr_key_result_v2`, `change_okr_key_result_target_v1`, `archive_okr_key_result_v2`.
- Check-in: `record_okr_check_in_v2`.
- Iniciativas: `create_okr_initiative_v1`, `update_okr_initiative_v1`, `archive_okr_initiative_v1`.
- Reviews/carry-forward: `submit_okr_objective_review_v1`, `approve_okr_objective_review_v1`, `carry_forward_okr_objective_v1`.
- Cálculo: `compute_kr_progress_v1`, `compute_objective_progress_v1`, `compute_health_v1`.

## Regras de idempotência

- Todas as migrations subsequentes usam `IF NOT EXISTS`, `CREATE OR REPLACE`,
  `DO $$ ... EXCEPTION WHEN duplicate_object`.
- Nenhum `DROP` de coluna existente antes do PR 10.
- Backfills executados em blocos `DO` com `WHERE ... IS NULL`.