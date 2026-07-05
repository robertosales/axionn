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

4. Aplicar o hardening operacional copiando integralmente para o SQL Editor:

   `supabase/migrations/20260704080000_organization_operational_console_hardening.sql`

   Esse passo instala as mutations tenant-scoped de contratos, projetos e times e adiciona `teams.is_active`.

5. Aplicar o hardening global de IA:

   `supabase/migrations/20260704080100_platform_ai_provider_hardening.sql`

   Esse passo instala os RPCs exclusivos de `platform_admin`. Nenhuma chave é retornada ao frontend.

6. Executar a validação do hardening:

   `supabase/operations/20260704_08_organization_operational_console_hardening_validation.sql`

   Esperado:

   `organization_operational_console_hardening_ok = true`

7. Publicar o frontend da `develop`.

8. Com as flags ainda no estado inicial, confirmar que o fallback permanece disponível para uma reversão controlada.

9. Ativar o console organizacional:

   `supabase/operations/20260704_07_enable_organization_operational_console.sql`

   Esperado:

   `organization_operational_console_activation_ok = true`

10. Validar SALES CONSULTORIA:

    - organização ativa;
    - plano enterprise;
    - membros ativos;
    - empresas, contratos, projetos e times tenant-scoped;
    - nenhum recurso de outro tenant visível.

11. Validar Roberto:

    - login com `roberto.sales@gmail.com`;
    - acesso a `/organization/admin`;
    - acesso a `/organization/companies`;
    - acesso a `/organization/contracts`;
    - acesso a `/organization/projects`;
    - acesso a `/organization/teams`;
    - acesso a `/organization/members`;
    - acesso aos módulos permitidos.

12. Criar uma empresa cliente controlada no tenant ativo e depois inativá-la. Confirmar que não ocorreu hard delete.

13. Criar um contrato controlado usando somente empresa, times e projetos do mesmo tenant.

14. Validar `contracts.max` com mensagem de negócio quando aplicável.

15. Criar e arquivar um projeto controlado. Validar `projects.max` quando aplicável.

16. Criar, editar e inativar um time. Confirmar que `contract_teams` foi preservada.

17. Validar IA como `platform_admin` em `/platform/ai-providers`:

    - listar metadados;
    - criar ou editar um provedor controlado;
    - configurar chave sem exibição posterior do valor;
    - arquivar o provedor controlado.

18. Validar que um admin organizacional comum não acessa `/platform/ai-providers` nem os RPCs globais.

19. Desligar o fallback operacional legado:

    `supabase/operations/20260704_07_disable_legacy_operational_admin_fallback.sql`

    Esperado:

    `legacy_operational_admin_fallback_disable_ok = true`

20. Executar post-validation:

    `supabase/operations/20260704_07_organization_operational_console_post_validation.sql`

    Esperado:

    `organization_operational_console_post_validation_ok = true`

21. Monitorar erros de autorização, limite e cross-tenant.

22. Em falha crítica, executar rollback:

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
- não remove o hardening; apenas retorna o tráfego ao caminho legado.

## Booleans esperados

- Preflight: `organization_operational_console_preflight_ok`
- Rollout: `organization_operational_console_rollout_ok`
- Hardening: `organization_operational_console_hardening_ok`
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
- organização acima dos limites atuais.

## Não executar nesta fase

- `supabase db push`
- `supabase db reset`
- `supabase migration repair`
- checkout, billing ou provisionamento comercial
- alteração de `tenancy_enforcement`
- deleção física de dados legados
