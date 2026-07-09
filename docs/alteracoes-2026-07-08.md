# Alterações de 08/07/2026

## Resumo

Na branch `develop`, foram realizados 27 commits, alterando 40 arquivos, com
6.260 adições e 95 remoções.

## Administração global da plataforma

- Criado o console global de administração de planos SaaS.
- Implementada gestão de assinaturas por organização.
- Adicionado controle de status, períodos de cobrança e trials.
- Criada gestão de limites e overrides de recursos.
- Adicionada configuração global de provedores de inteligência artificial.
- Criadas rotas `/platform/*` protegidas por permissão de administrador da
  plataforma.

## Backoffice Axionn

- Criada a fundação do Backoffice interno da Roberto Sales LTDA.
- Adicionados perfis próprios:
  - administrador;
  - financeiro;
  - suporte;
  - comercial;
  - desenvolvimento.
- Criado dashboard com indicadores de clientes, assinaturas e equipe.
- Implementada gestão de funcionários internos.
- Criada auditoria de ações administrativas.
- Adicionados guard, autenticação e layout independentes da organização ativa.
- Criada lista de clientes com busca e paginação.
- Adicionada abertura direta da assinatura do cliente selecionado.
- Integrada a gestão de assinaturas ao menu lateral do Backoffice.

## Central Axionn e navegação

- O dono do produto não é mais redirecionado diretamente para
  `/platform/plans`.
- Criada a Central Axionn para seleção consciente do ambiente.
- Adicionados cards condicionados às permissões:
  - Sala Ágil;
  - Sustentação;
  - RDM;
  - Administrador;
  - Backoffice Axionn;
  - Configuração da plataforma.
- Adicionada a ação **Trocar ambiente** nos diferentes layouts.
- Corrigida a navegação entre Administrador, Backoffice e Plataforma.

## Seletor de módulos

- Substituído o seletor horizontal por um dropdown semelhante ao seletor de
  times.
- O seletor agora considera as permissões efetivas da organização.
- São apresentados somente os módulos permitidos ao usuário.
- Mantido o funcionamento com a barra lateral aberta ou recolhida.
- Adicionada a opção Administrador somente para usuários autorizados.
- Removida a apresentação de identificadores técnicos como `sala_agil`.
- O contexto do perfil passou a usar textos como
  `Sala Ágil · Administrador`.

## Administração de usuários e times

- Corrigida a gestão de times legados sem `org_id`.
- Criado hook central de permissões para gestão de times.
- Melhorado o tratamento de erros operacionais.
- Corrigida a listagem de usuários para administradores da organização.
- A tela de perfis passou a usar o RPC organizacional mesmo quando o fallback
  legado está ativo.
- Adicionada compatibilidade com usuários vinculados por:
  - organização;
  - contrato;
  - time;
  - registro de desenvolvedor;
  - perfil legado.
- Criado diagnóstico específico para escopo de usuários e contratos.

## Permissões e isolamento organizacional

- Administradores podem consultar recursos dos times da própria organização
  sem a necessidade de vínculo redundante em `team_members`.
- O hardening de leitura foi aplicado às seguintes áreas:
  - times e membros;
  - sprints;
  - backlog;
  - épicos;
  - atividades;
  - impedimentos;
  - anexos;
  - fluxos;
  - campos personalizados;
  - automações;
  - releases;
  - SLA;
  - APF;
  - Planning Poker;
  - Retrospectiva.
- As permissões permanecem isoladas por organização.
- Nenhuma permissão de escrita foi ampliada pelo hardening de leitura.

## Histórico Ágil

- Liberada a leitura do histórico de Planning Poker e Retrospectiva para
  administradores da organização.
- Incluída leitura dos detalhes relacionados:
  - votos;
  - rodadas;
  - participantes;
  - cartões;
  - ações.
- A tela deixou de transformar falhas de autorização em uma lista vazia.
- Erros de carregamento agora são apresentados explicitamente ao usuário.

## Banco de dados

Principais migrations adicionadas:

- `20260708122103_4de0afa1-44b9-4b75-9478-cdfeb681d503.sql`
- `20260708133000_platform_plan_management.sql`
- `20260708143000_backoffice_foundation.sql`
- `20260708200000_organization_members_include_contract_members.sql`
- `20260708201000_agile_history_organization_admin_read.sql`
- `20260708202000_organization_admin_team_scoped_read.sql`

## Documentação e diagnósticos

- Criada a especificação técnica completa do Backoffice.
- Documentado o MVP do Backoffice.
- Atualizada a documentação da gestão SaaS.
- Adicionados scripts de diagnóstico para membros de times e escopo
  organizacional.

## Validação

- Build de produção executado com sucesso.
- Suítes executadas com até 64 testes aprovados.
- Verificações de diff concluídas sem erros.
- A branch `develop` estava com a árvore de trabalho limpa ao final do
  levantamento.
