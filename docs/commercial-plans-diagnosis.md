# Diagnóstico técnico — planos e entitlements

## Matriz atual

| Conceito | Existe | Implementação atual | Limitação | Decisão |
|---|---|---|---|---|
| Plano | Sim | `saas_plans`, RPCs e `PlatformPlansPage` | Sem versão formal; códigos legados `starter/pro` | Evoluir a entidade existente |
| Entitlements | Sim | `saas_plan_entitlements`, overrides e `get_effective_organization_entitlements` | Recurso é texto livre; sem catálogo e dependências | Referenciar catálogo formal mantendo `feature_key` |
| Assinatura | Sim | `organization_subscriptions` | Uma assinatura corrente por organização; trial embutido | Preservar como assinatura corrente e separar eventos/trial gradualmente |
| Contrato | Sim | `contracts` e domínio operacional de contratos | Contrato operacional e condição comercial ainda não estão explicitamente ligados à assinatura | Adicionar vínculo comercial sem substituir contratos |
| Trial | Parcial | Status `trialing` e `trial_ends_at` | Não possui ciclo/histórico próprio | Criar entidade aditiva de trials na Fase 2 |
| Limites | Sim | `limit_value`, overrides e `assert_organization_resource_limit` | Chaves livres e unidades implícitas | Catalogar unidade/reset/enforcement |
| Uso | Sim | `get_organization_usage_summary`, `licenses` e governança de IA | Fontes fragmentadas | Criar registro normalizado sem remover contadores legados |
| Auditoria | Sim | `platform_operational_audit_log` | Não representa todas as mudanças comerciais | Reutilizar e especializar eventos comerciais |
| RBAC | Sim | `assert_platform_admin_v2` e papéis organizacionais | Não há catálogo granular completo de permissões comerciais | Evoluir sem misturar RBAC com entitlement |
| Enforcement backend | Sim | RPCs `has/assert_organization_entitlement` e limites | Cobertura ainda parcial por endpoint | Migrar consumidores incrementalmente |
| Administração | Sim | páginas de planos e assinaturas | Entitlements por texto livre e edição monolítica | Evoluir por abas/seções |

## Fluxo atual

`saas_plans → saas_plan_entitlements → organization_subscriptions → organization_entitlement_overrides → get_effective_organization_entitlements → guards/RPCs`

O fluxo é válido e já possui isolamento, precedência de override e compatibilidade com limites legados. A fundação nova deve estendê-lo, não substituí-lo.

## Riscos encontrados

- Alterar `starter/pro` diretamente quebraria organizações, seeds, relatórios e RPCs existentes.
- `feature_key` livre permite erros de digitação e recursos sem descrição, unidade ou categoria.
- Editar entitlements do plano atual altera clientes silenciosamente por ausência de versão imutável.
- Trial ainda é apenas um estado da assinatura.
- Limites de usuários, projetos, contratos, APF e IA já têm enforcement; outros limites ainda não.
- Contratos do sistema representam também operação e SLA; não devem ser recriados como uma tabela concorrente.

## Estratégia incremental

1. Catalogar módulos e funcionalidades e vincular os entitlements existentes.
2. Criar versões imutáveis de planos e apontar novas assinaturas para uma versão.
3. Manter aliases técnicos de migração: `starter → core` e `pro → intelligence`, sem troca destrutiva.
4. Separar trials, add-ons e overrides com vigência.
5. Normalizar uso e aplicar enforcement adicional por RPC/Edge Function.
6. Só depois introduzir cobrança e provedor externo.

## Matriz de legado

| Origem | Destino | Transformação |
|---|---|---|
| `saas_plans.code=starter` | plano comercial Core | Alias preservado; nenhuma organização é migrada silenciosamente |
| `saas_plans.code=pro` | plano comercial Intelligence | Alias preservado |
| `saas_plans.code=enterprise` | Enterprise | Mantido |
| `saas_plan_entitlements.feature_key` | `product_features.code` | Catálogo criado a partir das chaves conhecidas |
| `saas_plan_entitlements` | versão inicial do plano | Cópia lógica; original preservado durante transição |
| `organization_subscriptions.plan_id` | `plan_version_id` | Backfill para versão inicial, sem alterar `plan_id` |
| `organizations.max_*` e `licenses` | limites/uso | Continuam como fonte legada até migração validada |
