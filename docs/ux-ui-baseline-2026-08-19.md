# UX/UI Baseline — Axionn

**Data:** 2026-08-19  
**Fase:** 0 — Baseline e inventário  
**Escopo analisado:** `src/components`, `src/shared`, `src/features/{admin,apf,rdm,sustentacao,kanban,quality}`, `src/pages`, `src/App.tsx`, testes próximos e scripts do projeto.

## 1. Resumo executivo

O Axionn já possui uma fundação consistente de primitives Radix/shadcn em `src/components/ui`, navegação declarativa e componentes compartilhados para relatórios e estados comuns. A inconsistência principal está na composição por módulo: cabeçalhos, filtros, tabelas, estados locais e feedbacks coexistem com contratos e aparências diferentes.

O maior ganho de UX com baixo risco é consolidar o padrão de `PageHeader` para páginas operacionais não-relatório, usando uma migração piloto pequena e preservando as exceções legítimas do shell Admin e dos relatórios. Antes disso, o risco P1 mais objetivo é a acessibilidade de tabelas e controles existentes.

Nenhuma regra de negócio, API, payload, permissão, workflow, cálculo, integração ou banco foi alterado nesta fase.

## 2. Arquitetura encontrada

- Stack: Vite 8, React 18, TypeScript 5, React Router 7, Tailwind CSS 3.
- UI: primitives Radix em `src/components/ui`, `class-variance-authority`, `lucide-react`, `sonner` e Radix Toast coexistentes.
- Formulários: `react-hook-form`, `zod` e resolvers.
- Dados/testes: TanStack Query, Vitest, Testing Library e Playwright.
- Organização: componentes globais em `src/components`, componentes compartilhados em `src/shared/components`, features em `src/features`, páginas em `src/pages`.
- O build produz chunks por rota/componente, mas emite aviso de chunks acima de 500 kB. Este item é de performance/arquitetura e fica fora do escopo desta iniciativa UX/UI.

## 3. AppShell e navegação

### AppShell

Foram encontrados dois componentes com o nome `AppShell`:

1. `src/components/layout/AppShell.tsx`: shell operacional atual para `sala_agil`, `sustentacao` e `rdm`, com sidebar, topbar, troca de módulo/time, breadcrumbs, tema, notificações, usuário e banner de sprint.
2. `src/components/navigation/AppShell.tsx`: shell declarativo anterior/alternativo, com `PrimarySidebar`, `TopBar`, breadcrumbs e conteúdo em card. O próprio texto renderizado indica migração gradual.

`src/lib/layoutRoutes.ts` define quais rotas possuem chrome gerenciado, incluindo módulos operacionais, OKR, organização, plataforma e backoffice.

### Navegação

- `src/components/navigation/NavigationConfig.tsx` concentra tipos, matching, breadcrumbs e configurações de Sala Ágil, Sustentação e RDM.
- `src/components/navigation/PrimarySidebar.tsx` fornece `NavigationList` e `PrimarySidebar`, com seções colapsáveis, rota ativa, botão de colapso e `aria-current`.
- `src/components/navigation/BreadcrumbsContextual.tsx` fornece breadcrumbs com `aria-label="Breadcrumb"`.
- `src/App.tsx` resolve o destino inicial segundo sessão, administração, papéis e acesso aos módulos.
- `src/components/layout/AppShell.tsx` usa `filterSalaAgilNavigation`, `sustentacaoNavigationConfig` e `rdmNavigationConfig`.

### Observação arquitetural

A coexistência de dois `AppShell` é uma duplicação arquitetural relevante. Não deve ser consolidada nesta fase sem identificar todos os consumidores e o impacto funcional da migração.

## 4. Inventário de componentes

### Nível 1 — Primitives

- Botões, inputs, labels, selects, checkboxes, radio groups, tabs, badges, cards, table, dialog, alert-dialog, drawer, sheet, toast, toaster, tooltip, scroll-area, form e outros em `src/components/ui`.
- A base é reutilizável e não há evidência para criar um novo Design System paralelo.

### Nível 2 — Componentes compostos

- Relatórios: `ReportLayout`, `ReportPageHeader`, `ReportFilterBar`, `ReportDataTable`, `ReportKPISummary`, `ReportChart` e `ReportCatalog` em `src/shared/components/reports`.
- Estados comuns: `EmptyState` e `ErrorState` em `src/shared/components/common`; `SkeletonList` em `src/components/common` e também em `src/shared/components/common`.
- Navegação: `NavigationList`, `PrimarySidebar`, `BreadcrumbsContextual`.
- Admin: `features/admin/components/PageHeader.tsx`, tabelas, drawers e dialogs locais.
- Módulos: `KanbanFilterBar`, `MetricasFilterBar`, componentes de RDM, APF, Sustentação e qualidade.

### Nível 3 — Padrões de página

- Shell operacional com sidebar/topbar.
- Relatórios com header, filtros, KPIs, gráficos e tabela.
- Sala Ágil com dashboard, backlog, board, cerimônias e configurações.
- Sustentação com listas, dashboards, demanda, atividades e relatórios.
- RDM com listagem em cards, detalhe e formulário.
- APF com geração, dossiê, análise, importação e diálogos de auditoria.
- Admin/backoffice com tabelas operacionais, formulários e consoles administrativos.

## 5. Matriz de padrões

| Padrão | Sala Ágil | Sustentação | RDM | APF | Admin |
|---|---|---|---|---|---|
| PageHeader | `ReportPageHeader` em relatórios; headers locais no Kanban | `ReportPageHeader` em relatórios e `ReportHeader` local | Header/listagem local em `RdmList` | headings locais em `ApfTemplatesTab` e dossiê | `features/admin/components/PageHeader`, sem `h1` por decisão do shell |
| FilterBar | `ReportFilterBar`, `KanbanFilterBar`, filtros de dashboard | `ReportFilterBar`, `MetricasFilterBar`, filtros de relatório | busca/status inline em `RdmList` | filtros e controles locais de análise/listas | `DashboardFilters` com semântica explícita de Aplicar |
| DataTable | `ReportDataTable` nos relatórios; tabelas locais em telas operacionais | `ReportDataTable`; tabela selecionável em importação | modelo card-first em `RdmList` | `PaginatedApfStoryList` e tabelas especializadas | primitive `Table` em `UsersTable`, `TeamsTable`, `SprintHistoryTable` |
| EmptyState | compartilhado em componentes aplicáveis; locais em algumas páginas | compartilhado com reuso mais forte | markup local em `RdmList` | branches locais em tabs/dossiê | placeholders/empty locais em páginas e tabelas |
| Loading | `SkeletonList`, `SectionSkeleton`, spinners e skeletons locais | hooks e estados locais, com `SkeletonList` em partes | loading local em list/detail | loading de importação/auditoria e dialogs locais | loaders locais e skeletons por página |
| Error | `SectionErrorBoundary`, `ErrorState` e erros locais | `ErrorState` compartilhado e erros locais | erro/local refresh em `RdmList` | `role="alert"`/`role="status"` em partes do dossiê | erros locais e boundaries do shell |
| Dialog | Radix `Dialog` e `AlertDialog` | dialogs de demanda, atividade, encerramento e justificativa | `RdmForm` e confirmação | dialogs grandes de análise, validação e importação | dialogs de CRUD e `AlertDialog` destrutivo |
| Drawer | `HUEditDrawer`, `TaskDetailSheet` e variações | drawers contextuais locais | não é o padrão principal | drawers/sheets de detalhe e referência | drawers de detalhe/edição |
| Sheet | `HUPreviewSheet`, detalhes | sheets locais em detalhes | pode aparecer em fluxos auxiliares | sheet lateral em referências/detalhes | sheets para detalhe/edição |
| Feedback | `sonner` e `useToast` conforme feature | principalmente `sonner` | principalmente `sonner` | principalmente `sonner`, com estados inline | `sonner`, Radix Toast e feedback local |
| Forms | RHF em partes; muitos formulários locais | vários formulários locais e dialogs | `RdmForm` com RHF + Zod + `FormMessage` | helpers `Field`/forms de dossiê | muitos forms locais e dialogs administrativos |
| Navigation | `NavigationConfig` e `AppShell` operacional | `NavigationConfig` e `AppShell` operacional | `NavigationConfig` e `AppShell` operacional | entrada via Sala Ágil/rotas específicas | shells de organização, plataforma e backoffice próprios |

## 6. Duplicações identificadas

1. Dois `AppShell` com contratos e composições diferentes.
2. `ReportPageHeader` compartilhado, `features/admin/components/PageHeader` e headers locais por feature.
3. `ReportFilterBar`, `KanbanFilterBar`, `MetricasFilterBar`, `DashboardFilters` e filtros inline de RDM.
4. `ReportDataTable`, primitive `Table`, tabelas de seleção/importação e listas card-first.
5. `EmptyState` e `ErrorState` compartilhados coexistem com markup local em RDM, APF, qualidade e páginas administrativas.
6. Feedback fragmentado entre `sonner`, Radix Toast/`useToast` e mensagens inline.
7. `NotificationBell` aparece em `src/components`, `src/features/admin/components` e `src/features/notifications/components`.
8. `SkeletonList` aparece em mais de uma camada compartilhada.

A existência dessas implementações não significa que todas devam ser fundidas: algumas preservam comportamento, densidade ou contexto legítimos.

## 7. Variantes legítimas

- `features/admin/components/PageHeader` não renderiza `h1` porque o título é fornecido pelo topbar do Admin. Essa é uma variante de shell, não uma duplicação simples.
- `ReportPageHeader` suporta compatibilidade entre props novas e legadas; deve ser preservado até os consumidores serem conhecidos.
- `MetricasFilterBar` suporta filtros mais ricos, chips e views salvas; não é equivalente a um filtro simples de relatório.
- `DashboardFilters` usa Aplicar explícito, comportamento diferente de filtros reativos.
- `ReportDataTable` é analítica, com ordenação/paginação; `Table` e tabelas de seleção são operacionais.
- `RdmList` usa cards responsivos, uma escolha adequada para leitura de entidade em telas estreitas.
- APF possui estados especializados de importação, auditoria, validação e processamento; estes não devem ser reduzidos a um empty/loading genérico.
- Dialog para edição/confirmacão e Sheet/Drawer para detalhe contextual são distinções coerentes com o uso observado.

## 8. Padrões inconsistentes

- Não existe um contrato único de header para páginas fora de relatórios.
- Filtros não têm semântica uniforme para filtros ativos, limpar todos, Aplicar e contagem.
- Tabelas não têm comportamento uniforme de ordenação, paginação, empty, loading e erro.
- Empty e Error compartilhados não expressam explicitamente `role="alert"`, e o empty não distingue sem dados de sem resultado filtrado.
- Há mais de um canal global de toast/feedback.
- Labels, foco, nomes acessíveis e teclado variam por módulo.
- Alguns dialogs não possuem `DialogDescription`.

## 9. Benchmark interno por padrão

| Padrão | Implementação escolhida | Motivo | Limitações |
|---|---|---|---|
| Shell/navegação | `src/components/layout/AppShell.tsx` + `NavigationConfig` | É o shell operacional usado pelos três módulos principais e concentra troca de módulo/time e breadcrumbs | Coexiste com outro `AppShell`; não consolidar ainda |
| PageHeader de relatório | `src/shared/components/reports/ReportPageHeader.tsx` | Título, descrição, badge, ícone e ações com composição relativamente simples | Contrato legado/nomeação dupla; não cobre shell Admin |
| PageHeader operacional | `src/features/admin/components/PageHeader.tsx` como referência de composição | API pequena, ações e slot; explicita a exceção do título no shell | Não renderiza título por desenho; requer adaptação para módulos que precisam de `h1` |
| FilterBar | `src/shared/components/reports/ReportFilterBar.tsx` | Já compartilhado em relatórios e possui clear/reset e labels | Props legadas e min-width fixos; não cobre views salvas ou Aplicar |
| Tabela analítica | `src/shared/components/reports/ReportDataTable.tsx` | Ordenação, paginação, render de célula e estado vazio em contrato conhecido | Ordenação não é acessível por teclado e não informa `aria-sort` |
| Tabela operacional | `src/components/ui/table.tsx` + composição local | Mantém flexibilidade para seleção, ações e densidade | Não fornece estados ou interação composta |
| Empty | `src/shared/components/common/EmptyState.tsx` | Já é compartilhado e tem ação opcional | Sem distinção filtered empty, sem região semântica explícita |
| Error | `src/shared/components/common/ErrorState.tsx` | Tem retry opcional e linguagem consistente | Não usa `role="alert"` |
| Formulário | `src/features/rdm/components/RdmForm.tsx` | RHF + Zod, labels, mensagens e estado de submissão | É um formulário de domínio e não deve ser abstraído como página genérica |
| Dialog/Sheet | primitives Radix em `src/components/ui` | Foco e semântica fornecidos pela biblioteca já adotada | Alguns consumidores precisam completar description, scroll e nomes acessíveis |
| Feedback | Nenhum benchmark único adequado encontrado | O código confirma fragmentação entre `sonner` e Radix Toast | Requer decisão multi-módulo; ADR recomendado |

## 10. Acessibilidade

### Métricas verificáveis

- `aria-label`: 262 ocorrências em 102 arquivos.
- `aria-labelledby`: 26 ocorrências em 21 arquivos.
- `focus-visible`: 55 ocorrências em 37 arquivos.
- `htmlFor=`: 155 ocorrências em 57 arquivos.
- `<Label`: 540 ocorrências em 122 arquivos.
- `aria-busy`: 12 ocorrências em 9 arquivos.
- `aria-live`: 12 ocorrências em 12 arquivos.
- `role="dialog"` literal: 0 ocorrências; a semântica dos dialogs é fornecida pelos primitives Radix e deve ser validada renderizada.

### Riscos P1

1. `src/shared/components/reports/ReportDataTable.tsx`: ordenação é um `onClick` direto no `th`, sem botão, `tabIndex`, teclado ou `aria-sort`. Afeta relatórios de Sala Ágil e Sustentação.
2. Há controles icon-only sem accessible name em `src/features/rdm/components/RdmList.tsx`, `src/features/admin/components/UsersTable.tsx` e `src/features/admin/components/ProjetosAdminPanel.tsx`.
3. Botões de remoção de chips em `src/components/dashboard/DashboardFilters.tsx` e `src/components/KanbanFilterBar.tsx` usam `X` sem nome acessível consistente.
4. Labels visuais sem associação explícita aparecem em forms administrativos, incluindo `src/features/admin/pages/AdminEmpresasPage.tsx`.
5. Linhas clicáveis em `src/features/admin/components/SprintHistoryTable.tsx` não apresentam `tabIndex`/`onKeyDown`; `src/features/quality/pages/TestCasesPage.tsx` é benchmark local de padrão com teclado.
6. `src/features/rdm/components/RdmForm.tsx` possui `DialogTitle`, mas não foi encontrada `DialogDescription` no trecho auditado.
7. Loading/error não são anunciados uniformemente: APF possui `role="status"`/`role="alert"` em partes, mas vários estados locais são apenas visuais.

## 11. Estados e feedback

### Estados

- Loading: há `SectionSkeleton`, `SectionLoader`, `SkeletonList`, spinners e estados específicos por feature.
- Empty: existe `EmptyState`, mas há markup local e não há padrão explícito para `Filtered Empty`.
- Error: existe `ErrorState`, porém páginas também usam mensagens locais e boundaries.
- Permission restricted: já há guards e estados próprios; nenhuma nova lógica de permissão deve ser criada nesta iniciativa.
- Success/error de operação: principalmente `sonner`, com `useToast`/Radix Toast em parte do código.

### Feedback

A fragmentação é estrutural: a busca encontrou 1.139 ocorrências de `toast` em 143 arquivos e 8 ocorrências de `useToast` em 4 arquivos. A métrica inclui usos e não representa número de componentes. Não é seguro escolher um canal único sem ADR e validação multi-módulo.

## 12. DataTables

Foram identificados pelo menos dois modelos reais:

1. Analítico: `ReportDataTable`, com ordenação, paginação, colunas configuráveis e empty.
2. Operacional: primitive `Table` com ações/seleção, além de tabelas especializadas como `ImportacaoPreviewTable`.

Outros modelos relevantes:

- `DemandasList` permite composição card/tabela, variante responsiva legítima.
- RDM é card-first.
- APF possui listas paginadas e tabelas de complexidade/anomalia.
- Admin possui tabelas operacionais separadas.

Conclusão: não há evidência para criar agora um `DataTable` universal com dezenas de props. A primeira tarefa segura é corrigir e documentar a acessibilidade/estado do modelo analítico existente, sem alterar contrato de dados.

## 13. Formulários

- Melhor benchmark: `src/features/rdm/components/RdmForm.tsx`, com RHF, Zod, `FormLabel`, `FormMessage` e estado de submissão.
- APF usa helpers `Field` e associação explícita em partes do dossiê.
- Admin e Sustentação possuem vários forms locais com `useState`; a simplificação deve ser incremental e baseada em repetição real.
- Critérios recorrentes a auditar: label/ID, required, mensagem de erro, disabled durante submit, cancelamento, loading, sucesso e erro.

Não foram alteradas validações ou payloads.

## 14. Responsividade

- `ReportFilterBar` usa `min-w-[140px]`/`min-w-[160px]`; o wrap existe, mas pode criar blocos altos e irregulares em 320–375 px.
- Tabelas analíticas e de importação usam overflow horizontal; isso preserva dados, mas não resolve a priorização de colunas em mobile.
- `RdmList` usa grid de cards responsivo e é uma referência de listagem estreita.
- Dialogs APF/Admin possuem scroll em vários casos, mas dialogs grandes devem ser verificados em 320–375 px antes de qualquer migração.
- Há controles icon-only de 28–32 px em Admin/APF/RDM; devem ser auditados quanto a área de toque e foco.

A responsividade não foi validada por browser nesta Fase 0; as conclusões acima são do código. Teste renderizado é necessário na fase de implementação.

## 15. Métricas baseline

| Métrica | Resultado | Observação |
|---|---:|---|
| Ocorrências `PageHeader` | 40 | 18 arquivos; inclui imports/usos, não só definições |
| Ocorrências `FilterBar` | 32 | 15 arquivos |
| Ocorrências `DataTable` | 22 | 10 arquivos |
| Ocorrências `EmptyState` | 48 | 17 arquivos |
| Ocorrências `Loading` | 1.212 | 272 arquivos; termo amplo, não é cobertura de loading |
| Ocorrências `ErrorState` | 2 | 1 arquivo na busca nominal |
| Ocorrências `Dialog` | 2.271 | 131 arquivos; inclui primitives/imports/usos |
| Ocorrências `Drawer` | 81 | 15 arquivos |
| Ocorrências `Sheet` | 285 | 33 arquivos |
| Ocorrências `toast` | 1.139 | 143 arquivos; inclui texto/imports/usos |
| Definições nominais de PageHeader/FilterBar/DataTable/Empty/Error | 4 grupos principais | Admin PageHeader, ReportPageHeader, ReportFilterBar, shared EmptyState/ErrorState; existem headers/filtros/tabelas locais sem esses nomes |
| Testes unitários baseline | 140 arquivos / 614 testes | Todos passaram |
| Lint baseline | 0 erros / 1.709 warnings | `npm run lint` exitou 0 |
| Build baseline | Sucesso | `npm run build` exitou 0; avisos de browserslist, plugin e chunks |

Métricas de percentual de cobertura de estados, quantidade de botões icon-only sem nome e cobertura de teclado não são mensuráveis com segurança apenas pela busca textual executada.

## 16. Quick Wins

1. Corrigir ordenação acessível em `ReportDataTable`, preservando ordenação, paginação e dados.
2. Adicionar accessible names aos controles icon-only identificados, sem alterar ações.
3. Associar labels/IDs em formulários administrativos pequenos.
4. Adicionar `role="alert"`/`role="status"` onde o estado já existe, sem criar novos fluxos.
5. Documentar e aplicar clear/reset consistente no segundo caso de `ReportFilterBar`.

O maior Quick Win isolado é a ordenação acessível de `ReportDataTable`, por atingir pelo menos relatórios de Sala Ágil e Sustentação sem alterar regra de negócio.

## 17. P0

Nenhum P0 confirmado pelo código auditado.

Não foram encontrados regressões, bloqueadores de fluxo ou riscos críticos que justifiquem P0 nesta Fase 0.

## 18. P1

- UX-002 — Ordenação acessível em tabelas analíticas.
- UX-003 — Accessible names e teclado em controles icon-only/linhas clicáveis.
- UX-004 — Estados Loading/Empty/Filtered Empty/Error com contrato mínimo.
- UX-005 — Feedback global e decisão sobre `sonner` versus Radix Toast.
- UX-006 — Padrão de PageHeader para páginas operacionais.
- UX-007 — Padrão de FilterBar e clear/reset.

## 19. P2

- UX-008 — Auditoria incremental de formulários, começando por Admin e Sustentação.
- UX-009 — Critérios de tabela operacional versus analítica.
- UX-010 — Responsividade de dialogs APF/Admin e filtros densos.
- UX-011 — Linguagem visual de status/badges entre módulos.
- UX-012 — Migração de estados locais de RDM/APF para componentes compartilhados quando o comportamento permitir.

## 20. P3

- UX-013 — Refinamento de densidade, microinterações e animações.
- UX-014 — Avaliação futura da duplicidade dos shells, somente após inventário de consumidores.
- UX-015 — Refinamentos visuais de relatórios e navegação.

## 21. ADRs recomendados

### ADR-001 — PageHeader por contexto de shell

- **Contexto:** `ReportPageHeader`, Admin `PageHeader` e headers locais coexistem.
- **Decisão proposta:** contrato de composição com título, descrição, status e ações, mantendo variante Admin sem `h1`.
- **Alternativas:** manter todas as implementações; criar um componente universal com dezenas de props.
- **Consequências:** menos divergência, mas requer migração incremental e inventário de consumidores.

### ADR-002 — FilterBar e semântica de aplicação

- **Contexto:** filtros reativos, filtros com Aplicar, chips/views salvas e filtros inline.
- **Decisão proposta:** definir capacidades mínimas comuns e preservar variantes comportamentais.
- **Alternativas:** universalizar todos os filtros; manter toda duplicação.
- **Consequências:** melhora previsibilidade sem esconder regras de filtragem.

### ADR-003 — Feedback global

- **Contexto:** `sonner` e Radix Toast/`useToast` coexistem.
- **Decisão proposta:** selecionar um canal de aplicação após comparar acessibilidade, persistência, testes e consumidores.
- **Alternativas:** migração imediata; manter ambos explicitamente.
- **Consequências:** decisão multi-módulo; não implementar durante a auditoria.

### ADR-004 — Estados de interface

- **Contexto:** Empty/Error compartilhados e estados locais especializados.
- **Decisão proposta:** contrato mínimo para Loading, Empty, Filtered Empty, Error e Permission Restricted, sem absorver estados de processamento de domínio.
- **Alternativas:** um componente de estado universal; markup livre em todas as páginas.
- **Consequências:** previsibilidade com exceções documentadas.

### ADR-005 — DataTable por capacidade

- **Contexto:** tabelas analíticas, operacionais, selecionáveis e card-first.
- **Decisão proposta:** manter modelos por capacidade e não criar uma tabela universal antes do inventário completo.
- **Alternativas:** `DataTable` gigante; somente primitive `Table`.
- **Consequências:** menor risco de esconder comportamento de negócio.

## 22. Backlog

## UX-001 — Baseline e inventário

- **Objetivo:** documentar a Fase 0 e selecionar o primeiro padrão.
- **Problema:** padrões equivalentes estão distribuídos entre shells e features.
- **Evidência:** este relatório e os caminhos listados nas seções 2–15.
- **Escopo:** investigação, métricas, benchmark e priorização.
- **Fora do escopo:** qualquer alteração de aplicação.
- **Benchmark:** componentes compartilhados já existentes.
- **Impacto:** Alto.
- **Esforço:** Médio.
- **Prioridade:** P1.
- **Piloto:** relatório de Sala Ágil/Sustentação.
- **Critérios de aceite:** evidências, matriz, riscos e próximo padrão registrados.
- **Validação:** lint, testes e build baseline.
- **Riscos:** métricas textuais podem incluir imports/usos e não equivalem a cobertura comportamental.

## UX-002 — Ordenação acessível em ReportDataTable

- **Objetivo:** permitir ordenação via teclado e comunicar estado ao leitor de tela.
- **Problema:** `th` recebe `onClick` sem controle focável ou `aria-sort`.
- **Evidência:** `src/shared/components/reports/ReportDataTable.tsx`.
- **Escopo:** acessibilidade da interação existente.
- **Fora do escopo:** alterar algoritmo, colunas, dados ou paginação.
- **Benchmark:** primitive Radix/shadcn e padrão de botão existente.
- **Impacto:** Alto.
- **Esforço:** Baixo.
- **Prioridade:** P1.
- **Piloto:** relatório Sala Ágil.
- **Critérios de aceite:** mouse, teclado, foco visível, `aria-sort`, testes e sem mudança de ordenação.
- **Validação:** teste unitário renderizado, lint, build e Playwright quando aplicável.
- **Riscos:** nenhum risco funcional esperado; validar cabeçalhos com render customizado.

## UX-003 — Nomes acessíveis em ações existentes

- **Objetivo:** nomear controles icon-only e tornar linhas interativas operáveis por teclado.
- **Problema:** nomes e teclado variam por módulo.
- **Evidência:** RDM `RdmList`, Admin `UsersTable`, `ProjetosAdminPanel`, `SprintHistoryTable`, chips em filtros.
- **Escopo:** accessible name, foco e teclado das ações existentes.
- **Fora do escopo:** criar, remover ou reordenar ações.
- **Benchmark:** `TestCasesPage` para ação com teclado e `aria-label`.
- **Impacto:** Alto.
- **Esforço:** Baixo/Médio.
- **Prioridade:** P1.
- **Piloto:** um fluxo de listagem de Sala Ágil ou Admin.
- **Critérios de aceite:** nome, foco, Enter/Space quando aplicável, ações preservadas.
- **Validação:** Testing Library/axe quando disponível, Playwright e teclado manual.
- **Riscos:** linhas clicáveis podem exigir decisão de semântica sem alterar workflow.

## UX-004 — Estados comuns

- **Objetivo:** consolidar estados de apresentação sem apagar estados especializados.
- **Problema:** Empty/Error/Loading locais não distinguem filtered empty e não anunciam sempre o estado.
- **Evidência:** shared common versus RDM/APF/quality.
- **Escopo:** primeiro fluxo piloto com estados já existentes.
- **Fora do escopo:** lógica de retry, permissão, fetching ou domínio.
- **Benchmark:** `EmptyState`, `ErrorState`, `ApfDossierAudit` para regiões anunciadas.
- **Impacto:** Alto.
- **Esforço:** Médio.
- **Prioridade:** P1.
- **Piloto:** relatório ou listagem de Sala Ágil.
- **Critérios de aceite:** estados preservados e acessíveis.
- **Validação:** testes e viewport relevante.
- **Riscos:** distinguir sem resultado de falha sem alterar lógica de filtros.

## UX-005 — Feedback global

- **Objetivo:** propor decisão sobre o canal de feedback.
- **Problema:** `sonner` e Radix Toast coexistem.
- **Evidência:** 1.139 ocorrências de `toast` em 143 arquivos e `useToast` em 4 arquivos.
- **Escopo:** ADR e piloto, não migração global inicial.
- **Fora do escopo:** mudança de mensagens de negócio ou semântica de erro.
- **Benchmark:** nenhum adequado encontrado.
- **Impacto:** Alto.
- **Esforço:** Alto.
- **Prioridade:** P1.
- **Piloto:** um fluxo de operação concluída e um erro.
- **Critérios de aceite:** decisão aprovada e mensagens preservadas.
- **Validação:** acessibilidade renderizada e testes.
- **Riscos:** persistência, posição, dismiss e consumidores divergentes.

## UX-006 — PageHeader operacional

- **Objetivo:** reduzir divergência de títulos, descrições, badges e ações.
- **Problema:** Admin, relatórios e features usam contratos distintos.
- **Evidência:** `ReportPageHeader`, Admin `PageHeader`, headers de Kanban/APF/Sustentação.
- **Escopo:** um piloto e um segundo caso real.
- **Fora do escopo:** navegação, dados e ações de negócio.
- **Benchmark:** `ReportPageHeader` e Admin `PageHeader` conforme contexto.
- **Impacto:** Alto.
- **Esforço:** Médio.
- **Prioridade:** P1.
- **Piloto:** Sala Ágil.
- **Critérios de aceite:** título, descrição, ações e responsividade preservados.
- **Validação:** snapshot/DOM, Playwright, lint e build.
- **Riscos:** duplicação de `h1` e quebra de hierarquia no shell Admin.

## 23. Riscos

- Migrar shells ou navegação sem todos os consumidores pode alterar contexto ou permissões percebidas.
- Unificar filtros pode alterar o momento da aplicação; essa alteração seria funcional e deve ser evitada.
- Unificar feedback pode alterar mensagens, duração e comportamento de erro.
- Universalizar tabelas pode esconder seleção, paginação server-side ou ações de domínio.
- Estados de permissão devem continuar sendo controlados pelos guards atuais.
- Lint passa com 1.709 warnings; esses warnings são baseline e não devem ser corrigidos incidentalmente.
- Build passa, mas há avisos de Browserslist, plugin React SWC e chunks grandes; não pertencem ao primeiro ciclo UX.

## 24. Mudanças fora do escopo

- Regras de negócio, cálculos, status e workflows.
- APIs, payloads, permissões, autenticação/autorização e integrações.
- Banco de dados e Supabase functions.
- Migração global dos dois `AppShell`.
- Escolha e migração global de biblioteca de toast sem ADR aprovado.
- Redesign visual completo, novo Design System, tokens novos, Storybook ou package novo.
- Correção de performance/chunking, Browserslist e configuração de build.

## 25. Primeiro padrão recomendado

**PageHeader operacional**, depois da correção/validação pontual de acessibilidade da tabela analítica quando o piloto passar por relatórios.

A consolidação deve partir de composição simples, manter a variante Admin sem `h1`, e ser aplicada primeiro em uma tela real de Sala Ágil.

## 26. Fluxo piloto recomendado

**Relatório de Sala Ágil**, usando `ReportPageHeader`, `ReportFilterBar` e `ReportDataTable`.

Motivos: já possui componentes compartilhados, combina header/filtros/tabela/estados/feedback, tem uso também em Sustentação e expõe um risco de acessibilidade claramente demonstrável sem tocar em regras de negócio.

## 27. Próximo passo

Executar `UX-002` em um relatório de Sala Ágil como primeiro piloto técnico. Depois validar o mesmo padrão em um relatório de Sustentação antes de propor escala para RDM, APF e Admin.

## Resultado executivo obrigatório

- **Primeiro padrão recomendado:** PageHeader operacional, com validação inicial no contexto de relatório.
- **Benchmark escolhido:** `ReportPageHeader` para relatórios; `features/admin/components/PageHeader` como referência de composição para shell Admin/operacional.
- **Fluxo piloto:** relatório de Sala Ágil.
- **Impacto esperado:** maior previsibilidade de títulos, descrições, badges e ações; melhoria de acessibilidade de tabelas se UX-002 for incluída no piloto.
- **Esforço estimado:** baixo para UX-002; médio para PageHeader em dois casos reais.
- **Risco:** baixo, desde que `h1`, ações, filtros e contratos de dados sejam preservados.
- **Primeira tarefa:** `UX-002 — Ordenação acessível em ReportDataTable`.
- **Justificativa:** é o achado P1 mais objetivo, pequeno, multi-módulo e verificável por teste, sem alteração de regra funcional.

## Validação da Fase 0

- `git status --short --branch`: branch `develop`, sem alterações locais no início e após a auditoria de aplicação.
- `npm run test -- --reporter=dot`: 140 arquivos e 614 testes aprovados.
- `npm run lint`: exit code 0, 0 erros e 1.709 warnings.
- `npm run build`: exit code 0.
- Nenhuma dependência foi instalada.
- Nenhum componente, estilo, rota, configuração, API, payload, permissão, workflow ou teste existente foi alterado.
- O único arquivo criado nesta execução é este relatório da Fase 0, conforme permitido pelo plano.
