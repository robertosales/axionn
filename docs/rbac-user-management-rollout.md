# RBAC e gestão de usuários — rollout e validação

## Escopo

Este pacote corrige a quebra de autoridade observada após o cutover de tenancy:

- inclusão usa convite organizacional em vez de `auth.signUp` no navegador;
- edição de nome, módulos e status do vínculo usa RPC tenant-scoped;
- ativação/inativação organizacional não bloqueia globalmente a conta;
- bloqueio global no Auth permanece exclusivo do administrador de plataforma;
- indisponibilidade do resolvedor de fallback fecha os writes legados;
- todas as mutações organizacionais são auditadas.

## Ordem de aplicação

1. Confirmar que as migrations de memberships e autoridade organizacional estão aplicadas.
2. Aplicar `20260730210000_organization_member_rbac_management.sql`.
3. Executar `20260730_04_organization_member_rbac_validation.sql`.
4. Exigir `organization_member_rbac_validation_ok = true`.
5. Publicar o frontend em canário.
6. Executar a matriz funcional abaixo.

## Matriz funcional

| Ator | Incluir | Alterar módulos | Inativar vínculo | Bloquear conta global |
|---|---:|---:|---:|---:|
| Platform admin | Sim | Sim | Sim | Sim |
| Organization owner | Sim | Sim | Sim, exceto a si próprio | Não |
| Organization admin | Sim | Sim | Sim, exceto owner e a si próprio | Não |
| Member | Não | Não | Não | Não |
| Usuário externo | Não | Não | Não | Não |

Validar também:

- convite de usuário novo e de conta já existente;
- atualização imediata da lista após cada mutação;
- reativação de vínculo;
- edição de usuário pertencente a mais de uma organização;
- tentativa cross-tenant;
- tentativa de inativar o owner;
- tentativa de autoelevação;
- desativação em lote com resultado por usuário;
- auditoria com ator, tenant, alvo e estados anterior/posterior.

## Semântica de status

`organization_members.is_active` controla o acesso à organização selecionada.
`profiles.is_active` e o estado no Supabase Auth controlam a conta global.

Uma ação de organization admin nunca deve alterar o status global, pois a mesma
conta pode participar de outros tenants. O bloqueio global continua no fluxo
administrativo de plataforma, que sincroniza perfil e Auth com compensação em caso
de falha.

## Rollback

1. Não remover a função nem apagar auditoria.
2. Reverter o frontend para direcionar a gestão ao console de membros.
3. Preservar a migration; correções devem ser aditivas.
4. Se necessário, reativar somente memberships afetadas por uma operação
   comprovadamente incorreta, mediante migration/operacão auditada.
