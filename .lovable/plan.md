# Correção: busca de responsáveis + carregamento de times/analistas em relatórios

## Branch
`develop`

## Diagnóstico

### 1. Busca de responsáveis na aba "Responsáveis" da demanda
`DemandaDetail.tsx:621` e `DemandaForm.tsx:190` chamam `searchProfiles(q, currentTeamId)` usando o `currentTeamId` global do `AuthContext`. Para admin / admin_contrato (gestor) — que transitam entre times — esse valor frequentemente NÃO corresponde ao `team_id` da demanda aberta. Resultado: a busca retorna `[]` mesmo digitando nomes que existem (validado no banco: `tiago.vieira2@globalweb.com.br` é membro ativo de TIME 2 `ef0ee6b0-...`). Usuários comuns (1 time só) funcionam por coincidência.

### 2. Carregamento de times nos Relatórios
`AuthContext.refreshTeams` lê apenas `team_members` do usuário logado. Admin que não foi explicitamente adicionado a um time não enxerga aquele time no filtro de Relatórios. RLS de `teams` já permite `is_admin()` ler todos → falta apenas adaptar o fetch para admins.

### 3. Carregamento de analistas nos Relatórios
A lista de "Analista" em `RelatorioProdutividade` é derivada das demandas/horas filtradas. Como `useDemandas`, `useAllTransitions` e `useAllHours` filtram por `currentTeamId` e o select de "Time" no `ReportFilters` só atualiza estado LOCAL (não muda `currentTeamId`), trocar de time no filtro não recarrega dados → analistas ficam vazios para qualquer time diferente do ativo.

## Solução

Mantém a estrutura nova (RBAC com `user_module_roles`, `team_members`, hooks atuais). Sem migração SQL.

### Arquivos a alterar

**1. `src/features/sustentacao/components/DemandaDetail.tsx`**
- `handleSearch`: trocar `currentTeamId` por `demanda?.team_id ?? currentTeamId`.

**2. `src/features/sustentacao/components/DemandaForm.tsx`**
- `searchDemandante`: em edição, priorizar `demanda?.team_id ?? currentTeamId`. Em criação, manter `currentTeamId`.

**3. `src/contexts/AuthContext.tsx` — `refreshTeams`**
- Se `isAdmin`, fazer `SELECT id, name, module FROM teams` diretamente (RLS `teams_select_admin` permite). Caso contrário, manter o fluxo atual via `team_members`.
- Dedup mantida.

**4. `src/features/sustentacao/components/reports/ReportFilters.tsx`**
- Quando `setTeamId` for chamado e for diferente de `"all"`, também chamar `setCurrentTeamId(novoTeamId)` do `useAuth`, para que os hooks de dados (`useDemandas`, `useAllTransitions`, `useAllHours`) recarreguem com o time correto.
- Quando `"all"`: manter o currentTeamId atual (não bagunçar o contexto global se o usuário voltar para a tela do board).

**5. `src/features/sustentacao/components/reports/RelatorioProdutividade.tsx` (ajuste leve)**
- Inicializar `teamId` com `currentTeamId ?? "all"` para refletir o time ativo ao abrir o relatório.

## Validação manual após o fix

1. Logar como admin → abrir demanda do TIME 2 → aba Responsáveis → buscar "Tiago" → deve listar `tiago.vieira2@globalweb.com.br`.
2. Admin em Relatórios → dropdown "Time" mostra TODOS os times de sustentação; mudar de time recarrega dados e popula "Analista".
3. Usuário comum (Tiago) → busca e relatórios seguem funcionando com seu time.
4. Admin_contrato com múltiplos times → mesmo comportamento do admin.

## Notas técnicas

- Sem alteração de RLS — policies de `team_members`, `profiles`, `teams` já cobrem os cenários.
- Sem mudança em `services/profiles.service.ts` nem `services/responsaveis.service.ts`.
- Mudança em `refreshTeams` é aditiva: usuários não-admin seguem o caminho atual via `team_members`.
