# Quality Intelligence — rollout, validação cumulativa e rollback

## Escopo atual

O domínio não está mais restrito ao PR 1. O estado cumulativo inclui fundação,
casos e suítes, planos, execução manual, permissões, invariantes de integridade,
catálogo comercial granular e hardening do entitlement tenant-scoped.

## Preflight no Lovable

1. Confirmar que não existem objetos `quality_%`.
2. Confirmar assinaturas dos helpers de membership e resolução de tenant.
3. Confirmar colunas `teams.org_id`, `projects.org_id`, `contracts.org_id`, `user_stories.team_id` e `releases.team_id`.
4. Exportar policies e grants atuais.
5. Manter a feature flag desligada.

## Aplicação

1. Conferir fisicamente os objetos antes de aplicar qualquer migration ausente no
   histórico remoto.
2. Aplicar somente migrations comprovadamente ausentes, na ordem cronológica e pelo
   fluxo autorizado do Lovable.
3. Confirmar o `commit` de cada transação.
4. Executar
   `supabase/operations/20260725_01_quality_intelligence_cumulative_validation.sql`.
5. Exigir `quality_intelligence_cumulative_validation_ok = true`.
6. Rodar os testes pgTAP em banco isolado, nunca em produção.
7. Só então habilitar `VITE_QUALITY_MANAGEMENT_ENABLED` no canário.

Não reaplicar migrations apenas porque não aparecem em
`supabase_migrations.schema_migrations`.

## Critérios do gate cumulativo

- 14 tabelas Quality disponíveis e com RLS;
- 19 RPCs públicas esperadas;
- permissões Quality materializadas;
- `quality.cases.view` ativa e vinculada a pelo menos uma versão de plano;
- RPC de entitlement como `security definer` com `search_path` seguro;
- `anon` sem acesso ao gate comercial;
- escrita direta de casos bloqueada para `authenticated`.

## Rollback operacional

1. Manter `VITE_QUALITY_MANAGEMENT_ENABLED=false`.
2. Revogar `EXECUTE` das RPCs públicas de qualidade para interromper writes.
3. Preservar tabelas e dados para diagnóstico.
4. Corrigir por migration posterior; nunca editar migration já aplicada.
5. Não executar `DROP`, `db reset`, `db push` ou `migration repair` no Lovable Cloud.
