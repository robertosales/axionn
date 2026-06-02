# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.
Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
adota [SemVer](https://semver.org/lang/pt-BR/).

---

## [1.2.0] - 2026-06-02

### Performance
- **F1** Canal Realtime unificado por time (de N canais para 1) — elimina thundering herd de WebSocket (#98)
- **F1** Cache TanStack Query com `staleTime`/`gcTime` por categoria (REALTIME 30s, MEDIUM 2min, SLOW 5min) (#98)
- **F1** Dashboard loading desacoplado — KPIs visíveis ~600ms antes do board (#98)
- **F1** Kanban limit reduzido de 500 para 200 rows por requisição (#98)
- **F2** `SustentacaoDashboard` migrado para `useDemandasPaginadas` (−90% payload inicial) (#99)
- **F2** Mutations com `invalidateAll()` em cascata — KPIs atualizam imediatamente após ações (#99)
- **F2** `useHours` staleTime 0 → STALE.REALTIME (30s) (#99)
- **F3** Kanban cursor-based pagination — 50 rows/pág vs 200 fixo para `sprintFilter=all` (#100)
- **F3** `KEYS.kanban.infinite` + `KEYS.responsaveis.byTeam` para cache granular (#100)
- **F3-UI** `KanbanLoadMoreTrigger` com IntersectionObserver — carregamento automático ao rolar (#101)
- **F3-UI** Badge 'parcial' no header do board quando carregado parcialmente (#101)
- **F4** `AuthContext` boot-sync eager — `currentTeamId` disponível no 1º render, elimina F5-Syndrome (#102)
- **F5** `SustentacaoBoard` arquivamento automático — demandas finais com +7 dias ocultadas do DOM (#102)
- **F5** Toggle Eye/EyeOff "Exibir arquivadas" + badge contador de arquivadas (#102)

### Adicionado
- Backlog lazy load com `useInfiniteQuery` + RPC paginada `get_demandas_with_responsaveis_paged` (#95)
- Versionamento automático: `APP_VERSION` injetada pelo Vite em build-time a partir do `package.json`
- `release:patch/minor/major` scripts no `package.json`
- GitHub Action `release.yml` — cria GitHub Release automaticamente ao criar tag `v*.*.*`
- GitHub Action `ci.yml` — roda vitest + eslint em todo PR contra `develop`/`main`
- `CHANGELOG.md` (este arquivo)

### Corrigido
- Dark mode no módulo de Importação Excel (classes hardcoded substituídas por variántes `dark:`) (#96)
- Paginação client-side na tabela de preview de importação (20/pág, seleção global mantida) (#96)
- `refreshTeams()` idempotente — sem setState redundante se boot-sync já resolveu (#102)
- `isArquivada()` não afeta colunas visíveis nem context-menu de movimentação (#102)

---

## [1.1.0] - 2026-05-15

### Adicionado
- Módulo de Importação Excel para demandas em lote
- Suporte a múltiplos responsáveis por demanda (`responsaveis_list`)
- Filtro por responsável no `SustentacaoBoard` e Kanban
- Módulo RDM (Registro de Decisão e Mudança)

### Corrigido
- Race condition na inicialização do contexto de sprint
- Realtime de sustentação com subscriptions duplicadas

---

## [1.0.0] - 2026-04-01

### Adicionado
- Módulo Sala Ágil (Kanban, Sprint, Backlog)
- Módulo Sustentação (Board, Dashboard, Demandas)
- Autenticação multi-tenant com times e módulos
- Controle de permissões por role (`admin`, `member`, `viewer`)
- Integração Supabase Realtime
- Suporte a temas claro/escuro
