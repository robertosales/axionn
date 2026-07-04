# Fase 2B - Runbook Lovable Cloud

Todas as operacoes abaixo devem ser executadas manualmente no SQL Editor
suportado pelo Lovable Cloud. Nao usar Supabase CLI contra o ambiente remoto.

## Ordem Operacional

1. Executar preflight somente leitura:
   `supabase/audits/20260704_07_organization_operational_console_preflight.sql`

   Esperado:
   `organization_operational_console_preflight_ok = true`

2. Corrigir bloqueadores reportados pelo preflight.

3. Executar rollout base:
   `supabase/operations/20260704_07_organization_operational_console_rollout.sql`

   Esperado:
   `organization_operational_console_rollout_ok = true`

   Flags esperadas:
   - `organization_operational_console_enabled = false`
   - `legacy_operational_admin_fallback_enabled = true`

4. Publicar frontend da `develop`.

5. Validar o console ainda desligado e confirmar que `/dashboard-admin`
   continua funcionando para `platform_admin`.

6. Ativar console organizacional:
   `supabase/operations/20260704_07_enable_organization_operational_console.sql`

   Esperado:
   `organization_operational_console_activation_ok = true`

7. Validar SALES CONSULTORIA:
   - organizacao ativa;
   - plano enterprise;
   - membros ativos;
   - empresas, contratos, projetos e times tenant-scoped.

8. Validar Roberto:
   - login com `roberto.sales@gmail.com`;
   - acesso a `/organization/admin`;
   - acesso a `/organization/members`;
   - acesso aos modulos permitidos.

9. Criar uma empresa controlada no tenant ativo.

10. Criar um contrato controlado usando somente empresa do mesmo tenant.

11. Validar projetos e times do mesmo tenant.

12. Validar IA como `platform_admin` em `/platform/ai-providers`.

13. Validar bloqueio de IA como admin organizacional comum.

14. Desligar fallback operacional legado:
    `supabase/operations/20260704_07_disable_legacy_operational_admin_fallback.sql`

    Esperado:
    `legacy_operational_admin_fallback_disable_ok = true`

15. Executar post-validation:
    `supabase/operations/20260704_07_organization_operational_console_post_validation.sql`

    Esperado:
    `organization_operational_console_post_validation_ok = true`

16. Monitorar erros de acesso, limite e cross-tenant.

17. Em falha critica, executar rollback:
    `supabase/operations/20260704_07_organization_operational_console_rollback.sql`

    Esperado:
    `organization_operational_console_rollback_ok = true`

## Rollback

O rollback:

- religa `legacy_operational_admin_fallback_enabled`;
- desliga `organization_operational_console_enabled`;
- nao exclui dados;
- nao remove funcoes;
- nao altera memberships;
- nao altera contratos, projetos, empresas ou times.

## Booleans Esperados

- Preflight: `organization_operational_console_preflight_ok`
- Rollout: `organization_operational_console_rollout_ok`
- Enable: `organization_operational_console_activation_ok`
- Disable fallback: `legacy_operational_admin_fallback_disable_ok`
- Post-validation: `organization_operational_console_post_validation_ok`
- Rollback: `organization_operational_console_rollback_ok`

## Bloqueadores Comuns

- registros sem `org_id`;
- divergencia `contract.org_id <> company.org_id`;
- divergencia `project.org_id <> contract.org_id`;
- divergencia `contract_teams` entre contrato e time;
- Roberto sem authority operacional;
- ausencia de `platform_admin`;
- policies amplas ou grants de mutation para `authenticated`;
- memberships inativos com modulos ativos.

## Nao Executar Nesta Fase

- `supabase db push`
- `supabase db reset`
- `supabase migration repair`
- checkout, billing ou provisionamento comercial
- alteracao de `tenancy_enforcement`
- delecao fisica de dados legados
