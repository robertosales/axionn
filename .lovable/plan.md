## Diagnóstico (varredura completa)

Listas de membros vazam em **13 pontos**. Apenas 3 já filtram por `team_members` (MetricsDashboard, HUEditDrawer e UserStoryManager via `useTeamAssignees`, e DemandaDetail). Os outros 10 carregam `developers` direto por `team_id`, ou em Sustentação consultam `profiles WHERE is_active = true` sem escopo de time — daí "Leidy", "Carlos Santos" e ex-membros aparecem em selects, gráficos e relatórios.

## Estratégia

Centralizar a regra em **um helper único** e aplicar em todos os pontos de carga. Para dados históricos (HUs/atividades/demandas atribuídas a quem saiu) exibir o nome **com sufixo "(ex-membro)"**.

## Mudanças

### 1) Novo helper compartilhado
- **`src/lib/teamMemberFilter.ts`** (novo)
  - `fetchActiveMemberIds(teamId)` → `Set<string>` lendo `team_members.user_id`.
  - `filterActiveDevelopers(devs, memberIds)` → mantém apenas `dev.user_id ∈ memberIds`, deduplica por `user_id` (mais recente em `created_at` ganha).
  - `withExMemberTag(name, userId, memberIds)` → retorna `"Fulano (ex-membro)"` quando o `userId` não está no set; usado em colunas de exibição de dados históricos.

### 2) Sala Ágil — corrigir cada ponto de carga
Aplicar `fetchActiveMemberIds` + `filterActiveDevelopers` após cada fetch de `developers`:
- `src/contexts/SprintContext.tsx` (load inicial + handlers realtime de `setDevelopers`).
- `src/features/kanban/hooks/useKanbanBoard.ts` (`fetchDevs`).
- `src/features/dashboard/hooks/useDashboardData.ts`.
- `src/features/reports/pages/SalaAgilReportsPage.tsx`.
- `src/components/sala-agil/reports/hooks/useReports.ts` (3 fetches).
- `src/features/reports/hooks/useSprintReport.ts`.

`KanbanFilterBar` e `RelatorioAtividades` (dropdown "Analista" do print) consomem essas listas via prop → são corrigidos por consequência.

### 3) Sala Ágil — exibição de histórico
- `src/features/releases/hooks/useReleases.ts`: ao resolver nomes de assignees por `id`, aplicar `withExMemberTag` comparando `user_id` ao set ativo do time.
- Cards/relatórios que mostram o `name` de quem fez/recebeu atividade antiga: usar o mesmo helper de tag.

### 4) Sustentação — filtros e relatórios
- **`MetricasFilterBar`** (chip "Membro"): cruzar nomes derivados de `responsavel_*` com `profiles` dos `team_members` ativos do time atual; nomes fora da membership ficam fora do select (continuam visíveis nas linhas de dados antigos com tag "(ex-membro)").
- **`useAllTransitions.ts` / `useProfiles()`** (consumido por `RelatorioProdutividade`, `RelatorioSLA`, `RelatorioTempoMedio`): aceitar `teamId` e restringir o fetch de `profiles` a `id IN (team_members.user_id WHERE team_id = ?)`. Quando o relatório é cross-team (admin "Todos"), aceitar `teamId = "all"` e usar todos os times Sustentação do usuário.
- **`DemandaDetail`** já está correto — manter.
- **`profiles.service.ts:fetchDevelopersFallback`**: passar `teamId` obrigatório e filtrar por `team_members` para não vazar devs de outros times.

### 5) Dados legados
- Não apagar linhas órfãs em `developers` (regra do projeto). O filtro em runtime resolve a UI; o histórico fica preservado e visível com tag.

## Validação (após implementar)
- Sala Ágil › Métricas / Relatório Individual / Kanban filter / Backlog: dropdowns "Analista/Responsável/Membro" devem listar exatamente os membros de `team_members` do time atual, sem duplicatas, em ordem alfabética (já feito em Métricas).
- Sustentação › Relatórios e MetricasFilterBar: "Membro/Analista" também respeita `team_members` do time atual.
- HUs/atividades/demandas antigas atribuídas a quem saiu: nome continua aparecendo nas linhas, com sufixo "(ex-membro)".

## Fora do escopo
- Telas RBAC / TeamMembersManager / DeveloperManager (são as fontes de verdade; precisam mostrar todos).
- Limpeza de linhas legadas na tabela `developers`.
