# Axion SaaS — Fase 2A: convites e memberships

## Objetivo

Permitir que owners e administradores gerenciem o acesso à própria organização sem depender do papel global legado `admin`.

## Escopo implementado

- convites por e-mail com token one-time armazenado apenas como hash;
- validade, reenvio, revogação, aceite e histórico do convite;
- validação de que o usuário autenticado possui o mesmo e-mail convidado;
- memberships ativos e inativos;
- papéis `owner`, `admin` e `member`;
- transferência explícita de ownership;
- permissões de módulos vinculadas à organização;
- auditoria de alterações de acesso;
- Edge Function para entrega via convite Auth ou magic link;
- página `/organization/members` para gestão visual;
- página `/accept-invitation` para aceite;
- RPCs tenant-scoped e testes pgTAP.

## Segurança

- o token bruto nunca é persistido;
- somente a Edge Function com `service_role` cria ou rotaciona tokens;
- `anon` pode consultar apenas uma prévia mascarada do convite;
- somente usuário autenticado com o e-mail correto aceita o convite;
- owners e admins gerenciam apenas a organização selecionada;
- tabelas de convite, módulos e auditoria não têm acesso direto pelo frontend;
- owner não pode ser desativado ou rebaixado sem transferência de ownership;
- usuário não pode desativar o próprio membership;
- memberships inativos deixam de conceder acesso nas funções centrais de tenancy.

## Compatibilidade

Este lote mantém:

- `user_roles`;
- `user_contracts`;
- `team_members`;
- `user_module_roles`;
- `profiles.module_access`;
- fluxo atual de APF;
- licenses e quotas;
- estado atual do tenancy enforcement.

`organization_member_modules` é a fonte nova para módulos dentro da organização. A remoção das estruturas legadas ocorrerá em lote posterior, após migração e validação dos fluxos existentes.

## Fluxo do convite

1. owner/admin informa e-mail, papel e módulos;
2. Edge Function valida a sessão do administrador;
3. banco cria o convite e retorna o token bruto somente ao `service_role`;
4. Edge Function envia convite Auth para usuário novo ou magic link para usuário existente;
5. link direciona para `/accept-invitation?token=...`;
6. usuário autentica com o mesmo e-mail;
7. RPC cria ou reativa o membership e aplica os módulos;
8. convite passa para `accepted` e registra auditoria.

## Configuração no Lovable Cloud

A Edge Function utiliza as credenciais gerenciadas pelo ambiente:

- `SUPABASE_URL`;
- `SUPABASE_SERVICE_ROLE_KEY` ou `SUPABASE_SECRET_KEYS`;
- `SUPABASE_ANON_KEY` ou `SUPABASE_PUBLISHABLE_KEYS`;
- `PUBLIC_SITE_URL` ou `SITE_URL`.

Opcionalmente, `EXPOSE_ORGANIZATION_INVITE_LINKS=true` expõe o link no retorno da função para testes controlados. Deve permanecer desligado em produção.

## Fora do escopo

- cobrança por usuário;
- enforcement de `users.max`;
- remoção automática do vínculo contratual legado criado no signup;
- gestão completa de configurações, plano e uso da organização;
- remoção de `profiles.module_access` e `user_module_roles`;
- convite público ou cadastro self-service.
