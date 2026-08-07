# Rollout — hierarquia de Features do backlog

## Ordem de aplicação

1. `20260804180000_backlog_features.sql`
2. `20260804190000_backlog_features_hardening.sql`
3. `20_backlog_features_hierarchy.test.sql` — resultado esperado: 14/14.
4. `20260804_backlog_features_readiness.sql` — `hierarchy_mismatches` deve ser zero.

## Compatibilidade

- `user_stories.epic_id` permanece durante a transição.
- HUs existentes podem ficar com `feature_id = null` e aparecem como **Sem Feature**.
- Integrações que não conhecem Feature continuam criando HUs normalmente.
- Atualizações parciais de GitLab, Teams e webhooks não limpam `feature_id`.

## Smoke test

1. Criar um Épico e uma Feature vinculada.
2. Criar uma HU selecionando ambos.
3. Confirmar os badges no Backlog, preview e Kanban.
4. Filtrar o Kanban pela Feature.
5. Mover a Feature para outro Épico e confirmar a sincronização da HU.
6. Tentar excluir a Feature: a operação deve falhar enquanto houver HUs vinculadas.
7. Confirmar Épico e Feature no relatório e no CSV do backlog.

## Rollback funcional

Para desabilitar a adoção sem perda de dados, pare de atribuir novas Features e mantenha
`feature_id` nullable. A UI e as integrações antigas continuam operando via `epic_id`.
Não remova tabela ou coluna enquanto existirem HUs classificadas.
