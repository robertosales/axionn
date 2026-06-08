## Contexto

A integração já está parcialmente implementada (turno anterior). Este plano refina apenas a definição de "SLA crítico" para usar a **mesma régua** do motor canônico (`fn_check_sla_status` + `contract_slas`) em vez do limiar provisório de 24 h. Visual, cores e layout permanecem intactos.

## O que já está em produção

- `get_capacity_planner_sustentacao` (RPC) — calcula `wipCount` excluindo status pausados (`bloqueada`, `aguardando_cliente`, `aguardando_terceiros`, `suspensa`, `impeditivo`), expõe `pausedCount`, `slaCriticalCount` e `allocatedHours` = soma de `total_horas` das demandas ativas.
- `useCapacityPlanner` — status do dev passa a `overloaded` quando `slaCriticalCount > 0` (prioridade sobre WIP/horas); totalizador do topo usa `totalAllocated / totalCapacity` para ambos os módulos.
- `CapacityGrid` — subtítulo do dev mostra "X pausada(s)" e "X SLA crítico" sem mexer em cores/layout.

## O que muda agora

Substituir a heurística `prazo_solucao - now() <= 24h` pelo cálculo do motor de SLA real, mantendo um fallback para demandas sem `contract_id`.

### 1. RPC `get_capacity_planner_sustentacao` — recalcular `slaCriticalCount`

Para cada demanda ativa (não fechada, não pausada) do dev no time, classificar como crítica quando:

- **Com contrato SLA** (`d.contract_id IS NOT NULL` e existe `contract_slas` para `(contract_id, priority)`):
  - `resolution_pct >= 85`  **OU**  `now() > created_at + resolution_time_minutes` (estourado)
  - mesma fórmula de `fn_check_sla_status` → cores `orange`/`red`.
  - Respeita `business_hours_only` do contrato (08h–20h, seg–sex) reaproveitando a função existente `is_feriado` quando aplicável.
- **Sem contrato** (`d.contract_id IS NULL`) — fallback pelo deadline manual:
  - `prazo_solucao IS NOT NULL` E (`prazo_solucao <= now()` OU `prazo_solucao - now() <= interval '24 hours'`).

Implementação: subquery única dentro da função, com `LEFT JOIN public.contract_slas cs ON cs.contract_id = d.contract_id AND cs.priority = COALESCE(d.priority,'normal')`. Reusa lógica do `fn_check_sla_status` inline para evitar chamada por linha.

### 2. Hook `useCapacityPlanner`

Sem mudanças além das já aplicadas — continua lendo `slaCriticalCount` da RPC e promovendo status para `overloaded`.

### 3. `CapacityGrid.tsx`

Sem mudanças. O texto "X SLA crítico" e o ícone `AlertTriangle` (cores semânticas existentes) já refletem o novo cálculo.

## Validação pós-deploy

1. Selecionar 1 dev com demanda ativa cujo SLA esteja com `resolution_pct ≥ 85` no `fn_check_sla_status` → confirmar que o card mostra status sobrecarregado e contador "SLA crítico".
2. Selecionar 1 dev com todas as demandas pausadas (`bloqueada`) → `wipCount = 0`, `pausedCount > 0`, status = `idle` se sem alocação.
3. Conferir totalizador do topo de cada time Sustentação: `Σ alloc / Σ cap` ≠ 0%.

## Fora do escopo

- Mudanças visuais, de cor ou layout.
- Alterar a régua do motor de SLA (85 % continua sendo o limiar crítico).
- Aplicar a mesma lógica no painel de Sala Ágil.
