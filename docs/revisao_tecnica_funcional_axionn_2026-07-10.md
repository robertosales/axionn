# Revisão técnica e funcional do Axionn

**Data da revisão:** 10/07/2026  
**Escopo:** código e documentação presentes no repositório local  
**Método:** inspeção estática do frontend, migrações, Edge Functions, testes e documentação; execução da suíte Vitest e do build de produção.

## 1. Sumário executivo

O Axionn já não é apenas um protótipo de telas. O repositório contém uma plataforma funcional baseada em React/Vite e Supabase/PostgreSQL, com módulos de Sala Ágil, Sustentação, RDM, APF/IA, contratos, projetos, organizações, administração, backoffice, relatórios e OKRs. Também existe uma fundação enterprise significativa: organizações, memberships, contratos, planos, entitlements, isolamento por `org_id`, auditoria e papéis de plataforma.

A principal conclusão é que grande parte da visão descrita como futura já foi modelada ou implementada no código. Entretanto, existência de migrations, telas ou Edge Functions não equivale a prontidão operacional. Keycloak, Git/GitLab, DORA, predição de risco, Teams, Redmine, Oracle, APEX, 3Scale e telemetria possuem fundações no repositório, mas precisam de evidência de implantação, configuração, testes de integração e observabilidade em staging antes de serem classificados como prontos para produção.

O maior risco arquitetural não é a ausência de recursos, e sim a coexistência de modelos legados e novos: `projetos` e `projects`, papéis globais e memberships organizacionais, `user_roles`, `user_module_roles`, `user_contracts`, `contract_members` e `organization_members`, além de flags de compatibilidade. Essa transição foi planejada com cuidado, mas ainda exige consolidação gradual e gates de dados.

**Recomendação:** não criar uma segunda fundação enterprise. Consolidar a existente, validar o isolamento multitenant em staging, catalogar o estado real das migrations por ambiente, retirar fallbacks somente com métricas e então ativar integrações em ondas pequenas.

## 2. Evidências e limites da revisão

### Evidências verificadas

- 295 arquivos de migration em `supabase/migrations`.
- 17 Edge Functions.
- 360 arquivos TSX e 224 arquivos TS no frontend.
- Rotas protegidas para módulos operacionais, organização, plataforma e backoffice.
- RLS, RPCs e testes SQL de isolamento organizacional.
- 18 arquivos de teste Vitest, totalizando 127 testes aprovados.
- Build de produção aprovado.
- Worktree limpo no início da revisão.

### Limites

Esta revisão não acessou banco remoto, secrets, logs de produção, Keycloak, GitLab, Teams, Oracle, APEX, Redmine ou 3Scale reais. Portanto:

- migrations presentes não provam que foram aplicadas em todos os ambientes;
- RLS presente no SQL não prova isolamento no banco remoto;
- Edge Function presente não prova deploy, secret válido ou conectividade;
- telas presentes não provam fluxo E2E completo;
- a qualidade e consistência dos dados existentes só podem ser confirmadas por preflight em staging/produção.

## 3. Diagnóstico técnico atual

### 3.1 Arquitetura geral

| Camada | Estado atual | Avaliação |
|---|---|---|
| Frontend | React 18, Vite, TypeScript, React Router, TanStack Query, shadcn/Radix, Tailwind | Base moderna e reutilizável |
| Backend | Supabase Auth, PostgreSQL, RPCs, RLS e Edge Functions Deno | Adequado ao estágio atual; precisa governança de contratos de API |
| Dados | Modelo operacional amplo e fundação SaaS/multitenant | Maduro, porém com legado e alta complexidade de migrations |
| Autenticação | Supabase Auth, callback, reset, troca obrigatória de senha e sessão | Funcional; federação Keycloak ainda deve ser validada ponta a ponta |
| Autorização | Guards no frontend + papéis/memberships/RLS no banco | Boa defesa em profundidade, mas há autoridades sobrepostas |
| Observabilidade | Sentry/telemetria, correlation helpers e tabelas de eventos/auditoria | Fundação existe; operação e cobertura precisam ser comprovadas |
| Testes | Vitest, contratos de tenancy e pgTAP/SQL | Boa base de regressão, insuficiente para toda a superfície atual |

O frontend acessa majoritariamente o Supabase por client, serviços e hooks. O backend de domínio está distribuído entre funções SQL/RPC, políticas RLS e Edge Functions. Esse desenho é válido, mas torna obrigatório tratar migrations e tipos gerados como artefatos críticos de versão.

### 3.2 Frontend

#### Rotas e áreas existentes

- Autenticação: `/auth`, callback, reset e convite.
- Central de módulos: `/modulos`.
- Sala Ágil: dashboard, backlog/HUs, sprints, planning poker, retrospectiva, relatórios e métricas.
- Sustentação: demandas, SLA, IMR e relatórios.
- RDM: gestão de mudanças, checklist, go/no-go e auditoria própria.
- Administração operacional: dashboard, contratos, times e projetos.
- Console do tenant: overview, empresas, contratos, projetos, times, membros, consumo e configurações.
- Plataforma: planos, assinaturas e provedores de IA.
- Backoffice interno: clientes, assinaturas, financeiro, equipe, suporte, analytics, briefing IA, retenção e configurações.
- Outros domínios: OKR, releases, APF e briefing de IA.

#### Pontos fortes

- Lazy loading aplicado às principais páginas.
- Separação crescente por `features/`, além de componentes compartilhados.
- Guards distintos para autenticação, módulo, administrador organizacional, plataforma, contrato e backoffice.
- Shells específicos para aplicação, organização, plataforma e backoffice.
- Biblioteca visual consistente baseada em shadcn/Radix.
- Componentes reutilizáveis de tabela, filtros, badges, formulários, gráficos e exportação.

#### Fragilidades

- `src/App.tsx` concentra roteamento, redirects, guards e flags de compatibilidade; tende a crescer como ponto de acoplamento.
- Há componentes de domínio antigos em `src/components` ao lado da organização nova em `src/features`, dificultando ownership.
- `Index.tsx` e páginas de módulos amplos funcionam como orquestradores grandes.
- Algumas permissões são refletidas em guards diferentes, elevando risco de divergência entre navegação e RLS.
- O build aponta chunks grandes: APF ~1,6 MB, chunk principal ~898 KB e outros acima de 500 KB.
- `ImpedimentManager` é importado estática e dinamicamente, anulando o split desse módulo.
- O README ainda é o template genérico do Lovable e não documenta a plataforma real.

#### Reuso recomendado

Reaproveitar shells, guards, componentes UI, tabelas, filtros, exports, `OrganizationSwitcher`, contexts de organização/contrato e serviços por feature. Novas telas administrativas devem entrar no console de organização, plataforma ou backoffice conforme sua autoridade; não devem ser adicionadas ao menu operacional genérico.

### 3.3 Backend e APIs

O backend existente inclui RPCs PostgreSQL, RLS, triggers e Edge Functions para gestão de usuários, convites, APF, briefing, telemetria e integrações.

Edge Functions encontradas:

- `admin-user-management`, `delete-user`, `organization-invitations`;
- `apf-generate`, `process-apf-job`, `apf-embeddings`, `count-function-points`;
- `process-ai-briefing`, `platform-ai-provider-test`;
- `git-webhook-handler`, `teams-bot`, `redmine-sync`, `oracle-sync`, `apex-webhook`, `copilot-plugin`;
- `telemetry-ingest`, `auth-rate-limiter`.

#### Pontos fortes

- Operações privilegiadas são deslocadas para funções server-side.
- Há sinais de idempotência, filas/jobs, webhooks e processamento assíncrono.
- Existem helpers de correlação, retry, circuit breaker, monitoramento e tratamento de erros.
- Secrets de IA evoluíram para Vault/RPC em vez de exposição direta no cliente.
- Domínios críticos possuem auditoria específica e/ou genérica.

#### Fragilidades e riscos

- Não há um catálogo único de RPCs/Edge Functions com owner, versão, autenticação, idempotência e SLA.
- O backend está fragmentado entre SQL e TypeScript; mudanças exigem revisão conjunta de migration, tipos e consumidor.
- Muitas migrations de correção/compatibilidade indicam evolução rápida e risco de drift entre ambientes.
- Há migrations com timestamps/nomenclaturas próximas ou duplicadas; a ordem real precisa ser validada pelo histórico remoto.
- Fallbacks legados facilitam rollout, mas prolongados podem mascarar falhas de autorização.
- Integrações precisam de política comum de retry, dead-letter, replay, rate limit, secret rotation e health check.

### 3.4 Banco de dados

#### Domínios já modelados

- Agilidade: `teams`, `team_members`, `sprints`, `user_stories`, `activities`, `epics`, impedimentos, planning poker e retrospectiva.
- Sustentação: `demandas`, responsáveis, horas, transições, evidências, eventos, SLAs e feriados.
- RDM: mudanças, participantes, checklist, go/no-go, deployment tasks e audit log.
- Contratos/projetos: `companies`, `contracts`, `contract_slas`, `projects`, `projetos`, vínculos de times e membros.
- SaaS: `organizations`, `organization_members`, convites, módulos, planos, assinaturas, entitlements, limites e settings.
- Segurança: papéis, permissões, memberships e múltiplos audit logs.
- IA/APF: provedores, jobs, geração, baseline, contagem, conhecimento, validação, aprendizagem e governança de uso.
- Enterprise: identidade/Keycloak, gateway/3Scale, Git, DORA, risco, Teams, Copilot/Graph, Redmine, Oracle e APEX.
- Operação: backoffice, billing, suporte, métricas SaaS, telemetria, uso e retenção.

#### Avaliação

O banco já possui estrutura de tenant, projeto, usuário, permissão, logs, configuração e relatórios. A arquitetura suporta a visão desejada, mas ainda está em transição. O risco principal é integridade entre os eixos `org_id`, `contract_id`, `project_id` e `team_id`, especialmente em registros antigos.

Não se deve apagar nem recriar tabelas. A estratégia correta é:

1. medir nulos e vínculos cruzados;
2. corrigir/backfill com scripts idempotentes;
3. validar RLS e constraints em staging;
4. observar canário;
5. tornar constraints obrigatórias;
6. só depois retirar tabelas ou caminhos legados.

### 3.5 Autenticação e permissões

O login atual usa Supabase Auth. Há sessão, callback, reset de senha, troca obrigatória de senha, timeout/inatividade, perfil e onboarding. A autorização combina:

- papel legado/global de aplicação;
- `platform_admin`;
- owner/admin/member de organização;
- papéis de módulo;
- vínculos de contrato;
- permissões por time/projeto;
- papéis internos do backoffice.

#### Perfis desejados versus capacidade atual

| Perfil desejado | Situação | Recomendação |
|---|---|---|
| Super Admin | Coberto por `platform_admin` | Manter exclusivo e auditado |
| Admin do Tenant | Coberto por owner/admin da organização | Consolidar como autoridade do tenant |
| Admin de Projeto | Parcial via time/projeto/contrato | Formalizar escopo de projeto sem novo papel global |
| Manager | Há papéis operacionais compatíveis | Mapear para permissões, não regras hardcoded |
| Product Owner | Base existente | Padronizar matriz por módulo |
| Scrum Master | Base existente | Padronizar matriz por módulo |
| Tech Lead | Base existente/compatível | Padronizar matriz por módulo |
| Developer | Base existente | Manter escopo organizacional/projeto |
| Viewer | Pode ser expresso por permissões de leitura | Criar bundle de permissões se ainda não explícito |
| Service Account | Não comprovado como fluxo completo | Modelar identidade não humana, secret rotation e escopo mínimo |

O frontend não deve ser a autoridade final. Toda operação sensível deve continuar protegida por RLS/RPC/Edge Function. Keycloak deve federar identidade sem substituir imediatamente os identificadores internos: use `identity_providers` e `keycloak_user_mappings`, preserve `auth.users.id` como chave interna durante a transição e valide logout, refresh, desativação e provisionamento.

## 4. Diagnóstico funcional

### O que funciona e deve ser preservado

- cadastro e administração de projetos/contratos;
- backlog, HUs, workflow, sprints e impedimentos;
- planning poker e retrospectivas;
- Sustentação e indicadores de SLA/IMR;
- RDM e seus controles;
- geração/contagem APF e funções de IA;
- relatórios e exports existentes;
- autenticação Supabase e navegação por módulos;
- seleção de organização, contrato e time;
- consoles de organização, plataforma e backoffice.

### Oportunidades funcionais

- Unificar a linguagem: organização/tenant, empresa/cliente, projeto e contrato têm usos sobrepostos.
- Exibir claramente o contexto ativo (organização, contrato, projeto/time) em todas as telas que alteram dados.
- Criar catálogo de integrações com estado real: não configurada, configurando, saudável, degradada, erro e desativada.
- Acrescentar `last_success`, `last_error`, latência, backlog e ação de replay aos conectores.
- Consolidar relatórios executivos em uma camada semântica, evitando consultas específicas duplicadas por tela.
- Tornar permissões explicáveis: “por que este usuário pode executar esta ação?”.

## 5. Respostas às 14 perguntas obrigatórias

1. **Múltiplas empresas/clientes?** Sim, há `organizations`, `companies`, memberships, subscriptions e isolamento por `org_id`. A prontidão depende do gate de dados e RLS no ambiente real.
2. **Permissões?** Sim, em várias camadas. O problema atual é sobreposição/legado, não ausência.
3. **Projeto?** Sim, inclusive com `projects` e `projetos`; essa dualidade precisa de estratégia explícita de convergência.
4. **Área administrativa?** Sim: administração operacional, console da organização, console da plataforma e backoffice.
5. **Logs/auditoria?** Sim: logs genéricos e específicos por organização, contrato, RDM, backoffice, autenticação e operação.
6. **Configurações globais?** Sim: runtime settings, planos, entitlements, provedores de IA, configurações da organização e retenção.
7. **Base para integrações externas?** Sim: Edge Functions, webhooks, tabelas de configuração/eventos e correlation IDs.
8. **Preparado para Keycloak?** A fundação de dados existe; não considerar pronto sem federação E2E, mapeamento, logout, refresh, desprovisionamento e rollback testados.
9. **Preparado para GitLab?** A fundação é extensa (integrações, commits, MRs, pipelines, jobs e webhook); falta comprovar operação real e reconciliação.
10. **Preparado para relatórios enterprise?** Parcialmente. Há muitos relatórios e snapshots, mas falta camada semântica governada, qualidade de dados, lineage e SLAs.
11. **O que pode quebrar?** Tornar `org_id` obrigatório cedo, retirar fallbacks, trocar autoridade de roles, unificar projetos, alterar chaves de usuário, ativar RLS sem saneamento e mudar contratos de RPC.
12. **Melhorias seguras primeiro?** Documentação, catálogo de APIs, telemetria, testes, correção de code-splitting, padronização visual e preflights somente leitura.
13. **Arquitetura recomendada?** Organização como boundary do tenant; contrato e entitlements abaixo dela; projetos e times dentro do contrato/organização; identidade separada de autorização; integrações por organização/projeto; eventos/auditoria imutáveis; relatórios sobre camada governada.
14. **Ordem correta?** Inventário remoto e saneamento, consolidação de autorização/tenancy, observabilidade, framework comum de integrações, GitLab/Keycloak em canário, demais conectores, DORA/risco e relatórios executivos.

## 6. Mapa de impacto

| Evolução | Frontend | Backend | Banco | Auth/permissões | Risco |
|---|---|---|---|---|---|
| Enforcement multitenant | Contextos e filtros | RPCs/RLS | Backfill e constraints | Memberships | Alto |
| Consolidação de projetos | Seletores e formulários | Serviços/RPCs | `projetos` x `projects` | Escopo de acesso | Alto |
| Keycloak | Login/callback/logout | Federação e provisioning | Mappings/auditoria | Ciclo de identidade | Alto |
| GitLab/Git | Configuração e health | Webhook/sync/replay | Eventos e links | Secrets/escopo | Médio-alto |
| Teams | Configuração/comandos | Bot/webhooks | Mappings/eventos | Consentimento | Médio-alto |
| DORA | Dashboards | Agregação/jobs | Eventos/snapshots | Leitura executiva | Médio |
| Risco de sprint | Explicabilidade | Pipeline/model version | Training/events | Governança IA | Médio-alto |
| Relatórios enterprise | Navegação/export | Camada semântica | Snapshots/views | Row-level access | Médio |
| Backoffice | Shell interno | Serviços privilegiados | Billing/support | Staff roles | Alto |

## 7. Riscos priorizados

### Críticos

1. **Drift de schema entre ambientes:** 295 migrations e várias correções exigem inventário remoto antes de qualquer nova migration.
2. **Isolamento incompleto de dados legados:** registros sem `org_id` ou relações cruzadas podem vazar dados quando caminhos novos e antigos coexistem.
3. **Autoridade de permissão duplicada:** diferentes tabelas/papéis podem conceder resultados divergentes.
4. **Ativação prematura de integrações:** schema e função sem secrets, retry e monitoramento criam falsa sensação de prontidão.

### Altos

- Dualidade `projects`/`projetos` e múltiplos vínculos de membros.
- Retirada de fallback legado sem telemetria e rollback.
- Crescimento de `App.tsx` e regras de autorização duplicadas no cliente.
- Ausência de E2E cobrindo personas e troca de organização/contrato.
- Bundles grandes afetando carregamento, especialmente APF.

### Médios

- README desatualizado.
- Browserslist defasado.
- Dependência transiente com `eval` sinalizada no build.
- Avisos de configuração Supabase legada nos testes.
- Cobertura automatizada pequena diante da superfície funcional.

## 8. Melhorias em três níveis

### 8.1 Rápidas e de baixo risco

- Substituir o README de template por arquitetura, setup, ambientes e matriz de módulos.
- Criar catálogo de rotas, RPCs, Edge Functions e migrations por domínio.
- Corrigir importação mista do `ImpedimentManager`.
- Dividir o bundle de APF e dependências pesadas de PDF/XLSX.
- Padronizar mensagens de erro e correlation ID para suporte.
- Exibir contexto ativo e status em telas administrativas.
- Ampliar testes de guards, redirects e permissões negativas.
- Eliminar fallback de credencial Supabase nos testes, usando configuração explícita de teste.

### 8.2 Estruturais

- Extrair configuração declarativa de rotas/guards de `App.tsx`.
- Definir uma matriz canônica de permissões e uma única função de decisão server-side.
- Estabelecer plano formal para `projetos` x `projects` e memberships duplicadas.
- Criar registry comum de integrações com secrets no Vault, health, sync cursor, retry, dead-letter e replay.
- Introduzir testes E2E por persona e tenant.
- Automatizar preflight de migration e drift em staging.
- Criar camada semântica/versionada para métricas executivas.

### 8.3 Estratégicas

- Federação Keycloak e lifecycle corporativo (JIT/SCIM quando necessário).
- Plataforma de eventos de engenharia, normalizando GitLab, incidentes, deploys e mudanças.
- DORA com lineage e regras versionadas.
- Predição de risco explicável, com model registry, drift e revisão humana.
- Governança de APIs/3Scale com contracts, quotas e correlation end-to-end.
- Relatórios executivos por tenant/contrato com retenção e auditoria.

## 9. Arquitetura recomendada

```text
Plataforma Axionn
├── Identidade (Supabase Auth / Keycloak)
├── Organização (boundary de tenant)
│   ├── Empresas/unidades
│   ├── Contratos e assinaturas
│   │   └── Entitlements, limites e módulos
│   ├── Projetos
│   │   ├── Times e membros
│   │   └── Integrações e credenciais por escopo
│   └── Configurações e retenção
├── Domínios operacionais
│   ├── Sala Ágil
│   ├── Sustentação
│   ├── RDM
│   └── APF / IA / Briefing
├── Eventos de engenharia e integração
│   ├── Git/GitLab, deploys e incidentes
│   ├── Teams, Redmine, Oracle e APEX
│   └── retry, replay, health e dead-letter
├── Governança
│   ├── autorização server-side
│   ├── auditoria imutável
│   ├── telemetria e correlation ID
│   └── políticas de retenção
└── Inteligência
    ├── camada semântica
    ├── DORA
    ├── risco de sprint
    └── relatórios executivos
```

Princípios:

- `organization_id` é a fronteira obrigatória de isolamento.
- Identidade autentica; memberships e permissões autorizam.
- Contrato habilita módulos e limites, não concede acesso sozinho.
- Projeto/time define escopo operacional.
- Toda integração implementa o mesmo lifecycle operacional.
- Eventos brutos são preservados; métricas derivadas são versionadas e reproduzíveis.
- O frontend melhora UX, mas o banco/backend decide acesso.

## 10. Plano gradual recomendado

### Fase 0 — Baseline e gate de segurança (imediata)

- Inventariar migrations realmente aplicadas em dev, staging e produção.
- Executar relatórios de readiness e testes pgTAP em staging.
- Medir `org_id`, `contract_id`, `project_id` e `team_id` nulos/inconsistentes.
- Criar matriz de papéis e permissões atuais.
- Congelar novas estruturas paralelas até concluir o inventário.

**Saída:** relatório de drift, zero vazamento nos testes cruzados e rollback ensaiado.

### Fase 1 — Organização da base atual

- Atualizar documentação e catálogo técnico.
- Modularizar rotas e ownership de componentes.
- Corrigir bundles e avisos de build.
- Expandir regressão dos fluxos que devem ser preservados.
- Padronizar erros, logs e correlation IDs.

**Saída:** build limpo de alertas controláveis, E2E smoke e documentação operacional.

### Fase 2 — Consolidação da fundação enterprise

- Convergir permissões para memberships organizacionais e políticas server-side.
- Sanear dados legados e tornar vínculos organizacionais obrigatórios por ondas.
- Definir a convergência de `projetos` e `projects`.
- Validar contratos, entitlements, limites e auditoria.
- Desativar fallbacks apenas após telemetria e canário.

**Saída:** tenant isolation comprovado e autoridade de acesso única/documentada.

### Fase 3 — Framework de integrações

- Consolidar registry de integrações e modelo de credenciais.
- Implementar padrão de teste de conexão, health, cursor, retry, replay e DLQ.
- Criar console único de status e histórico de sincronização.
- Definir SLOs e alertas.

**Saída:** um connector contract reutilizável e testado.

### Fase 4 — Integrações principais

- Keycloak em tenant piloto, preservando login Supabase como rollback.
- GitLab/Git com webhook assinado, reconciliação periódica e replay.
- Teams com consentimento, escopos mínimos e auditoria.

**Saída:** integrações operacionais em canário com runbooks.

### Fase 5 — Integrações corporativas

- Redmine, 3Scale, Oracle Database e Oracle APEX.
- Aplicar o mesmo connector contract, sem fluxos especiais invisíveis.
- Testar volume, rate limit, indisponibilidade e rotação de segredo.

### Fase 6 — Relatórios e inteligência

- Normalizar eventos de deploy, incidentes e fluxo de trabalho.
- Validar DORA contra amostras calculadas manualmente.
- Ativar risco de sprint com explicabilidade, versionamento e monitoramento de drift.
- Entregar dashboards executivos, adoção e saúde de integrações.

## 11. Pontos que não devem ser alterados agora

- Não substituir Supabase Auth abruptamente por Keycloak.
- Não remover tabelas `projetos`/`projects` ou memberships sem mapa de consumidores e backfill.
- Não desativar papéis/fallbacks legados sem observar uso real.
- Não tornar colunas de tenancy obrigatórias antes do readiness report ficar verde.
- Não alterar contratos de RPC consumidos pelo frontend sem versionamento/transição.
- Não reescrever Sala Ágil, Sustentação, RDM, APF ou relatórios apenas para padronização estética.
- Não guardar secrets de integração no frontend ou em colunas abertas; usar Vault/Edge Functions.

## 12. Validação executada

### Testes

```text
18 arquivos aprovados
127 testes aprovados
0 falhas
```

Cobrem, entre outros, contrato do console organizacional, entitlements, isolamento de tenant, acesso organizacional, layouts, APF e briefing. Os testes SQL/pgTAP não foram executados porque requerem uma URL de banco de staging protegida.

### Build

O build de produção foi concluído. Alertas observados:

- Browserslist/caniuse desatualizado;
- uso de `eval` em dependência transitiva `bluebird`;
- importação estática e dinâmica do mesmo componente;
- chunks acima de 500 KB, principalmente APF e dependências de documentos/planilhas.

## 13. Decisão recomendada

O Axionn já possui a fundação da plataforma enterprise desejada. A próxima decisão não deve ser “criar tenants, contratos, logs e integrações”, pois esses conceitos já existem. Deve ser “quais capacidades existentes estão implantadas, saneadas e comprovadas?”.

O próximo trabalho seguro é a **Fase 0**, executada contra staging: inventário de migrations, readiness multitenant, testes pgTAP, matriz de autorização e validação dos conectores. Somente após esse gate deve começar a ativação progressiva de Keycloak/GitLab/Teams e a publicação de métricas enterprise.
