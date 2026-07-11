# Consolidação — Fase 4C: Keycloak/OIDC e hardening de identidade

**Data:** 11/07/2026  
**Estado:** migration aplicada no Lovable  
**Impacto no login atual:** nenhum

## Diagnóstico

A fundação publicada já possui `identity_providers`, `keycloak_user_mappings` e `auth_audit_events`, mas expõe superfícies incompatíveis com o princípio de menor privilégio:

- `get_default_identity_provider` retorna o tipo composto completo, que inclui `client_secret_encrypted`;
- `sync_keycloak_user` estava concedida a `authenticated` e aceita IDs de usuário/mapeamento;
- `log_auth_audit_event` estava concedida a `authenticated` com parâmetros que permitem atribuir organização, usuário, IP e resultado;
- a policy de insert de auditoria aceitava qualquer linha;
- tabelas sensíveis não tinham revogação explícita de privilégios do frontend.

Não foram encontrados consumidores frontend dessas RPCs legadas. O login atual continua usando Supabase Auth e não será substituído nesta fase.

## Hardening preparado

### Superfícies legadas

As três RPCs legadas ficam restritas a `service_role`:

- `get_default_identity_provider`;
- `sync_keycloak_user`;
- `log_auth_audit_event`.

As tabelas de providers, mappings e auditoria ficam sem acesso direto para `anon` e `authenticated`. O backend mantém CRUD via `service_role`.

### RPC sanitizada

`get_identity_provider_public_config(p_organization_id)` retorna apenas configuração OIDC não secreta:

- issuer e endpoints;
- client ID;
- scopes e claim mapping;
- nome, tipo e indicador default.

Não retorna `client_secret_encrypted` nem `config_json`. Requer autenticação e membership ativa na organização, ou `platform_admin`.

### Readiness administrativo

`get_identity_provider_readiness(p_organization_id)` retorna apenas contagens e um booleano de prontidão. Exige owner/admin da organização ou `platform_admin`.

O readiness exige:

- ao menos um provider ativo;
- exatamente um provider default ativo;
- issuer e client ID preenchidos;
- nenhum mapping em erro.

## Ordem manual no Lovable

### 1. Preflight somente leitura

Execute:

`supabase/audits/20260711_01_identity_provider_security_preflight.sql`

Preserve os resultados. Linhas no terceiro result set indicam organizações com mais de um provider default ativo e devem ser analisadas antes de ativar SSO, mas não impedem o hardening de privilégios.

### 2. Migration

Execute:

`supabase/migrations/20260711090000_identity_provider_security_hardening.sql`

Resultado esperado:

```text
identity_provider_security_hardening_ok = true
```

### 3. Validação somente leitura

Execute:

`supabase/audits/20260711_02_identity_provider_security_validation.sql`

Todos os booleanos do primeiro result set devem retornar `true`.

## Preservação e rollback

- Nenhuma tabela ou linha é removida.
- Nenhum provider é ativado/desativado.
- Nenhum mapping é alterado.
- Supabase Auth, login por senha, reset e callback continuam iguais.
- A migration não configura Keycloak no provedor de autenticação externo.

Se um consumidor externo legítimo ainda usar uma RPC legada com JWT de usuário, ele deverá migrar para backend `service_role` ou para a RPC sanitizada. Não restaure os grants amplos sem identificar e corrigir esse consumidor.

## O que ainda falta para ativar Keycloak

1. configurar o provider OIDC no ambiente de autenticação suportado pelo Lovable/Supabase;
2. definir redirect URIs e logout URI;
3. armazenar client secret no mecanismo seguro do ambiente;
4. validar claims `sub`, `email`, grupos e roles;
5. implementar descoberta/seleção de organização antes do login sem expor tenants;
6. testar JIT/provisionamento, desativação, refresh, logout e rollback;
7. executar canário com uma organização antes de qualquer obrigatoriedade de SSO.

Até esses gates, o login atual permanece como autoridade e fallback operacional.

## Validação local

- contratos de segurança Keycloak/OIDC: 4 testes aprovados;
- contratos de integrações: 4 testes aprovados;
- suíte completa: 20 arquivos e 137 testes aprovados;
- build de produção: aprovado;
- `git diff --check`: aprovado.

## Confirmação operacional

O responsável confirmou em 11/07/2026 que a migration de hardening foi aplicada no Lovable. A ativação de SSO continua fora do escopo até a conclusão dos gates de configuração e canário.
