# Fase 2B — Console Operacional Tenant-Scoped

## Objetivo

A Fase 2B separa a administração da organização da administração global da plataforma. O console organizacional concentra operações do tenant ativo, enquanto provedores globais de IA e futuras operações comerciais permanecem restritos a `platform_admin`.

## Conceitos

- `organizations`: tenant SaaS. Exemplo preservado: SALES CONSULTORIA.
- `companies`: empresas clientes cadastradas dentro de uma organização.
- `organization_members`: autoridade para owner, admin e member do tenant.
- `organization_member_modules`: módulos permitidos dentro do tenant.
- `platform_user_roles`: autoridade global da plataforma.

`profiles.module_access`, `user_roles` e `user_module_roles` não são fontes de autoridade para o console operacional tenant-scoped.

## Rotas

Console organizacional:

- `/organization/admin`
- `/organization/companies`
- `/organization/contracts`
- `/organization/projects`
- `/organization/teams`
- `/organization/members`
- `/organization/usage`
- `/organization/settings`

Console global:

- `/platform`
- `/platform/ai-providers`

O `/dashboard-admin` permanece como fallback temporário enquanto `legacy_operational_admin_fallback_enabled = true`.

## Autorização

Administração da organização:

- `organization_members.role = owner`;
- `organization_members.role = admin`;
- `platform_admin` no contexto explicitamente selecionado.

Administração global:

- somente `platform_user_roles.role = platform_admin`;
- ou `public.is_platform_admin(auth.uid())`.

Os guards falham fechados quando a organização, membership ou autoridade global não podem ser confirmados.

## Implementação consolidada

### Shell e navegação

- shell responsivo com navegação lateral;
- contexto da organização à esquerda;
- seletor de organização, menu da conta e tema agrupados no topo;
- logout dentro do menu da conta;
- limpeza de estado ao trocar de tenant pelo `OrganizationContext`;
- platform admin direcionado ao console global;
- owner/admin direcionado ao console organizacional;
- fallback legado controlado por flag operacional.

### Empresas clientes

- página tenant-scoped específica;
- criação, edição e inativação por RPC;
- `org_id` definido pelo backend;
- CNPJ validado;
- sem hard delete no modo organizacional;
- licença legada removida da edição organizacional;
- plano e cotas direcionados para **Plano e uso**.

### Contratos

- leitura tenant-scoped;
- criação e atualização transacionais por `save_organization_contract_v3`;
- validação de empresa, times e projetos do mesmo tenant;
- atualização dos vínculos na mesma transação;
- arquivamento sem hard delete;
- `contracts.max` preservado pelo trigger existente;
- mensagens de limite convertidas para linguagem de negócio.

### Projetos

- leitura tenant-scoped;
- criação, edição e arquivamento por RPC;
- contrato e time validados no backend;
- `projects.max` preservado;
- projeto arquivado não consome o limite.

### Times

- leitura administrativa tenant-scoped;
- criação e edição por RPC;
- empresa e contrato validados no backend;
- inativação por `is_active`, sem hard delete;
- `contract_teams` preservada e não recriada.

### Usuários

A navegação reutiliza `/organization/members` e mantém como autoridade:

- `organization_members.role`;
- `organization_member_modules`;
- `platform_user_roles` apenas para administração global.

### IA global

- rota separada `/platform/ai-providers`;
- guard exclusivo de `platform_admin`;
- listagem sem `vault_secret_id` ou valor de chave;
- criação, edição, arquivamento e atualização de chave por RPC;
- chave nunca é devolvida ao frontend;
- auditoria global sem armazenar o segredo.

## Banco e migrations

Base do console:

- `supabase/operations/20260704_07_organization_operational_console_rollout.sql`

Hardening complementar:

- `supabase/migrations/20260704080000_organization_operational_console_hardening.sql`
- `supabase/migrations/20260704080100_platform_ai_provider_hardening.sql`
- `supabase/operations/20260704_08_organization_operational_console_hardening_validation.sql`

As migrations complementares não alteram `tenancy_enforcement`, assinaturas, quotas, APF, contratos existentes ou memberships existentes.

## Feature flags

Em `public.saas_runtime_settings`:

- `organization_operational_console_enabled`: inicia como `false`;
- `legacy_operational_admin_fallback_enabled`: inicia como `true`.

Fluxo:

1. instalar backend;
2. publicar frontend;
3. validar com fallback ligado;
4. ativar o console;
5. fazer canary com SALES CONSULTORIA;
6. desligar o fallback somente depois da validação;
7. manter rollback disponível.

## Auditoria

`organization_operational_audit_log` registra:

- `company_created`, `company_updated`, `company_archived`;
- `contract_created`, `contract_updated`, `contract_archived`;
- `project_created`, `project_updated`, `project_archived`;
- `team_created`, `team_updated`, `team_deactivated`.

`platform_operational_audit_log` registra operações globais de provedores de IA sem armazenar API keys, tokens ou `vault_secret_id`.

## Testes

O repositório contém:

- pgTAP para isolamento do console, projetos, times e administração global de IA;
- teste frontend para tradução de erros tenant-scoped;
- replay integral de migrations pelo workflow de startup;
- builds separados para modo legado e tenant.

## SALES CONSULTORIA

Preservar:

- `org_id`: `d7f226d9-9f08-43a7-b565-482cca58f00d`;
- nome: `SALES CONSULTORIA`;
- slug: `sales-consultoria`;
- plano: `enterprise`;
- status: `active`.

Roberto (`3c472f37-eabb-4a95-a859-1a1cf89f5d37`) deve permanecer owner/admin ativo da organização ou `platform_admin`.

## Pendências operacionais, não de código

- executar os SQLs manualmente no Lovable Cloud;
- publicar o frontend da `develop`;
- executar smoke test com SALES CONSULTORIA e Roberto;
- validar cadastros controlados de empresa, contrato, projeto e time;
- desligar o fallback somente depois do canary;
- executar post-validation.

Nenhum SQL remoto é executado pelo repositório ou pelos workflows.
