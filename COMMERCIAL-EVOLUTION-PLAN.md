# Plano: Evolução do Módulo Comercial — Axionn

## Diagnóstico do Sistema Atual

### O que JÁ existe (base sólida)

| Conceito | Status | Onde |
|---|---|---|
| Catálogo de módulos | ✅ Completo | `product_modules` (29 módulos, 3 domínios) |
| Catálogo de funcionalidades | ✅ Completo | `product_features` (100+ features) |
| Planos comerciais | ✅ Base | `saas_plans` (core/intelligence/enterprise) |
| Versionamento de planos | ✅ Base | `saas_plan_versions` + `saas_plan_version_features` |
| Assinaturas | ✅ Base | `organization_subscriptions` |
| Entitlements | ✅ Base | `get_effective_organization_entitlements()` + cache |
| Overrides | ✅ Base | `organization_entitlement_overrides` |
| Add-ons | ✅ Base | `saas_addons` + `saas_addon_features` + `organization_subscription_addons` |
| Trials | ✅ Base | `saas_trials` |
| Uso/consumo | ✅ Base | `organization_usage_records` |
| Enforcement | ✅ Base | `commercial_enforcement_events` + `enforce_resource_limit()` |
| Contratos comerciais | ✅ Base | `saas_contracts` |
| Cache de entitlements | ✅ Completo | `organization_entitlement_cache` |
| Admin UI (planos) | ✅ Completo | `PlatformPlansPage` |
| Admin UI (assinaturas) | ✅ Completo | `PlatformSubscriptionsPage` |
| UI de uso da org | ✅ Completo | `OrganizationUsagePage` |
| Lifecycle de assinatura | ✅ Lógica | `subscriptionLifecycle.ts` (state machine) |
| Product catalog TS | ✅ Completo | `productCatalog.ts` (27 módulos, 120+ features) |
| Entitlement hooks | ✅ Completo | `useOrganizationEntitlements` |
| Backoffice billing | ✅ Base | `billing_records` + `BOFinanceiro` |

### Gaps identificados (o que falta)

| Gap | Severidade | Descrição |
|---|---|---|
| **Legado não consolidado** | Alta | `companies`, `licenses`, `saas_plan_entitlements` ainda em uso |
| **Nomes de plano legados** | Alta | DB usa `starter`/`pro`, frontend mapeia para `core`/`intelligence` |
| **Enforcement backend incompleto** | Alta | Muitos RPCs não validam entitlement |
| **Sem pgTAP comercial** | Alta | Nenhum teste de banco para o módulo comercial |
| **`commercial_audit_logs` vazio** | Média | Tabela definida mas nunca populada |
| **Sem fluxo de downgrade** | Média | `evaluateDowngrade()` existe mas não há UI |
| **Sem fluxo de upgrade** | Média | Não há UI nem lógica de upgrade agendado |
| **Trial lifecycle incompleto** | Média | Tabela existe mas sem CRUD nem enforcement |
| **Sem suspensão/cancelamento UI** | Média | Lógica de state machine existe mas sem tela |
| **Frontend usa `organizations.plan`** | Média | Alguns componentes ainda leem campo legado |
| **Cache invalidation incompleta** | Média | Nem todos os eventos invalidam cache |
| **Sem testes de UI** | Baixa | Nenhum teste de componente para planos/assinaturas |

---

## Fase 1 — Consolidação do Schema e Migração de Legado

### 1.1 Consolidar nomenclatura de planos

**Migrations:**
- Atualizar `saas_plans.code` de `starter`→`core`, `pro`→`intelligence` (já feito no seed `20260722`)
- Atualizar `licenses.plan` para usar novos códigos
- Atualizar `billing_records.plan_type` para usar novos códigos
- Atualizar `organizations.plan` ENUM para incluir `core`, `intelligence`

### 1.2 Depreciar tabelas legadas

**Tabelas a marcar como legadas (não remover):**
- `companies` → `organizations` é canônico
- `licenses` → `organization_subscriptions` é canônico
- `saas_plan_entitlements` → `saas_plan_version_features` é canônico

**Migrations:**
- Adicionar comment nas tabelas legadas: "DEPRECATED: usar tabela equivalente"
- Criar view de compatibilidade se necessário

### 1.3 Preencher `commercial_audit_logs`

**Migration:**
- Criar trigger函数 `log_commercial_audit()` que popula `commercial_audit_logs` para:
  - INSERT/UPDATE/DELETE em `organization_subscriptions`
  - INSERT/UPDATE/DELETE em `saas_contracts`
  - INSERT/UPDATE/DELETE em `saas_trials`
  - INSERT/UPDATE/DELETE em `organization_entitlement_overrides`
  - Mudanças de status de assinatura

### 1.4 Criar pgTAP tests comerciais

**Arquivo:** `supabase/tests/database/13_commercial_entitlements.test.sql`

Testes (~20 asserts):
1. Tabelas existem: `saas_plans`, `saas_plan_versions`, `saas_plan_version_features`, `organization_subscriptions`, `organization_entitlement_overrides`, `product_modules`, `product_features`, `saas_addons`, `saas_trials`, `saas_contracts`, `organization_usage_records`, `commercial_enforcement_events`, `commercial_audit_logs`, `organization_entitlement_cache`
2. RLS habilitado
3. `get_effective_organization_entitlements()` retornando dados
4. `can_use_feature()` retornando boolean
5. `enforce_resource_limit()` bloqueando acima do limite
6. Trigger de audit existe
7. Trigger de cache invalidation existe

---

## Fase 2 — Enforcement Backend Completo

### 2.1 Criar função central `assert_feature_access()`

```sql
CREATE OR REPLACE FUNCTION public.assert_feature_access(
  p_org_id uuid,
  p_feature_code text,
  p_increment numeric DEFAULT 0
) RETURNS void
```

**Fluxo:**
1. Verificar `organization_subscriptions.status` (active/trialing = ok)
2. Verificar `get_effective_organization_entitlements()` (feature enabled)
3. Verificar usage vs limit (se increment > 0)
4. Se falhar: registrar em `commercial_enforcement_events` + raise exception
5. Se ok: registrar warning se próximo do limite

### 2.2 Aplicar enforcement nos RPCs existentes

**RPCs que precisam de enforcement:**
- `save_organization_contract_v3` → `contracts.max`
- `upsert_platform_organization_entitlement_override_v2` → `entitlements.override`
- Qualquer RPC que crie times → `teams.max`
- Qualquer RPC que convide membros → `users.max`
- Qualquer RPC que crie projetos → `projects.max`
- Qualquer RPC de IA → `ai.calls.monthly`

### 2.3 Atualizar invalidação de cache

**Trigger existente:** `trg_org_sub_entitlement_inval` (já existe)
**Trigger existente:** `trg_org_override_entitlement_inval` (já existe)
**Trigger existente:** `trg_org_addon_entitlement_inval` (já existe)

**Adicionar triggers para:**
- `saas_plan_version_features` → invalidar todas as orgs afetadas
- `saas_trials` → invalidar cache da org
- `saas_contracts` → invalidar cache da org

---

## Fase 3 — Frontend: Subscription Lifecycle UI

### 3.1 Página de gestão de assinatura por organização

**Arquivo:** `src/features/organization/pages/OrganizationSubscriptionPage.tsx` (novo)

**Seções:**
1. **Header**: Plano atual, versão, status, vigência
2. **Status**: Badge com cor por status (active=verde, trialing=azul, suspended=vermelho, etc)
3. **Ações**:
   - Alterar plano (abre dialog de seleção)
   - Upgrade/downgrade (com avaliação de conflitos)
   - Suspender
   - Reativar
   - Cancelar (com confirmação)
   - Estender trial
4. **Detalhes**: Contrato, add-ons, overrides, trial
5. **Uso**: Cards de consumo por limite

### 3.2 Dialog de upgrade/downgrade

**Arquivo:** `src/features/organization/components/PlanChangeDialog.tsx` (novo)

**Fluxo:**
1. Selecionar plano destino
2. Avaliar conflitos (`evaluateDowngrade()`)
3. Mostrar conflitos se existirem
4. Opções: agendar, forçar, cancelar
5. Confirmar e executar

### 3.3 Dialog de gerenciamento de trial

**Arquivo:** `src/features/organization/components/TrialManagementDialog.tsx` (novo)

**Ações:**
- Iniciar trial de um plano
- Estender trial
- Converter trial para assinatura
- Cancelar trial

---

## Fase 4 — Observabilidade e Testes

### 4.1 Dashboard de consumo (evolução)

**Arquivo:** `src/features/organization/pages/OrganizationUsagePage.tsx` (editar)

**Adicionar:**
- Gráfico de uso ao longo do tempo (se dados disponíveis)
- Alertas de limite próximo
- Histórico de mudanças de plano
- Detalhamento de add-ons ativos

### 4.2 Testes pgTAP completos

**Arquivo:** `supabase/tests/database/13_commercial_entitlements.test.sql`

~25 asserts cobrindo:
- Schema integrity
- Entitlement resolution
- Usage enforcement
- Cache invalidation
- Audit logging
- Trial lifecycle
- Subscription transitions

### 4.3 Testes unitários

**Arquivo:** `src/saas/subscriptionLifecycle.test.ts` (expandir)
- Testar todas as transições de estado
- Testar evaluateDowngrade com vários cenários
- Testar isEffectivePeriod

---

## Ordem de Execução

1. **Fase 1.4** — pgTAP tests (validar schema atual)
2. **Fase 1.3** — Audit logs (trigger)
3. **Fase 2.1** — Função assert_feature_access()
4. **Fase 2.2** — Enforcement nos RPCs
5. **Fase 2.3** — Invalidação de cache
6. **Fase 1.1** — Consolidação de nomes
7. **Fase 3.1** — Subscription page
8. **Fase 3.2** — Plan change dialog
9. **Fase 3.3** — Trial management
10. **Fase 4** — Observabilidade e testes

## Arquivos a criar/editar

| Ação | Arquivo |
|------|---------|
| Criar | `supabase/migrations/20260723000000_commercial_audit_trigger.sql` |
| Criar | `supabase/migrations/20260723000100_commercial_enforcement_function.sql` |
| Criar | `supabase/tests/database/13_commercial_entitlements.test.sql` |
| Criar | `src/features/organization/pages/OrganizationSubscriptionPage.tsx` |
| Criar | `src/features/organization/components/PlanChangeDialog.tsx` |
| Criar | `src/features/organization/components/TrialManagementDialog.tsx` |
| Editar | `src/features/organization/pages/OrganizationUsagePage.tsx` |
| Editar | `src/saas/subscriptionLifecycle.test.ts` |
