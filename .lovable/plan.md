## Problema

**1. PATCH 400 ao mover a demanda 0003 (e similares)**

A tabela `public.demandas` tem um CHECK constraint que limita `situacao` a um conjunto fixo de valores:

```
fila_atendimento, planejamento_elaboracao, planejamento_ag_aprovacao,
planejamento_aprovada, em_execucao, bloqueada, hom_ag_homologacao,
hom_homologada, rejeitada, fila_producao, ag_aceite_final,
cancelada, fila_concluida
```

Porém o time configurou uma etapa customizada **"TESTE"** em `sustentacao_workflow_steps` (ordem 5). O hook `useWorkflowSteps` gera a chave `teste` por slug. Ao mover qualquer demanda para esse passo, o PATCH envia `situacao = "teste"`, que viola o CHECK e o Postgres retorna **400 Bad Request**. O mesmo acontece com qualquer etapa custom futura.

**2. Só permite avançar, não retroceder na tela de Detalhe**

Na `DemandaDetail.tsx`, o seletor "Mover para" usa `allowedNextStatuses`, que faz `dynamicFlow.slice(idx + 1)` — só mostra etapas posteriores. O Kanban (`SustentacaoBoard`/`SustentacaoPage`) já permite mover em qualquer direção (chama `moveTo` direto), por isso a divergência.

## Mudanças

### A. Migração SQL — remover CHECK rígido do `situacao`

```sql
ALTER TABLE public.demandas
  DROP CONSTRAINT IF EXISTS demandas_situacao_check;
```

Justificativa: o fluxo agora é dinâmico (configurável em Sustentação → Fluxo de Trabalho). A validação correta passa a ser feita pela UI a partir de `sustentacao_workflow_steps`. As situações terminais e bloqueios continuam sendo controlados em código (`TERMINAL_STATUSES`, regras de cancelamento/suspensão).

### B. `src/features/sustentacao/components/DemandaDetail.tsx`

Substituir `allowedNextStatuses` para liberar movimentação em qualquer sentido, espelhando o Kanban:

- Manter bloqueios atuais: terminal (`isTerminal`) → vazio; `bloqueada` → vazio; `rejeitada` → apenas `em_execucao` (regra de retorno controlada).
- Para demais casos: retornar **todas** as etapas de `dynamicFlow` exceto a situação atual, mantendo a ordem do fluxo. Continuar acrescentando `rejeitada` quando `situacao === 'hom_homologada'`.
- Nenhuma mudança em `getNextStatuses` legado (não está sendo consumida pelo seletor; é mantida para compatibilidade).

### C. Sem mudanças no service

`updateDemanda` já tem whitelist; após remover o CHECK, o PATCH com `situacao = "teste"` (ou qualquer key custom) passa a retornar 200.

## Validação

1. Como usuário comum, abrir a demanda **0003** e mover para "TESTE" → PATCH 200, transição registrada.
2. No detalhe, com situação `hom_homologada`, conferir que o seletor lista tanto etapas anteriores quanto `rejeitada`.
3. Mover uma demanda para trás (ex.: `em_execucao` → `planejamento_aprovada`) pelo seletor "Mover para".
4. Kanban continua funcionando para qualquer direção (sem regressão).

## Arquivos

- `supabase/migrations/<novo>.sql` (drop do CHECK)
- `src/features/sustentacao/components/DemandaDetail.tsx` (`allowedNextStatuses`)
