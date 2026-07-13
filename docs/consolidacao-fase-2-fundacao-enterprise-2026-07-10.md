# Consolidação — Fase 2: fundação enterprise

**Data:** 10/07/2026  
**Estado:** implementação local concluída; validação remota pendente  
**Migration:** nenhuma  
**SQL para executar:** 1 auditoria somente leitura

## Resultado da análise

A fundação enterprise de autorização já existe e não deve ser recriada:

1. `platform_user_roles` é a autoridade para papéis globais da plataforma;
2. `organization_members` é a autoridade para vínculo e papel no tenant;
3. `organization_member_modules` é a autoridade para acesso aos módulos do tenant;
4. `user_roles`, `user_module_roles` e `profiles.module_access` são fontes legadas preservadas para compatibilidade/rollback;
5. `organization_legacy_permission_fallback_enabled` controla o fallback;
6. com tenancy ligada e fallback desligado, falhas da RPC fecham o acesso;
7. RLS/RPC/Edge Functions permanecem como autoridade final; guards do frontend não substituem segurança server-side.

## Mudanças realizadas

### Contrato de autorização ampliado

Foram adicionados dois testes a `organizationAccess.test.ts`:

- uma resposta bem-sucedida da RPC organizacional sem o módulo não pode voltar ao legado, mesmo com fallback habilitado;
- papel organizacional `member` não pode ser promovido implicitamente para `admin`.

Total da suíte após a mudança: 129 testes aprovados.

### Auditoria enterprise somente leitura

Foi criado:

`supabase/audits/20260710_01_enterprise_permission_authority_health.sql`

O arquivo não cria nem altera dados ou objetos. Ele verifica:

- estado do enforcement e fallback;
- existência de `platform_admin`;
- módulos órfãos;
- memberships sem módulos;
- módulos/papéis inválidos;
- usuários multi-organização sem módulos explícitos;
- admins legados sem papel de plataforma;
- organizações sem owner/admin ativo;
- existência das tabelas e RPCs canônicas.

## Ordem de execução manual

No SQL Editor do Lovable, execute somente:

1. `supabase/audits/20260710_01_enterprise_permission_authority_health.sql`

O script retorna dois result sets. Preserve e envie ambos.

### Resultado esperado

- `enterprise_permission_authority_health_ok = true`;
- `platform_admins >= 1`;
- `orphan_modules = 0`;
- `invalid_module_roles = 0`;
- `organizations_without_active_admin = 0`.

As linhas `members_without_modules` e `admin_members_without_modules` são de revisão, pois podem representar configuração intencional. `multi_org_without_explicit_modules` e `legacy_admins_without_platform_role` bloqueiam a retirada definitiva do fallback, mas não justificam correção automática.

## Validação local

| Verificação | Resultado |
|---|---|
| Teste isolado de autoridade | 15 testes aprovados |
| Suíte completa | 18 arquivos, 129 testes aprovados |
| ESLint dos arquivos alterados | Aprovado |
| Build de produção | Aprovado |
| Migration existente alterada | Não |

## Próxima decisão

- Se a auditoria retornar saudável, a Fase 2 pode ser encerrada sem migration.
- Se houver inconsistências, será criada uma nova migration incremental específica para os resultados reais, sem alterar migrations publicadas.
- Nenhum fallback será desligado automaticamente.
- A Fase 3 só deve começar após classificar o resultado dessa auditoria.
