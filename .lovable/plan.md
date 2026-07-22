# OKR — Fechamento de Ciclo (Plano de Execução Fasado)

Fonte-mestre: `docs/okr-plano-mestre.md` (2430 linhas).
Execução por PRs 0–10 conforme seção 19 do plano.
Cada PR = 1 iteração revisável/implantável. Só avanço para o próximo após o usuário validar.

## Status
- [x] PR 0 — Preflight & baseline (feature flag `okr_v2_enabled`, ADR, inventário)
- [x] PR 1 — Entitlements canônicos OKR (features, limites por plano, guard)
- [x] PR 2 — RBAC + esqueleto de RPCs (`has_okr_permission_v2`, guard, 6 RPCs stub)
- [ ] PR 3 — Tabela `okr_cycles` + lifecycle + UI de ciclos + backfill
- [ ] PR 4 — Objectives + alinhamento (`okr_objective_alignments`)
- [ ] PR 5 — KRs + motor canônico único (`compute_kr_progress`, `compute_objective_progress`)
- [ ] PR 6 — Check-in transacional (`record_okr_check_in_v2` + snapshots + auditoria)
- [ ] PR 7 — Métricas automáticas + fila (`okr_metric_definitions/bindings`, edge fn simplificada)
- [ ] PR 8 — Iniciativas + dependências + alertas
- [ ] PR 9 — Reviews (objective + cycle), encerramento, carry-forward
- [ ] PR 10 — Dashboards, exportação, observabilidade, E2E, hardening

## Princípios (seção 2 do plano)
- Autoridade no backend: mutações críticas só via RPC transacional.
- Preservação de histórico: nada de delete físico após publicação — só archive.
- Motor único de cálculo (canônico no Postgres).
- Ciclo como entidade de negócio com lifecycle próprio.
- Todas as RPCs `SECURITY DEFINER` com `SET search_path = public`, RLS ativo em todas as novas tabelas, `GRANT` explícito.

## Convenções técnicas
- Migrations idempotentes, uma por PR (agrupando as sub-migrations da seção 6 do plano quando pertinente).
- Novos tipos frontend em `src/features/okr/types.ts` — não quebrar `OkrObjective`/`OkrKeyResult` legados.
- Feature flag `VITE_OKR_V2_ENABLED` controlando UI nova enquanto o legado coexiste.
- Testes pgTAP em `supabase/tests/database/*_okr_*.test.sql` + vitest em `src/features/okr/**`.

## Fora de escopo desta série
- Mudanças em Sala Ágil/Sustentação que não sejam integrações listadas na seção 15.
- Rewrite do módulo OKR legado — coexiste até PR 10.