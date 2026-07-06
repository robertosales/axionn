# Axion SaaS — Fase 2A: planos e entitlements

## Objetivo

Criar uma camada canônica de plano, assinatura e entitlement vinculada a `organizations`, mantendo compatibilidade com `licenses` durante a transição.

## Escopo implementado

- catálogo `saas_plans` com `starter`, `pro` e `enterprise`;
- recursos e limites padrão em `saas_plan_entitlements`;
- uma assinatura corrente por organização em `organization_subscriptions`;
- overrides específicos em `organization_entitlement_overrides`;
- backfill não destrutivo a partir de `organizations.plan`;
- preservação dos limites legados de usuários, projetos e contagens APF como overrides;
- RPCs tenant-scoped para plano, entitlements e resumo de uso;
- helpers frontend sem enforcement local definitivo;
- operação manual e idempotente para o Lovable Cloud;
- testes pgTAP e unitários.

## Compatibilidade

Este lote não remove nem substitui `licenses`.

A governança de IA continua utilizando `reserve_ai_usage`, `finalize_ai_usage` e os contadores atuais. O resumo de uso apenas lê `licenses.pf_used_month`, `licenses.ai_calls_used` e `licenses.quota_reset_at` quando a empresa está vinculada de forma direta à organização.

Nenhuma função deste lote incrementa ou redefine contadores.

## Precedência

A resolução efetiva segue:

1. override da organização;
2. entitlement padrão do plano;
3. ausência do recurso.

`limit_value = NULL` no plano representa limite ilimitado. Em overrides, valor nulo preserva o limite do plano.

## Segurança

- RLS está habilitado nas quatro tabelas;
- `anon` não possui acesso;
- `authenticated` lê apenas o catálogo de planos diretamente;
- assinatura e overrides são lidos por RPC tenant-scoped;
- escrita administrativa pertence ao `service_role`;
- funções internas não são executáveis pelo frontend.

## Rollout no Lovable Cloud

Executar manualmente:

`supabase/operations/20260704_01_saas_entitlements_rollout.sql`

Resultado obrigatório:

`saas_entitlements_domain_ok = true`

O arquivo valida a preservação de `licenses`, dos contadores de uso, dos membros e contratos da SALES CONSULTORIA e do estado de tenancy enforcement.

## Fora do escopo

- enforcement dos novos limites nos fluxos operacionais;
- substituição de `licenses`;
- Stripe, checkout, cobrança ou webhooks;
- convites e gestão de memberships;
- páginas de plano e uso;
- preços monetários.
