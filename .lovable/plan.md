## Problema

O **Kanban da Sustentação** e o campo **"Mover para"** no detalhe da demanda usam uma lista **estática** de etapas (`ALL_SITUACOES` / `FLOW_PRINCIPAL` no código), ignorando o que o usuário configurou em **Sustentação → Fluxo de Trabalho** (tabela `sustentacao_workflow_steps`).

Por isso a etapa **"TESTE"** (e qualquer outra customizada) aparece no editor de fluxo mas **não aparece** no Kanban nem no seletor "Mover para" da demanda.

## Causa raiz

1. `src/features/sustentacao/hooks/useWorkflowSteps.ts` retorna `ALL_SITUACOES` direto do código — nunca consulta o banco.
2. `SustentacaoPage` monta `workflowColumns` a partir desse hook estático e passa para o `SustentacaoBoard` → Kanban só vê as etapas hard-coded.
3. `DemandaDetail.tsx` calcula `getNextStatuses()` a partir do array constante `FLOW_PRINCIPAL` → "Mover para" só lista etapas hard-coded.

## Solução (somente frontend)

### 1. `useWorkflowSteps` passa a ler do banco

Transformar o hook em uma `useQuery` com `queryKey: ['workflow-steps']` (mesma key já invalidada pelo `SustentacaoWorkflow` após salvar) usando `fetchActiveWorkflowSteps()`:

- Retorna `{ steps: WorkflowStep[], loading }` onde cada step traz `key` (slug), `label`, `order`, `hex` e `isTerminal` (derivado por convenção: nomes `cancelad*`, `rejeitad*`, `aceite_final` ou marcador "terminal").
- **Fallback**: se a tabela estiver vazia, mantém `ALL_SITUACOES` como hoje (para não quebrar instalações novas).
- `useWorkflowStep(situacao)` continua funcionando em cima da nova fonte.

### 2. `SustentacaoPage` passa cor real

`workflowColumns` passa a usar `color: s.hex` (já existe campo `hex` no DB). Sem mudanças de assinatura no `SustentacaoBoard` — ele já aceita `color` opcional por coluna.

### 3. `DemandaDetail` — "Mover para" espelha o fluxo do banco

- Substituir o uso do array constante `FLOW_PRINCIPAL` por um array derivado de `useWorkflowSteps()` (ordenado por `order`, filtrando terminais).
- Reescrever `getNextStatuses(situacao)` para:
  - Localizar o índice da `situacao` atual nesse array dinâmico.
  - Retornar os próximos itens (`slice(idx + 1)`), excluindo a própria atual e etapas terminais quando aplicável.
  - Manter as exceções especiais existentes: `bloqueada` → vazio, `rejeitada` → permite voltar para a etapa de execução, `hom_homologada` → permite "rejeitada".
- Se a demanda estiver em uma situação **fora** do fluxo configurado (ex.: status legado), exibir todas as etapas não-terminais como destino possível, evitando que a demanda fique "presa".

### 4. Sem mudanças em

- Schema do banco, RLS, edge functions.
- Trigger `validate_demanda_transition` (já permite transições quando um dos status não está no fluxo principal hard-coded — passa a se comportar bem com etapas customizadas).
- `SustentacaoBoard.tsx` — apenas recebe colunas diferentes (já é dinâmico via prop `workflowColumns`).

## Arquivos alterados

- `src/features/sustentacao/hooks/useWorkflowSteps.ts` — passa a buscar do banco com `useQuery`.
- `src/features/sustentacao/SustentacaoPage.tsx` — passa `color` real e respeita `loading`.
- `src/features/sustentacao/components/DemandaDetail.tsx` — `getNextStatuses` e o seletor "Mover para" passam a usar o fluxo dinâmico.

## Resultado esperado

- Adicionar a etapa "TESTE" em Fluxo de Trabalho → ela aparece como coluna no Kanban e como opção em "Mover para" em todas as demandas, com a cor configurada.
- Reordenar/renomear/excluir etapas no Fluxo reflete imediatamente nos dois lugares (a invalidação de `['workflow-steps']` já existe após salvar).
