## Diagnóstico

A tela **Métricas** lista membros direto da tabela `developers` filtrada por `team_id`. No time **[NEXO] - TIME A - B** existem 3 linhas com nome "Roberto":

| name | role | user_id | observação |
|---|---|---|---|
| Roberto De Araujo Sales | Scrum Master | **NULL** | legado, sem vínculo de auth |
| Roberto Sales | Desenvolvedor Fullstack | NULL | pertence a outro time ([GESP3]) |
| Roberto Sales | developer | 3c47… | membro real, atual |

Só o terceiro está em `team_members`. Os outros são registros antigos sem `user_id`, criados antes do vínculo com auth. No RBAC/perfis, só o real aparece — mas a Métricas mostra todos porque não filtra pela membership do time.

Mesmo padrão do bug já corrigido em `useTeamAssignees`.

## Mudança

**Arquivo único:** `src/components/MetricsDashboard.tsx`

1. Ao carregar `developers` do time, carregar também os `user_id`s de `team_members` para esse time.
2. Filtrar `allDevs` mantendo apenas linhas cujo `user_id` esteja no conjunto de `team_members.user_id` (descarta legados sem `user_id` e ex-membros).
3. Dedupe defensivo por `user_id` (caso existam linhas duplicadas com mesmo `user_id`, manter a mais recente por `created_at`).
4. Incluir `team_members` no listener realtime já existente para reagir quando entram/saem membros.

## Fora do escopo
- Não apagar dados em `developers` (regra do projeto: nunca deletar tabelas/linhas legadas via app).
- Tela RBAC, dropdown de User Story e demais telas não são alteradas.
