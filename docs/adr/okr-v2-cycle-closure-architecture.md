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