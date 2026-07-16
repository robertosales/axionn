# Quality Intelligence — rollout e rollback do PR 1

## Preflight no Lovable

1. Confirmar que não existem objetos `quality_%`.
2. Confirmar assinaturas dos helpers de membership e resolução de tenant.
3. Confirmar colunas `teams.org_id`, `projects.org_id`, `contracts.org_id`, `user_stories.team_id` e `releases.team_id`.
4. Exportar policies e grants atuais.
5. Manter a feature flag desligada.

## Aplicação

1. Executar `20260719090000_quality_management_mvp.sql` pelo fluxo autorizado.
2. Confirmar o `commit` da transação.
3. Executar consultas de pós-validação de tabelas, RLS, policies, grants e funções.
4. Rodar os testes pgTAP em banco isolado, nunca em produção.

## Rollback operacional

1. Manter `VITE_QUALITY_MANAGEMENT_ENABLED=false`.
2. Revogar `EXECUTE` das RPCs públicas de qualidade para interromper writes.
3. Preservar tabelas e dados para diagnóstico.
4. Corrigir por migration posterior; nunca editar migration já aplicada.
5. Não executar `DROP`, `db reset`, `db push` ou `migration repair` no Lovable Cloud.
