# Axionn

Plataforma de Engineering Intelligence para gestão de engenharia, agilidade, sustentação, mudanças, contratos, métricas e automações com IA.

## Visão geral

O Axionn é uma aplicação SaaS multi-tenant. A organização é a fronteira de isolamento dos dados; contratos definem módulos e limites; projetos, times e membros determinam o escopo operacional.

Módulos principais:

- Sala Ágil: backlog, HUs, sprints, kanban, planning poker, retrospectivas e relatórios;
- Sustentação: demandas, SLAs, IMR e indicadores operacionais;
- RDM: mudanças, checklists, go/no-go e auditoria;
- APF e IA: contagem, baseline, análise, aprendizagem e briefing;
- Administração: organizações, empresas, contratos, projetos, times e membros;
- Plataforma e backoffice: planos, assinaturas, provedores de IA, faturamento e suporte;
- Integrações: fundações para Git/GitLab, Teams, Redmine, Oracle, APEX, Keycloak e 3Scale.

## Stack

- React 18, TypeScript e Vite;
- React Router e TanStack Query;
- Tailwind CSS, shadcn/ui e Radix UI;
- Supabase Auth, PostgreSQL, RLS, RPCs e Edge Functions;
- Vitest para testes de frontend/domínio;
- pgTAP para contratos e isolamento do banco.

## Estrutura

```text
src/
├── backoffice/          # operação interna da plataforma
├── components/          # componentes compartilhados e legado em consolidação
├── contexts/            # autenticação, organização e sprint
├── features/            # domínios funcionais
├── integrations/        # clientes e tipos de integrações
├── lib/                 # infraestrutura do frontend
├── pages/               # entradas de rota
└── shared/              # componentes, hooks e constantes comuns

supabase/
├── functions/           # Edge Functions
├── migrations/          # histórico SQL publicado
├── operations/          # rollouts manuais e validações operacionais
├── audits/              # consultas somente leitura
└── tests/               # pgTAP e gates de staging
```

## Desenvolvimento local

Pré-requisitos:

- Node.js compatível com o `package-lock.json`;
- npm;
- variáveis Supabase de um ambiente de desenvolvimento autorizado.

```sh
npm install
npm run dev
```

Variáveis esperadas pelo frontend:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Não adicione secrets ao repositório. Credenciais privilegiadas e chaves de integrações devem permanecer no ambiente seguro/Vault e ser acessadas somente pelo backend.

## Validação

```sh
npm test
npm run lint
npm run build
```

O lint possui dívida histórica registrada. Novas mudanças não devem introduzir erros; avisos devem ser reduzidos gradualmente por domínio, sem correções mecânicas em massa.

Os testes pgTAP exigem banco local ou staging isolado. Nunca execute testes que escrevem dados diretamente no Lovable Cloud de produção.

## Banco e migrations

As migrations existentes representam histórico já publicado e não devem ser renomeadas, reordenadas ou reescritas retroativamente.

Para mudanças futuras:

1. crie uma migration nova, com versão única e posterior às existentes;
2. preserve dados e objetos em funcionamento;
3. inclua preflight e validação pós-execução;
4. prefira alterações incrementais e idempotentes;
5. documente ordem, resultado esperado e rollback;
6. aplique manualmente pelo fluxo autorizado do Lovable.

Arquivos em `supabase/operations` são procedimentos operacionais e não devem ser repetidos quando já houver evidência de execução.

## Autorização

- O frontend usa guards para navegação e experiência do usuário.
- RLS, RPCs e Edge Functions são a autoridade final para operações sensíveis.
- `platform_admin` é o papel de suporte entre organizações.
- Owners/admins de organização administram somente seu tenant.
- Papéis de contrato, projeto, time e módulo devem manter escopo mínimo.

Não contorne RLS com consultas no cliente nem use permissões visuais como mecanismo único de segurança.

## Documentação operacional

- `docs/revisao_tecnica_funcional_axionn_2026-07-10.md`: diagnóstico e arquitetura recomendada;
- `docs/consolidacao-fase-0-baseline-2026-07-10.md`: baseline e gates de segurança;
- `docs/saas-remote-rollout-status.md`: estado operacional do rollout SaaS;
- `docs/saas-remote-rollout-runbook.md`: sequência, validações e rollback;
- `docs/security.md`: controles e práticas de segurança.

## Regra de preservação

Antes de alterar tabelas, papéis, rotas ou integrações, mapeie consumidores e impacto. Funcionalidades existentes devem evoluir por compatibilidade, canário, observabilidade e rollback — nunca por substituição abrupta.
