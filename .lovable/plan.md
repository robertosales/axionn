
## Diagnóstico — Regressão de "Nova Atividade" no card

Antes (Sala Ágil), o card do Kanban (`src/components/KanbanCard.tsx`) tinha um item de menu de contexto **"Nova Atividade"** que abria o `QuickActivityDialog`. Essa funcionalidade foi removida no commit `f468f6a` ("perf: refactor KanbanCard..."), quando o componente foi reescrito. O `QuickActivityDialog` ainda existe (`src/components/QuickActivityDialog.tsx`) e está em uso apenas pelo `UserStoryManager`. Para a Sustentação, o `DemandaCard` (`src/features/sustentacao/components/DemandaCard.tsx`) também não oferece criação direta de atividade/hora pelo card; o `SustentacaoBoard` já passa um callback `onNovaAtividade` que apenas abre o detalhe na aba "horas".

## Diagnóstico — Colunas que não aparecem

- **Sala Ágil** (`src/contexts/SprintContext.tsx` → `KanbanBoard.tsx`): as colunas são lidas de `workflow_columns` por `team_id`, sem filtro de "ativo" — todas devem aparecer. O renderizador `KanbanBoard.tsx` mostra cada coluna como expandida ou recolhida (faixa vertical), nunca oculta. **Risco identificado**: `loadExpandedCols` lê do `sessionStorage` payload antigo; se houve troca da chave da coluna no fluxo (renomeou e gerou nova `key`), a coluna nova pode entrar e a antiga ser marcada como `__hidden__` e nunca aparecer.
- **Sustentação** (`useWorkflowSteps.ts` + `SustentacaoBoard.tsx`): as etapas só são carregadas com `ativo=true`. Após `replaceWorkflowSteps`, o mapeamento usa `LABEL_TO_KEY` + `slugify`, que pode gerar **colisão de `key`** entre etapas (ex.: "Em Execução" e "em execucao" → ambas `em_execucao`), causando colisão de `key` no React e ocultando uma delas. Além disso, o board renderiza colunas a partir de `visibleCols` — qualquer duplicidade de chave é silenciosamente perdida.

## O que será implementado

### 1. Restaurar "Nova Atividade" pelo card (Sala Ágil)
- `src/components/KanbanCard.tsx`:
  - Adicionar estado `quickActivityOpen` e o item `ContextMenuItem` "Nova Atividade" antes de "Avançar para".
  - Renderizar `<QuickActivityDialog huId={hu.id} open={quickActivityOpen} onClose={...} />` ao final.
  - Permissão: visível apenas para usuários que conseguem criar atividade — alinhado ao existente em `ActivityManager`/`UserStoryManager` (membro do time atual ou Admin). Usaremos o mesmo critério do `ActivityManager` (qualquer usuário autenticado com time atual; o backend valida via RLS).

### 2. Restaurar "Nova Atividade" pelo card (Sustentação)
- `src/features/sustentacao/components/DemandaCard.tsx`:
  - Adicionar item `ContextMenuItem` "Nova Atividade" que chama um novo prop `onNovaAtividade(demanda)`.
- `src/features/sustentacao/components/SustentacaoBoard.tsx`:
  - Propagar `onNovaAtividade` para o `DemandaCard` (já existe a callback que abre o detalhe na aba "horas").
- Validar permissão de criação de hora (já feita em `DemandaDetail` aba "Horas") — não há mudança de permissão: ao clicar, o detalhe abre na aba e o usuário usa o fluxo já validado.

### 3. Corrigir colunas faltantes no Kanban

**Sala Ágil** (`src/components/KanbanBoard.tsx`):
- Reescrever `loadExpandedCols` para nunca esconder colunas: tratar `__hidden__` como informação histórica que será descartada se a coluna ainda existir no fluxo atual. Garantir que `allKeys` sempre estejam em `expanded` ou explicitamente colapsadas (mas visíveis como faixa). Adicionar limpeza automática de chaves órfãs no `sessionStorage`.
- Caso defensivo: ao montar, se houver colunas em `allColKeys` ausentes do `expanded` e ausentes do `__hidden__`, força a inclusão (ok no código atual, mas vamos garantir explicitamente).

**Sustentação** (`src/features/sustentacao/hooks/useWorkflowSteps.ts`):
- Garantir unicidade de `key`: ao detectar colisão de slug, sufixar com índice (`em_execucao_2`, …) para que toda etapa cadastrada apareça no board.
- Não filtrar `ativo=true` no serviço para o board não precisar — manter o filtro, mas adicionar log de aviso quando o resultado vier vazio para diagnóstico.
- `SustentacaoBoard.tsx`: garantir que `visibleCols` seja deduplicada usando `Set` antes do render.

### 4. Validação / regressão
- Verificar que `KanbanPage` (rota alternativa em `src/features/kanban`) não regrediu: ela apenas exibe colunas via `columns.map`, sem persistência de expandidos — sem mudança necessária.
- Testar com perfis Admin, Admin de Contrato e Comum:
  - Criar nova atividade via card → confirma persistência + auto-move (`SprintContext.addActivity` já trata).
  - Trocar para um time/fluxo com várias colunas e verificar que **todas** aparecem.

## Arquivos a alterar

- `src/components/KanbanCard.tsx` — adicionar QuickActivityDialog + item no context menu.
- `src/features/sustentacao/components/DemandaCard.tsx` — adicionar prop e item "Nova Atividade".
- `src/features/sustentacao/components/SustentacaoBoard.tsx` — passar `onNovaAtividade` ao `DemandaCard`; dedupe de `visibleCols`.
- `src/components/KanbanBoard.tsx` — corrigir `loadExpandedCols`/`saveExpandedCols` para não ocultar colunas válidas.
- `src/features/sustentacao/hooks/useWorkflowSteps.ts` — dedupe de `key` no slug.

## Banco de dados

Sem migrações — todas as correções são de UI/cliente.
