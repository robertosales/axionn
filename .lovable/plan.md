## Diagnóstico

O combo **Responsável** do formulário de User Story lê `developers` do `SprintContext`, que devolve **todas as linhas de `developers` do time** sem filtrar membros ativos.

No time `[nexo]-Time A - B` existem **20 linhas em `developers`** contra **11 membros reais** em `team_members`. Causas:

1. **Stale (ex-membros)** com `user_id NULL`, importados antes do vínculo com `auth.users` (Eduardo Ventura, Lucas Borges, Rejane Nunes, etc.).
2. **Duplicados**: mesmo profissional aparece 2x — linha legada (sem `user_id`) **+** nova linha criada pelo sync do `HUEditDrawer` quando o usuário virou membro de fato (com `user_id`). Casos: Marcus Cesar, Matheus Meneses, Maylane Natel, Rafael Quintino, Roberto Sales.

O `useEffect` de sync só **insere** developers faltantes — nunca remove obsoletos — então a lista cresce.

## Plano de correção (apenas frontend, sem deletar dados)

### 1. Novo hook `src/hooks/useTeamAssignees.ts`
Recebe `teamId`, lista `developers` e `currentAssigneeId`. Retorna:
- Apenas developers com `user_id ∈ team_members(team_id)` ativos.
- Deduplicado por `user_id`.
- **Ordenado alfabeticamente** por nome (pt-BR, case-insensitive).
- Se o `currentAssigneeId` da HU não estiver na lista (ex-membro histórico), é anexado ao final como `Nome (ex-membro)` para o valor renderizar sem quebrar o select.

### 2. `src/components/HUEditDrawer.tsx`
- Trocar o `(developers ?? []).map(...)` no `<SelectContent>` pelo retorno do hook.
- Manter o `useEffect` que cria devs faltantes para novos membros (essencial para o combo refletir membros recém-adicionados).

### 3. `src/components/UserStoryManager.tsx`
- Mesma troca no `<SelectContent>` do campo Responsável (linha ~296), usando o hook.

### 4. Não fazer agora
- Não excluir linhas de `developers` (HUs antigas referenciam `assignee_id`).
- Não mexer em RLS/migrations.

## Validação

- “Editar User Story” no time `[nexo]-Time A - B`: combo exibe exatamente os 11 membros, em ordem alfabética, sem duplicatas.
- HU antiga com responsável ex-membro: nome aparece com `(ex-membro)` e pode ser trocado.
- Adicionar/remover membro do time → reabrir o drawer → combo reflete a mudança.