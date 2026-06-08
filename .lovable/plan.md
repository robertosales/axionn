## Objetivo

Hoje o Painel de Capacidade (`/admin/capacidade`) só mostra times de Sala Ágil porque a RPC `get_capacity_planner` é baseada em `developers` + sprints + `user_stories`. Vamos estender para também listar **todos os membros dos times de Sustentação** (Time 1, Time 2, Time 3 e demais) com indicadores de ociosidade, WIP e sobrecarga — usando a fonte de dados própria de Sustentação (`team_members` + `demanda_responsaveis` + `demanda_hours`).

## Regras combinadas

- **Capacidade**: 40h por semana corrente (segunda → sexta).
- **Realizado**: soma de `demanda_hours.horas` lançadas pelo usuário na semana corrente.
- **WIP**: nº de demandas em aberto (situação ≠ `aceite_final`/`cancelada`/`fila_concluida`) onde o usuário está em `demanda_responsaveis` (qualquer papel).
- **Status do membro**:
  - `idle` (Ocioso): WIP = 0 e Realizado = 0
  - `overloaded` (Sobrecarregado): Realizado > 40h OU WIP > 5
  - `warning` (Atenção): Realizado entre 32h e 40h, ou WIP entre 4 e 5
  - `ok`: tem WIP e está dentro do limite
- **Membros listados**: todos os usuários ativos de `team_members` cujo time tem `module = 'sustentacao'`. Não depende mais da tabela `developers`.

## Mudanças

### 1. Backend — nova RPC `get_capacity_planner_sustentacao`

Criar função SECURITY DEFINER que recebe `p_team_ids uuid[]` e retorna a mesma estrutura JSON usada hoje (`teamId`, `sprintAtivo` = null, `devs[]`, totais). Para cada time:

- Lista membros via `team_members → profiles` (apenas `is_active = true`).
- Para cada membro calcula `allocatedHours = 0` (não aplicável), `realizedHours`, `wipCount`, `husCount = wipCount`, `unestimatedCount = 0`.
- Janela: `date_trunc('week', now())` até `date_trunc('week', now()) + interval '5 days'` (seg-sex).
- Totais do time agregando os membros.

Validar acesso com `_assert_team_access(p_team_ids)` (mesma função já usada).

### 2. Hook `useCapacityPlanner`

- Particionar `uniqueTeams` em `agilTeams` e `sustentacaoTeams` por `team.module`.
- Disparar 2 chamadas RPC em paralelo:
  - `get_capacity_planner` (apenas times ágeis)
  - `get_capacity_planner_sustentacao` (apenas times sustentação)
- Concatenar os resultados e enriquecer normalmente.
- Ajustar `calcStatus` para suportar a semântica de Sustentação (WIP > 5 → overloaded; WIP = 0 e realizado = 0 → idle).

### 3. UI — `CapacityGrid` / `CapacityBar`

- Adicionar variante visual para times Sustentação (ícone `Shield` violet já existe; trocar p/ azul conforme regra de cor do módulo).
- Quando `sprintAtivo` for null e o time for Sustentação, exibir "Semana corrente (seg-sex)" no header em vez de sprint.
- Coluna "Aloc." é substituída por "WIP" (nº de demandas em aberto) para linhas de Sustentação. Cap. fixo 40h, Real. = horas lançadas na semana.

### 4. `AdminCapacidadePage`

- Sem mudanças estruturais; o seletor de times já popula a partir de `uniqueTeams` (que inclui ambos os módulos).
- Atualizar contador do header para mostrar "X devs (Ágil) · Y analistas (Sustentação)".

## Pontos técnicos

```text
get_capacity_planner_sustentacao(p_team_ids)
 ├─ assert acesso
 ├─ FOR EACH team_id:
 │   ├─ membros = SELECT user_id FROM team_members JOIN profiles (is_active)
 │   ├─ janela = [monday(now), friday(now) 23:59:59]
 │   ├─ realized = SUM(demanda_hours.horas WHERE user_id=mem AND data_lancamento IN janela)
 │   ├─ wip = COUNT(demanda_responsaveis JOIN demandas
 │   │            WHERE user_id=mem AND situacao NOT IN
 │   │            ('aceite_final','cancelada','fila_concluida','rejeitada'))
 │   └─ build dev jsonb
 └─ retorna jsonb estrutura compatível
```

A RPC e os fixes do hook/UI são pequenos e não tocam em fluxo de Sala Ágil.

## Fora de escopo

- Editar capacidade individual por membro (continua 40h fixos).
- Histórico semanal / gráfico de tendência (pode vir depois).
