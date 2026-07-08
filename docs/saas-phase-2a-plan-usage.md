# Axion SaaS — Fase 2A / Lote 3: plano e uso

## Objetivo

Expor para owners e administradores a assinatura corrente, os limites efetivos e o consumo da organização ativa.

## Escopo implementado

- rota protegida `/organization/usage`;
- navegação **Plano e uso** no seletor da organização;
- identificação do plano e do status da assinatura;
- consumo de usuários, projetos, contratos, contagens APF e chamadas de IA;
- limites efetivos considerando plano e overrides da organização;
- data de renovação das cotas quando disponível;
- lista de recursos habilitados e respectiva origem;
- atualização manual dos dados;
- acesso restrito a owner, admin da organização e platform admin.

## Fontes de dados

A tela utiliza os RPCs do Lote 1:

- `get_organization_usage_summary(uuid)`;
- `get_my_organization_entitlements(uuid)`.

Nenhum contador é alterado por esta tela.

## Validação visual

1. abrir o seletor da organização;
2. clicar em **Plano e uso**;
3. confirmar a organização ativa no cabeçalho;
4. conferir plano, status, consumo e limites;
5. confirmar que os valores de usuários, projetos e contratos correspondem ao tenant ativo;
6. trocar de organização e repetir a validação.

## Próximos lotes

- Lote 4: enforcement transacional de `users.max`, `projects.max` e `contracts.max`;
- Lote 5: configurações editáveis da organização e auditoria;
- Lote 6: migração final e retirada controlada das permissões legadas.

## Complemento: administração global de planos

O console organizacional continua sendo somente leitura para plano e uso. A
gestão do catálogo de planos, recursos, assinaturas e overrides pertence ao
console global de plataforma:

- `/platform/plans`: cadastro, edição, arquivamento e recursos do plano;
- `/platform/subscriptions`: plano aplicado por organização, status da
  assinatura e overrides específicos.

As mutações usam RPCs `security definer` exclusivas de `platform_admin` e
registram auditoria em `platform_operational_audit_log`.
