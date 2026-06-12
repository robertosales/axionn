## Causa do erro

A tabela `sprints` não possui coluna `status` — sprints encerradas são identificadas por `is_active = false` (mesma correção já aplicada em `src/hooks/useSprintHistory.ts`). O hook do admin `src/features/admin/hooks/useSprintHistory.ts` ainda usa `.eq('status', 'completed')`, retornando HTTP 400 (`column sprints.status does not exist`) na tela `/dashboard-admin`.

## Mudança (branch `fix/sprints-historico-400`)

Arquivo: `src/features/admin/hooks/useSprintHistory.ts`

- Substituir `.eq('status', 'completed')` por `.eq('is_active', false)` na query de `sprints`.
- Manter o restante (select, joins com `teams`, filtros de período e time) inalterado.

Nenhuma outra ocorrência de `sprints.status` foi encontrada no código do admin. Sem alterações de schema, RLS, UI ou tipos.

## Validação

- Recarregar `/dashboard-admin` → painel "Histórico de Sprints" deve listar sprints encerradas sem erro 400 no console.
- Filtros por time e período (3m/6m/12m/all) devem continuar funcionando.
