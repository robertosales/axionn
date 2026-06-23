## Diagnóstico

Mesmo com **71 registros** detectados pelo filtro, todos os KPIs mostram **0** e o dropdown "Analista" só lista "Todos". Causa raiz na cadeia de dados de `RelatorioProdutividade.tsx`:

1. **`useProfiles` restringe perfis a `team_members` do time ativo.**
   - Query: `team_members WHERE team_id = currentTeamId` → `profiles IN (...)`.
2. **`demandasFiltradas`** (71) vem de `demanda_hours` do time → OK.
3. **`analistasList`** e **`grupos`** filtram por `profileIds` (`profiles.user_id`).
   - Hoje, os `user_id` que lançaram horas/são responsáveis **não estão em `team_members`** do time ativo (gestores, ex-membros, analistas alocados via `demanda_responsaveis` sem membership formal).
   - Resultado: `analistasList = []`, `grupos = []`, KPIs = 0.
4. **Exportação**: hoje só existe PDF e apenas quando `analista !== "all"`. Não há CSV nem XLSX.

## Plano de Correção

### 1. Resolver perfis pelos IDs realmente usados no relatório
Em vez de limitar a `team_members`, buscar os profiles de **todos os `user_id`** que aparecem em `demanda_hours` + `demanda_responsaveis` + responsáveis diretos da `demandas` do time.

- Criar um hook local `useReportProfiles(userIds: string[])` em `RelatorioProdutividade.tsx` (ou ampliar `useProfiles` com parâmetro opcional `userIds`) que faça:
  ```
  profiles WHERE user_id IN (ids) AND is_active = true
  ```
- Coletar os IDs a partir de `hours` + `responsaveis` + campos `responsavel_*` das `demandas` do time, deduplicar e passar ao hook.
- Manter `useProfiles` (membership) para outros usos; o relatório passa a usar o hook novo.

### 2. Remover dependência de `profileIds` no agrupamento
- `analistasList`: incluir qualquer `user_id` com horas/responsabilidade no período; usar `nomeMap` (já preenchido pelos profiles resolvidos no passo 1) com fallback para "Usuário {id curto}" se ainda assim faltar perfil.
- `grupos`: parar de filtrar `todosIds` por `profileIds` — exibir todos que têm horas no período.

### 3. Exportação CSV / XLSX / PDF
Substituir o único botão "Visualizar PDF" por um grupo de ações sempre visível (inclusive em "Todos"):

- **PDF**: manter `buildPDFBlob` atual; quando `analista === "all"`, iterar pelos `grupos` adicionando uma página por analista (mesmo layout).
- **CSV**: usar `src/lib/exportToCsv.ts` (já existe no projeto) com colunas:
  `Analista | Cargo | RHM | Projeto | Situação | Início | Fim | Horas do Analista | Data Lançamento | Fase | Descrição | Horas Lançadas`.
  Uma linha por lançamento de hora (achatado). Se a demanda não tem horas detalhadas, sai uma linha com horas vazias.
- **XLSX**: usar `xlsx` (já consta como dep transitiva) ou `xlsxwriter` via util novo `exportToXlsx` em `src/shared/components/reports/exportToXLSX.ts`, com 2 abas:
  1. **Resumo por Analista** (Nome, Cargo, Atividades, Resolvidos, Em Aberto, Taxa, Horas).
  2. **Detalhado** (mesmas colunas do CSV).
- Botões com ícones (`FileText`, `FileSpreadsheet`, `Download`) e `disabled` quando `grupos.length === 0`.

### 4. Pequenos ajustes de UX
- Mensagem de empty-state diferenciada quando há horas mas nenhum perfil resolvido: "Há lançamentos no período, mas os autores não possuem perfil ativo."
- Tooltip nos botões de exportação indicando o escopo (analista único × todos).

## Arquivos afetados

- `src/features/sustentacao/components/reports/RelatorioProdutividade.tsx` — novo hook local, remoção do filtro por `profileIds`, novos handlers e botões CSV/XLSX/PDF, PDF multi-analista.
- `src/shared/components/reports/exportToXLSX.ts` — **novo** util de exportação XLSX (2 abas).
- (Opcional) `src/features/sustentacao/hooks/useAllTransitions.ts` — adicionar `useProfilesByIds(ids)` reutilizável; ou manter o hook local no relatório.

## Não-objetivos
- Não alterar `useProfiles` existente (outros consumidores dependem da semântica de membership).
- Não mexer em RLS nem em schema de `demanda_hours` / `profiles`.
- Não tocar no relatório de Sala Ágil.
