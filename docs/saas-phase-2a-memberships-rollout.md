# Lote 2 — ordem de rollout no Lovable Cloud

O rollout exige duas operações SQL, executadas manualmente e nesta ordem:

1. `supabase/operations/20260704_02_organization_member_invitations_rollout.sql`
2. `supabase/operations/20260704_02b_organization_module_access_runtime.sql`

Resultados obrigatórios:

- `organization_member_invitations_ok = true`
- `organization_module_access_runtime_ok = true`

A Operação 02 instala convites, memberships, papéis, módulos e auditoria. A Operação 02B migra os acessos legados para o contexto da organização e instala `get_my_organization_module_roles(uuid)`, usado pelo frontend para resolver os módulos da organização ativa.

Somente depois dos dois resultados positivos:

1. publicar a Edge Function `organization-invitations` pelo mecanismo do Lovable Cloud;
2. definir `PUBLIC_SITE_URL` ou `SITE_URL` com a origem pública da aplicação;
3. manter `EXPOSE_ORGANIZATION_INVITE_LINKS` desligado em produção;
4. publicar o frontend da `develop`;
5. validar `/organization/members`, `/accept-invitation` e `/modulos` com usuários controlados.

As operações não alteram APF, licenses, quotas ou o estado do tenancy enforcement.
