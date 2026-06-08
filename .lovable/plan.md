## Diagnóstico

`teams` no `AuthContext` é construído a partir de `team_modules`, então cada time aparece **uma entrada por módulo**. TIME 1/2/3 estão cadastrados em `team_modules` com **dois módulos cada**: `sustentacao` E `rdm`.

```
TIME 1 | sustentacao
TIME 1 | rdm
TIME 2 | sustentacao
TIME 2 | rdm
TIME 3 | sustentacao
TIME 3 | rdm
```

No `useCapacityPlanner`, a função `uniqueTeams` dedup por `team.id` mantendo a **primeira ocorrência**. Quando a primeira entrada lida é a versão `rdm`, o filtro `t.module === "sustentacao"` devolve `[]`, a RPC `get_capacity_planner_sustentacao` não é chamada, `teamCapacities` fica vazio e o `CapacityGrid` exibe "Nenhum sprint ativo encontrado". Isso explica o sintoma — não é o layout Ágil sendo aplicado por engano; é a partição que perdeu o time.

## Correção

### 1. `src/features/admin/hooks/useCapacityPlanner.ts`

Trocar o dedup ingênuo por uma versão que **prioriza o módulo "real" do time** (`sala_agil` ou `sustentacao`) sobre `rdm`:

- Para cada `team.id`, preferir a entrada cujo `module ∈ {sala_agil, sustentacao}`; só usar `rdm` como último recurso.
- Resultado: TIME 1/2/3 entram em `sustentacaoIds`, a RPC é executada, devs são renderizados.

### 2. `src/features/admin/components/CapacityGrid.tsx`

Ajustar a mensagem de vazio para refletir a realidade (sem mudar layout/cores):

- Quando `teamCapacities.length === 0`, exibir "Nenhum time com dados de capacidade no período" em vez de "Nenhum sprint ativo encontrado", para não confundir o caso Sustentação (onde não há sprint) com falha.

O badge "Sustentação" já está presente no header do time (`team.module === "sustentacao" ? <Shield…/> + Badge "Sustentação"`); ele simplesmente não aparecia porque o array vinha vazio. Com a partição corrigida, o badge volta automaticamente.

### 3. Validação

- `/dashboard-admin` → selecionar TIME 1/2/3 individualmente → cada um deve mostrar o card com badge azul "Sustentação", ícone `Shield`, header "Semana corrente", lista de membros com WIP/SLA crítico e horas alocadas/realizadas.
- Selecionar "Todos" → todos os times aparecem corretamente segregados.
- Selecionar um time Ágil ([GESP3] - TIME A, etc.) → continua usando `get_capacity_planner` com badge verde "Sala Ágil" e dias restantes do sprint.

## Fora do escopo

- Mudanças visuais, cores ou layout.
- Alterar `team_modules` ou a forma como `AuthContext` carrega times.
- Tocar na lógica de SLA crítico já entregue no turno anterior.
