# Sustentação Kanban sem cards — diagnóstico e correção

## Causa raiz

A RPC `public.get_demandas_with_responsaveis(uuid)` está retornando **400 Bad Request** com o erro `42803: column "d.updated_at" must appear in the GROUP BY clause or be used in an aggregate function`. Sem dados da RPC, o hook `useDemandas` devolve lista vazia e o board não mostra nenhum card (apesar de existirem 251–271 demandas por time no banco).

A migration de 03/jun (`20260603150000_fix_get_demandas_expose_project_contract.sql`), que adicionou os campos `project_id` e `contract_id` ao payload, **regrediu a correção anterior**: voltou a usar `ORDER BY d.updated_at DESC` no SELECT externo, fora do `jsonb_agg(...)`. Como o SELECT é uma agregação sem `GROUP BY`, o Postgres rejeita o ORDER BY referenciando coluna não-agregada.

Trecho atual problemático (final da função):

```sql
SELECT jsonb_agg( jsonb_build_object(...) )
INTO v_result
FROM demandas d
LEFT JOIN teams t ON t.id = d.team_id
WHERE d.team_id = p_team_id
ORDER BY d.updated_at DESC;   -- ❌ inválido aqui
```

## Correção

Criar nova migration que recria a função com o `ORDER BY` **dentro** do `jsonb_agg`, mantendo intactos:
- assinatura `(p_team_id uuid) RETURNS jsonb`
- `SECURITY DEFINER`, `STABLE`, `SET search_path = public`
- validação de `team_members` / `auth.uid()`
- todos os campos do payload, inclusive `project_id` e `contract_id` adicionados em 03/jun
- subqueries de `responsaveis_*` e `responsaveis_list`

Forma corrigida:

```sql
SELECT jsonb_agg(
  jsonb_build_object( ... )
  ORDER BY d.updated_at DESC
)
INTO v_result
FROM demandas d
LEFT JOIN teams t ON t.id = d.team_id
WHERE d.team_id = p_team_id;
```

## Validação após aplicar

1. `SELECT jsonb_array_length(public.get_demandas_with_responsaveis('<team_id>'))` retorna > 0 para os times com dados (271 / 251 / 114).
2. Recarregar `/sustentacao` → board mostra os cards nas colunas do workflow.
3. Conferir Network: chamada `rpc/get_demandas_with_responsaveis` volta com status 200.

## Escopo

- 1 nova migration SQL (apenas `CREATE OR REPLACE FUNCTION`). Sem alterações no frontend.
- Não toca nos erros de build pré-existentes (módulo `contracts`, `UserRolesManager`, `ApfPokerReference`, `DataPayloadSummary`) — esses já existiam antes desta correção e são independentes do problema do Kanban.
