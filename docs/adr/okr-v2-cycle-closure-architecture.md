# ADR: OKR v2 — Arquitetura de Fechamento de Ciclo

**Status:** Aceito
**Data:** 2026-07-20
**Fonte-mestre:** `docs/okr-plano-mestre.md`
**Feature flag:** `VITE_OKR_V2_ENABLED` (`OKR_V2_ENABLED` em `src/lib/featureFlags.ts`)

## Contexto

O módulo OKR atual suporta CRUD de Objectives/KRs e check-ins manuais, porém
não modela o **ciclo** como entidade formal, permite mutações diretas do
frontend, tem fórmulas de progresso duplicadas (component/hook/service/edge),
e não possui reviews, carry-forward, snapshots imutáveis nem alertas.

O PR mestre `docs/okr-plano-mestre.md` (2430 linhas) descreve a arquitetura-alvo
em 10 PRs incrementais (PR 0 → PR 10). Este ADR consolida as decisões
arquiteturais irreversíveis que sustentam essa sequência.

## Decisões

1. **Autoridade no backend.** Toda mutação de OKR (criar, publicar, editar
   estruturalmente, check-in, mudança de meta/peso, concluir, cancelar,
   arquivar, carry-forward, fechar ciclo) atravessa RPC transacional
   `SECURITY DEFINER` com `SET search_path = public`. O frontend não escreve
   direto em nenhuma tabela `okr_*` a partir do PR 2.

2. **Preservação de histórico.** Após publicação, entidades OKR não podem ser
   deletadas fisicamente pela aplicação — apenas arquivadas
   (`lifecycle_status = 'archived'`). Check-ins, snapshots e auditoria são
   append-only.

3. **Motor único de cálculo.** Progresso e saúde são calculados por funções
   canônicas em Postgres (`compute_kr_progress_v1`,
   `compute_objective_progress_v1`, `compute_health_v1`). Nenhuma fórmula
   concorrente em React, hooks, services ou triggers legados.

4. **Ciclo como entidade.** Nova tabela `okr_cycles` com lifecycle próprio
   (`draft → planning → active → closing → closed → archived`). Objectives
   passam a referenciar `cycle_id`; o campo texto `cycle` permanece para
   compatibilidade e é preenchido por trigger.

5. **Snapshots imutáveis.** `okr_key_result_snapshots` é a fonte para
   tendências e retros. Um snapshot nunca é `UPDATE`d nem `DELETE`d pela
   aplicação.

6. **Segurança em camadas.** RLS ativo em toda tabela `okr_*`, `GRANT`
   explícito por role, permissões OKR-específicas
   (`okr_admin/sponsor/objective_owner/kr_owner/contributor/viewer`) e
   verificação de entitlement no início de cada RPC.

7. **Coexistência controlada.** A UI legada continua ativa; a UI nova é
   entregue atrás da flag `VITE_OKR_V2_ENABLED`. Nenhuma coluna legada é
   removida antes do PR 10.

8. **Automação por fila.** Métricas automáticas passam por
   `okr_recalculation_queue` com claim atômico, retry exponencial e
   dead-letter. A edge function `okr-recalculation` deixa de calcular
   diretamente e passa a orquestrar a fila.

## Sequência de PRs

Ver `.lovable/plan.md` e seção 19 do plano mestre.

## Consequências

- Curva de esforço concentrada em PRs 3, 5, 6, 7 e 9.
- Ganho de auditabilidade, multi-tenant isolation e previsibilidade de
  cobrança por entitlement.
- Migração de dados existentes por backfill idempotente (PR 3 e PR 4).
- Duplicidade temporária de fórmulas até que o motor canônico (PR 5) esteja
  em produção e o legado seja removido no PR 10.

## Estado de estabilização — 2026-07-25

- As rotas V2 exigem `VITE_OKR_V2_ENABLED` e entitlement explícito.
- Falha, indisponibilidade ou carregamento do resolvedor não libera a UI V2.
- Hooks de ciclos, Objectives e KRs V2 mantêm mutações exclusivamente em RPCs.
- O fluxo legado ainda contém mutações e exclusões diretas; permanece dívida
  controlada e não deve ser reutilizado por código V2.
- A migration aditiva
  `20260725160000_okr_v2_objective_rpc_grants_hardening.sql` corrige o grant
  implícito de `PUBLIC` nas RPCs `create/update/archive_okr_objective_v2`.
- A migration de grants foi aplicada no ambiente remoto em 2026-07-25. A
  operação somente leitura
  `20260725_02_okr_v2_objective_rpc_grants_validation.sql` é o gate de
  comprovação antes do smoke funcional por papel e tenant.
- O fechamento de ciclo é serializado por lock de linha e por transição
  condicional na migration
  `20260725170000_okr_v2_cycle_closure_concurrency_hardening.sql`. Chamadas
  concorrentes deixam de validar estado obsoleto; o perdedor recebe SQLSTATE
  `40001` e não gera auditoria duplicada.
- O hardening de concorrência foi aplicado no ambiente remoto em 2026-07-25.
  Sua definição instalada deve ser comprovada pela operação somente leitura
  `20260725_03_okr_v2_cycle_closure_concurrency_validation.sql`.
- O check-in manual deixa de executar múltiplas escritas no cliente. A
  migration `20260725180000_okr_v2_atomic_check_in.sql` implementa
  `record_okr_check_in_v2` como boundary atômica para check-in, KR, snapshot,
  recálculo do Objective e auditoria.
- A boundary atômica foi aplicada no ambiente remoto em 2026-07-25. A
  operação `20260725_04_okr_v2_atomic_check_in_validation.sql` comprova a
  definição instalada antes do canário funcional com um KR controlado.
- O fluxo legado não executa mais deleção física de Objectives, KRs ou seus
  check-ins. As ações de remoção foram redirecionadas para
  `archive_okr_objective_v2` e `archive_okr_key_result_v2`, preservando
  histórico e auditoria.
- O PR 7 foi implementado localmente pela migration
  `20260726100000_okr_v2_automatic_metrics_queue.sql`: catálogo versionado,
  bindings tenant-scoped, claim com `FOR UPDATE SKIP LOCKED`, leases, retry
  progressivo, dead-letter e aplicação idempotente via
  `apply_okr_measurement_v2`. A Edge Function passou a coletar e orquestrar
  RPCs, sem atualizar diretamente KRs ou a fila.
- A conclusão remota do PR 7 depende da aplicação da migration, deploy da Edge
  Function e aprovação de
  `20260726_01_okr_v2_automatic_metrics_validation.sql`.
