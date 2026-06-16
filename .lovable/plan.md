## Diagnóstico

Os times `[GESP3] - TIME A/B/C` existem e estão vinculados ao contrato **CONTRATO DE FABRICA PF** (`teams.contract_id = d59ab6dc-...`), mas não aparecem em **Visão Geral, Histórico, Capacidade, Times** nem no select **Sala (opcional)** do modal "Editar Projeto".

**Causa raiz**: todos os hooks do dashboard admin descobrem os times do contrato lendo **apenas** `projects.contract_id` + `DISTINCT team_id`. Times sem nenhum projeto ainda criado naquele contrato ficam invisíveis — efeito "ovo e galinha" (não consigo selecionar o time no novo projeto porque ele não aparece, e ele não aparece porque não tem projeto).

Hooks afetados:

```text
useTeamsAdmin(contractId)       → src/features/admin/hooks/useTeamsAdmin.ts
useAdminKpis(contractId)        → src/features/admin/hooks/useAdminKpis.ts
useSprintHistory(contractId)    → src/features/admin/hooks/useSprintHistory.ts
useCapacityPlanner(contractId)  → src/features/admin/hooks/useCapacityPlanner.ts
```

## Plano de correção

### 1. Novo helper `src/features/admin/lib/resolveContractTeamIds.ts`

Resolve os IDs de times do contrato unindo as duas fontes (sem perder dados legados):

```text
ids = UNIQUE(
  SELECT id       FROM teams    WHERE contract_id = :contractId
  UNION
  SELECT team_id  FROM projects WHERE contract_id = :contractId AND team_id IS NOT NULL
)
```

Retorna `string[] | null` (`null` = sem filtro).

### 2. Refatorar os 4 hooks para usar o helper

Cada hook hoje monta `teamIds` lendo só de `projects`. Trocar pela chamada ao helper, mantendo o restante igual:

- `useTeamsAdmin.ts` — substitui o bloco `if (contractId) { ...projects... }`
- `useAdminKpis.ts` — substitui o `useEffect` que popula `filteredTeamIds`
- `useSprintHistory.ts` — substitui o bloco `allowedTeamIds` (linhas ~79–89)
- `useCapacityPlanner.ts` — substitui o bloco `allowedTeamIds` (linhas ~50–62)

### 3. Ordenação alfabética dos times

Aplicar `ORDER BY name ASC` (case-insensitive, locale `pt-BR`) em todas as listas de times derivadas:

- `useTeamsAdmin.ts` — trocar `.order('created_at')` por `.order('name', { ascending: true })`
- `useCapacityPlanner.ts` — ordenar `teams` por `name` antes de gerar `uniqueTeams`
- `useAdminKpis.ts` — ordenar o `byTeam` final por `teamName`
- `useSprintHistory.ts` — ordenar `teamComparativo` por `teamName`
- `ProjetosAdminPanel.tsx` — garantir que o select "Sala (opcional)" itera sobre a lista já ordenada (sem mudança de UI, vem do hook)

Uso de `String.prototype.localeCompare(..., 'pt-BR', { sensitivity: 'base', numeric: true })` para tratar números (TIME 1/2/3) e acentos corretamente.

### 4. Validação

- "Editar Projeto" → "Sala (opcional)" lista os 7 times em ordem: `[GESP3] - TIME A`, `[GESP3] - TIME B`, `[GESP3] - TIME C`, `[NEXO] - TIME A - B`, `TIME 1`, `TIME 2`, `TIME 3`.
- Visão Geral, Histórico, Capacidade e Times mostram os 7 times do contrato (KPIs zerados quando ainda não há dados — esperado).
- Trocar o contrato no `ContractSwitcher` continua filtrando corretamente.
- Sem alteração em RLS, schema, migration ou políticas.

## Fora do escopo

- Sem migration nem mudança em `contract_room_teams` (vazia, não usada por essas telas).
- Sem mexer em RBAC, TeamMembers, Developers ou nas listas de membros/analistas (rodada anterior).
