# Axion SaaS — Fase 2A: convites e memberships

## Objetivo

Permitir que owners e administradores gerenciem membros, convites, papéis e módulos dentro da organização ativa.

## Escopo implementado

- convites por e-mail com token one-time armazenado somente como hash;
- validade, reenvio, revogação, aceite e histórico;
- validação do e-mail autenticado;
- memberships ativos e inativos;
- papéis `owner`, `admin` e `member`;
- transferência explícita de ownership;
- módulos vinculados à organização;
- auditoria de alterações;
- entrega de convite por Edge Function;
- tela `/organization/members`;
- tela `/accept-invitation`;
- seletor `/modulos` baseado na organização ativa;
- testes pgTAP e validações de CI.

## Segurança

- o token bruto não é persistido;
- criação e rotação de tokens são restritas ao backend;
- a prévia pública mascara o e-mail;
- apenas o usuário autenticado com o e-mail correto aceita o convite;
- token já aceito não cria membership para outro usuário;
- owners e admins atuam apenas na organização selecionada;
- tabelas internas não são acessadas diretamente pelo frontend;
- owner exige transferência antes de desativação ou rebaixamento;
- membership inativo deixa de conceder acesso;
- permissões legadas só são migradas automaticamente para usuários com uma única organização ativa.

## Compatibilidade

O lote mantém temporariamente as estruturas legadas de usuários e módulos, além de APF, licenses, quotas e tenancy enforcement. `organization_member_modules` passa a ser a fonte tenant-scoped para os módulos da organização.

## Rollout no Lovable Cloud

Executar manualmente no SQL Editor, nesta ordem:

1. `supabase/operations/20260704_02_organization_member_invitations_rollout.sql`
2. `supabase/operations/20260704_02a_organization_member_query_hardening.sql`
3. `supabase/operations/20260704_02b_organization_module_access_runtime.sql`

Resultados obrigatórios:

- `organization_member_invitations_ok = true`
- `organization_member_query_hardening_ok = true`
- `organization_module_access_runtime_ok = true`

Depois dos três resultados positivos, publicar a Edge Function, configurar a URL pública da aplicação, publicar o frontend da `develop` e validar o fluxo com usuários controlados.

## Validação visual

Owner ou administrador:

1. abre o seletor de organização;
2. escolhe **Gerenciar membros**;
3. acessa `/organization/members`;
4. confere membros, papéis, módulos e convites;
5. testa criação, reenvio e revogação de convite;
6. altera módulos de um usuário de teste e confirma o bloqueio por organização.

Usuário convidado:

1. abre o link recebido;
2. visualiza organização, papel e e-mail mascarado;
3. autentica com o mesmo e-mail;
4. aceita o convite;
5. entra no Axion com a nova organização selecionada;
6. visualiza apenas os módulos concedidos.

## Fora do escopo

- cobrança por usuário;
- enforcement de `users.max`;
- remoção definitiva das estruturas legadas;
- painel completo de plano e uso;
- convite público ou cadastro self-service.
