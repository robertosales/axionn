# Fase 2B - Console Operacional Tenant-Scoped

## Objetivo

A Fase 2B separa a administracao da organizacao da administracao global da
plataforma. O console organizacional passa a concentrar operacoes do tenant
ativo, enquanto recursos globais, como provedores de IA e futuras operacoes
financeiras, ficam restritos a `platform_admin`.

## Conceitos

- `organizations`: tenant SaaS. Exemplo preservado: SALES CONSULTORIA.
- `companies`: empresas clientes cadastradas dentro de uma organizacao.
- `organization_members`: autoridade para owner, admin e member do tenant.
- `organization_member_modules`: modulos permitidos dentro do tenant.
- `platform_user_roles`: autoridade global da plataforma.

`profiles.module_access`, `user_roles` e `user_module_roles` nao devem ser
fonte de autoridade para administracao global ou operacional no cutover.

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

Console global da plataforma:

- `/platform`
- `/platform/ai-providers`

O `/dashboard-admin` permanece como fallback temporario ate o desligamento
controlado da flag `legacy_operational_admin_fallback_enabled`.

## Autorizacao

Administracao da organizacao:

- `organization_members.role = owner`
- `organization_members.role = admin`
- `platform_admin`

Administracao global:

- somente `platform_user_roles.role = platform_admin`
- ou `public.is_platform_admin(auth.uid())`

O guard do console organizacional falha fechado quando nao existe organizacao
ativa. O guard de plataforma nao aceita admin organizacional comum.

## Estado Atual Da Implementacao

Implementado nesta etapa:

- preflight somente leitura;
- shell inicial do console organizacional;
- visao geral operacional tenant-scoped;
- rotas organizacionais para empresas, contratos, projetos, times, membros,
  uso e configuracoes;
- rota `/platform/ai-providers` separada;
- operacoes manuais de rollout, enable, disable fallback, rollback e
  post-validation;
- audit log operacional generico;
- RPCs tenant-scoped para criar, editar e inativar empresas;
- RPCs tenant-scoped para criar e arquivar contratos;
- redirecionamento das rotas legadas quando
  `organization_operational_console_enabled` estiver ativa;
- traducao de erros tecnicos de limites/cross-tenant para mensagens de
  negocio no console operacional.

Ainda requer hardening nos lotes seguintes:

- substituir as mutations restantes de projetos, times e vinculos auxiliares
  por RPCs tenant-scoped especificas;
- ampliar pgTAP;
- ampliar testes frontend;
- sanitizar totalmente operacoes de IA no backend com RPCs/platform policies.

## Feature Flags

As flags ficam em `public.saas_runtime_settings`:

- `organization_operational_console_enabled`: inicia como `false`.
- `legacy_operational_admin_fallback_enabled`: inicia como `true`.
- O rollout preserva o valor atual das duas flags quando reexecutado. Se o
  console ja estiver ativo por execucao anterior do enable, o rollout nao deve
  tentar voltar a flag para `false`.

O rollout cria funcoes seguras:

- `is_organization_operational_console_enabled()`
- `set_organization_operational_console(boolean)`
- `is_legacy_operational_admin_fallback_enabled()`
- `set_legacy_operational_admin_fallback(boolean)`
- `create_organization_company_v2(...)`
- `update_organization_company_v2(...)`
- `archive_organization_company_v2(...)`
- `create_organization_contract_v2(...)`
- `archive_organization_contract_v2(...)`

Somente `service_role`, `platform_admin` ou SQL Editor administrativo podem
alterar essas flags.

## Auditoria

O rollout cria `public.organization_operational_audit_log` para eventos:

- `company_created`, `company_updated`, `company_archived`
- `contract_created`, `contract_updated`, `contract_archived`
- `project_created`, `project_updated`, `project_archived`
- `team_created`, `team_updated`, `team_deactivated`

Nao armazenar API keys, tokens, secrets ou payloads sensiveis.

## Fail-Closed

Erros de RPC, ausencia de organizacao ativa ou ausencia de membership/admin
nao concedem acesso. O frontend deve transformar erros tecnicos em mensagens de
negocio antes de exibir ao usuario.

## SALES CONSULTORIA

Preservar:

- `org_id`: `d7f226d9-9f08-43a7-b565-482cca58f00d`
- nome: `SALES CONSULTORIA`
- slug: `sales-consultoria`
- plano: `enterprise`
- status: `active`

Roberto (`3c472f37-eabb-4a95-a859-1a1cf89f5d37`) deve manter acesso
operacional como admin/owner da organizacao ou como `platform_admin`.

## Riscos Conhecidos

- Projetos, times e alguns vinculos auxiliares ainda dependem de policies/RLS
  e precisam de RPCs especificas para fechar o hardening completo.
- Algumas telas reutilizadas ainda mostram textos de "excluir"; o backend/RLS
  deve impedir operacoes inseguras durante o fallback.
- Provedores de IA foram separados por rota/guard, mas o hardening completo
  de mutations deve ser concluido em lote posterior.
