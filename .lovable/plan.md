## Objetivo

Tornar os relatórios da Sala Ágil acessíveis diretamente pelo menu lateral, mover o "Relatório de Evidências" para dentro do catálogo de relatórios e ajustar o relatório de Produtividade para respeitar o perfil do usuário logado.

## Mudanças

### 1. Novo item de menu lateral — Sala Ágil

`src/components/layout/AppShell.tsx` (NAV_SALA_AGIL):
- Adicionar item `relatorios` apontando para `/sala-agil/relatorios`, grupo `org`, ícone `FileText`.
- **Remover** o item `gerador-apf` ("Relatório de Evidências") do menu lateral.

`src/pages/Index.tsx`:
- Adicionar `"relatorios"` em `VALID_SECTIONS`.
- Adicionar bloco `{active === "relatorios" && ...}` renderizando `SalaAgilRelatorios` (com `LazySection` + `SectionGuard permission="view_dashboard"`), reutilizando o mesmo wrapper hoje usado dentro de `MetricsDashboard` para alimentar `sprints`, `developers`, `rawData`, `teamName` e `currentUserName`. A aba "Relatórios" dentro de `/sala-agil/metricas` continua existindo (não é o foco da remoção); apenas ganha um atalho direto pela sidebar.
- A rota `gerador-apf` continua existindo internamente como fallback (o link some, mas o componente segue renderizável para não quebrar URLs antigas).

### 2. Catálogo de Relatórios — adicionar "Relatório de Evidências"

`src/components/sala-agil/reports/SalaAgilRelatorios.tsx`:
- Adicionar item no `CATALOG`: `id: "evidencias"`, título "Relatório de Evidências", descrição curta, ícone `FileText`, badge "Ágil".
- Quando `active === "evidencias"`, renderizar `ApfGeneratorPage` (o componente atual do `gerador-apf`) com um botão "Voltar" no topo equivalente aos demais (`onBack={() => setActive(null)}`), envolto em um wrapper simples para manter a UX consistente.

### 3. Relatório de Produtividade — bloqueio por perfil

`src/components/sala-agil/reports/RelatorioAtividades.tsx`:
- Receber o usuário logado via `useAuth()` (`user`, `isAdmin`).
- No `useState(filters)` inicial, definir `memberId`:
  - Admin → `"all"` (comportamento atual).
  - Não-admin → o próprio `developer.id` correspondente ao `user.id` (match por `user_id`/`profile_id` no array `developers`); fallback `"all"` caso não haja correspondência.
- No `ReportFilterBar`, marcar o campo "Analista" como `disabled` quando `!isAdmin`, garantindo que ele veja apenas seus próprios dados e não consiga trocar.
- Se o `ReportFilterBar` ainda não suportar `disabled` por campo, adicionar a flag opcional ao tipo `FilterField` e propagar para o `<Select>`/`<Input>` correspondente.

### 4. Sustentação — mesmo ajuste de Produtividade (consistência)

`src/features/sustentacao/components/reports/RelatorioProdutividade.tsx`:
- O `useState(analista)` já inicializa com `user?.id` para não-admin (linha 311). Adicionar `disabled={!isAdmin}` no campo "Analista" do filtro para impedir troca.

## Detalhes técnicos

- O `ApfGeneratorPage` é importado por `Index.tsx` via lazy; reaproveitar o mesmo import dentro de `SalaAgilRelatorios.tsx` via `lazy(() => import(...))` + `Suspense` para não engordar o bundle do catálogo.
- Match `user → developer`: usar `developers.find(d => d.user_id === user?.id || d.id === user?.id)`; se a estrutura de `developers` não expuser `user_id`, fazer match por nome como fallback (`d.name === user?.name`).
- Nenhuma mudança de schema/RLS é necessária — apenas UI/lógica de filtro.

## Fora de escopo

- Não remover a aba "Relatórios" do `MetricsDashboard` (o usuário não pediu).
- Não alterar permissões RBAC nem rotas além das listadas.
