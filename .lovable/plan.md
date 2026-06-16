## Causa

O combo "Responsável" ficou vazio porque o `SprintContext` mapeia os `developers` sem incluir o campo `user_id` (linha 248 de `src/contexts/SprintContext.tsx`). O hook `useTeamAssignees` filtra por `d.user_id ∈ team_members(team_id)`, então com `user_id` sempre `undefined` nenhuma opção passa pelo filtro.

Confirmado no banco: o time tem 11 membros em `team_members` e 12 devs com `user_id` preenchido — os dados existem, falta apenas propagá-los ao front.

## Correção

1. **`src/types/sprint.ts`** — adicionar `user_id?: string | null` à interface `Developer`.
2. **`src/contexts/SprintContext.tsx`** (linha 248) — incluir `user_id: d.user_id` no mapeamento de `developers`. Fazer o mesmo em qualquer outro `setDevelopers` (ex.: handler de realtime), se existir.

Nenhuma outra mudança: o hook `useTeamAssignees`, `HUEditDrawer` e `UserStoryManager` já estão corretos e voltarão a listar os 11 membros ativos em ordem alfabética assim que `user_id` chegar nos objetos.

## Validação

Reabrir "Editar User Story" em `[nexo]-Time A - B` — devem aparecer os 11 membros ativos, sem duplicatas, em ordem alfabética. HUs antigas com assignee ex-membro mostram "(ex-membro)".
