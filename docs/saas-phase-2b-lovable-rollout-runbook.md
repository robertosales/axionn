# Fase 2B — Runbook Lovable Cloud

Todas as operações devem ser executadas manualmente no SQL Editor suportado pelo Lovable Cloud. Não usar Supabase CLI contra o ambiente remoto.

## Ordem operacional

1. Executar o preflight somente leitura:

   `supabase/audits/20260704_07_organization_operational_console_preflight.sql`

   Esperado:

   `organization_operational_console_preflight_ok = true`

2. Corrigir todos os bloqueadores reportados.

3. Executar o rollout base:

   `supabase/operations/20260704_07_organization_operational_console_rollout.sql`

   Esperado:

   `organization_operational_console_rollout_ok = true`

   Flags esperadas:

   - `organization_operational_console_enabled = false`;
   - `legacy_operational_admin_fallback_enabled = true`.

4. Aplicar o hardening operacional:

   `supabase/migrations/20260704080000_organization_operational_console_hardening.sql`

   Instala as mutations tenant-scoped de contratos, projetos e times e adiciona `teams.is_active`.

5. Aplicar o hardening global de IA:

   `supabase/migrations/20260704080100_platform_ai_provider_hardening.sql`

   Instala RPCs exclusivos de `platform_admin`. Chaves e `vault_secret_id` não são retornados ao frontend.

6. Aplicar a reconciliação de vínculos entre times e contratos:

   `supabase/migrations/20260704080200_organization_team_contract_links.sql`

   Ao trocar ou remover o contrato de um time, o vínculo antigo em `contract_teams` é removido e o vínculo atual é mantido de forma transacional.

7. Executar a validação principal do hardening:

   `supabase/operations/20260704_08_organization_operational_console_hardening_validation.sql`

   Esperado:

   `organization_operational_console_hardening_ok = true`

8. Executar a validação dos vínculos de times:

   `supabase/operations/20260704_09_team_contract_links_validation.sql`

   Esperado:

   `team_contract_links_hardening_ok = true`

9. Publicar ou republicar as Edge Functions usando a versão atual da `develop`:

   - `apf-generate`;
   - `platform-ai-provider-test`;
   - `organization-invitations`, caso ainda não esteja na versão atual.

   Manter JWT obrigatório nas funções. Confirmar as variáveis e secrets:

   - `SUPABASE_URL`;
   - `SUPABASE_ANON_KEY`;
   - `SUPABASE_SERVICE_ROLE_KEY`;
   - `SITE_URL`;
   - secrets dos provedores que continuarem sendo utilizadas como fallback.

10. Publicar o frontend da `develop` com:

    `VITE_ORG_TENANCY_ENABLED=true`

11. Fazer logout, limpar a sessão anterior e entrar novamente.

12. Com as flags ainda no estado inicial, confirmar que o fallback continua disponível.

13. Ativar o console organizacional:

    `supabase/operations/20260704_07_enable_organization_operational_console.sql`

    Esperado:

    `organization_operational_console_activation_ok = true`

14. Validar SALES CONSULTORIA:

    - organização ativa;
    - plano enterprise;
    - membros ativos;
    - empresas, contratos, projetos e times tenant-scoped;
    - nenhum recurso de outro tenant visível.

15. Validar Roberto:

    - login com `roberto.sales@gmail.com`;
    - acesso a `/organization/admin`;
    - acesso a `/organization/companies`;
    - acesso a `/organization/contracts`;
    - acesso a `/organization/projects`;
    - acesso a `/organization/teams`;
    - acesso a `/organization/members`;
    - acesso a `/organization/usage`;
    - acesso a `/organization/settings`;
    - acesso aos módulos permitidos.

16. Validar empresas:

    - criar uma empresa controlada;
    - editar dados e CNPJ;
    - inativar;
    - confirmar que não ocorreu hard delete.

17. Validar contratos:

    - criar usando empresa do mesmo tenant;
    - vincular times e projetos do mesmo tenant;
    - editar;
    - arquivar;
    - validar mensagem de negócio para `contracts.max` quando aplicável.

18. Validar projetos:

    - criar;
    - editar contrato, time e tipo;
    - arquivar;
    - validar mensagem de negócio para `projects.max` quando aplicável.

19. Validar times:

    - criar ligado a um contrato;
    - trocar o contrato;
    - confirmar que o vínculo antigo em `contract_teams` desapareceu;
    - confirmar que o novo vínculo foi criado;
    - remover o contrato;
    - inativar o time.

20. Validar usuários:

    - convidar;
    - aceitar o convite;
    - alterar papel e módulos;
    - revogar ou inativar;
    - confirmar que membro comum não acessa o console administrativo.

21. Validar IA como `platform_admin` em `/platform/ai-providers`:

    - listar metadados;
    - criar ou editar um provedor controlado;
    - configurar chave;
    - testar o provedor pela função `platform-ai-provider-test`;
    - confirmar que a resposta não contém chave, `vault_secret_id` ou `rawError`;
    - arquivar o provedor controlado.

22. Validar que um admin organizacional comum não acessa `/platform/ai-providers`, não testa provedores e não executa RPCs globais.

23. Verificar auditoria:

    - `organization_operational_audit_log`;
    - `platform_operational_audit_log`.

    Não deve existir chave, token ou segredo em `before_values`, `after_values` ou `metadata`.

24. Desligar o fallback operacional legado somente depois de todos os testes anteriores passarem:

    `supabase/operations/20260704_07_disable_legacy_operational_admin_fallback.sql`

    Esperado:

    `legacy_operational_admin_fallback_disable_ok = true`

25. Executar post-validation:

    `supabase/operations/20260704_07_organization_operational_console_post_validation.sql`

    Esperado:

    `organization_operational_console_post_validation_ok = true`

26. Monitorar erros de autorização, limite, Edge Functions e cross-tenant.

27. Em falha crítica, executar rollback:

    `supabase/operations/20260704_07_organization_operational_console_rollback.sql`

    Esperado:

    `organization_operational_console_rollback_ok = true`

## Rollback

O rollback:

- religa `legacy_operational_admin_fallback_enabled`;
- desliga `organization_operational_console_enabled`;
- não exclui dados;
- não remove funções;
- não altera memberships;
- não altera contratos, projetos, empresas ou times;
- mantém o hardening instalado e apenas devolve o tráfego ao caminho legado.

Caso a falha esteja em uma Edge Function, republicar também a última versão estável da função afetada.

## Booleans esperados

- Preflight: `organization_operational_console_preflight_ok`
- Rollout: `organization_operational_console_rollout_ok`
- Hardening: `organization_operational_console_hardening_ok`
- Vínculos de times: `team_contract_links_hardening_ok`
- Enable: `organization_operational_console_activation_ok`
- Disable fallback: `legacy_operational_admin_fallback_disable_ok`
- Post-validation: `organization_operational_console_post_validation_ok`
- Rollback: `organization_operational_console_rollback_ok`

## Bloqueadores comuns

- registros sem `org_id`;
- divergência `contract.org_id <> company.org_id`;
- divergência `project.org_id <> contract.org_id`;
- divergência em `contract_teams`;
- Roberto sem autoridade operacional;
- ausência de `platform_admin`;
- memberships inativos com módulos ativos;
- função de armazenamento seguro da chave de IA ausente;
- organização acima dos limites atuais;
- Edge Function publicada em versão anterior;
- `VITE_ORG_TENANCY_ENABLED` ausente no build.

## Não executar nesta fase

- `supabase db push`
- `supabase db reset`
- `supabase migration repair`
- checkout, billing ou provisionamento comercial
- alteração de `tenancy_enforcement`
- deleção física de dados legados
