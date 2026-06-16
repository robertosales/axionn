
## 1. Aba "Atividades" (DemandaDetail) — filtro de analista + paginação

**Arquivo:** `src/features/sustentacao/components/DemandaDetail.tsx`

- Adicionar dois estados novos no componente: `analystFilter` (string com `user_id` ou `"all"`) e `hoursPage` (número, default 1). Tamanho de página fixo em 10.
- Carregar a lista de usuários do time atual (membros de `team_members` do `currentTeamId`) já mapeados em `profilesMap`. Reaproveitar `profilesMap`/lookup existente; se necessário, expandir a query inicial para incluir todos os membros do time, não só os que já lançaram horas.
- Detectar permissão:
  - `isAdmin` (já disponível em `useAuth`).
  - `isContractAdmin` = `getModuleRole("sustentacao") === "admin_contrato"` (via `useAuth`).
  - `canFilterAll = isAdmin || isContractAdmin`.
- Default do combo:
  - Sempre inicia com `user?.id` selecionado.
- Renderização do combo (acima da tabela "Atividades"):
  - `Select` (shadcn) com label "Analista".
  - Se `canFilterAll`: habilitado, primeira opção `"Todos"` + uma opção por membro do time.
  - Se usuário comum: desabilitado, exibindo apenas o nome do usuário logado.
- Aplicar filtro à lista `hours` antes de renderizar:
  - `filteredHours = analystFilter === "all" ? hours : hours.filter(h => h.user_id === analystFilter)`.
  - Para usuário comum: forçar `analystFilter = user.id` (ignorar qualquer outro valor).
- Paginação:
  - Slice de `filteredHours` por `hoursPage` (10 por página).
  - Resetar `hoursPage` para 1 sempre que `analystFilter` ou `hours.length` mudar.
  - Rodapé da tabela com controles: "Anterior / Próximo", indicador "Página X de Y" e total de itens. Usar o mesmo padrão dos demais paginadores do módulo (ex.: `DemandasList` / `ProjetosManager`) para manter consistência visual.
- Não alterar a lógica de criação/edição/exclusão de lançamentos.

## 2. Remoção da obrigatoriedade de evidência

### 2.1 Tela de Demanda
**Arquivo:** `src/features/sustentacao/components/DemandaDetail.tsx`

- Em `getMissingEvidencias`: passar a retornar sempre `[]` (manter assinatura para evitar churn nos chamadores) ou remover a chamada onde está sendo usada em `handleStatusChange` (linhas ~478–482) e excluir o `toast.warning`, o `setActiveTab("evidencias")` e o `setPendingTarget`.
- Remover/ocultar o banner amarelo em `TabsContent value="evidencias"` que mostra "Para avançar para … cadastre ao menos uma evidência" (linha ~1588). A aba "Evidências" continua existindo para upload opcional; só sai a sinalização de obrigatoriedade.
- Remover constantes/variáveis que ficarem órfãs (`pendingTarget` se não tiver mais usos, etc.) — apenas se realmente não forem mais usadas, sem mexer em outros fluxos.

### 2.2 Importação de Demandas
**Arquivo:** `src/features/sustentacao/components/ImportacaoView.tsx` (e `ImportacaoPreviewTable.tsx` se necessário)

- Confirmação prévia: a busca atual mostrou que o fluxo de importação não exige evidências. Nenhuma alteração de código provavelmente é necessária aqui, mas a etapa do plano é reler o arquivo para garantir e remover qualquer validação remanescente que mencione `evidencia`/`evidência`.

### 2.3 Banco de dados
**Diagnóstico já feito:**

- Não há `CHECK constraint` exigindo evidência em `demandas`, `demanda_evidencias` ou `demanda_fases`.
- A trigger `trg_validate_demanda_transition` (função `validate_demanda_transition`) apenas valida o conjunto de status e grava o histórico — não exige evidência.
- A trigger `fn_validate_demanda_transition` (em `demanda_transitions`) valida fluxo/justificativa, mas também não cita evidência.

**Ação:** criar uma migração "no-op de auditoria" só se for descoberta alguma regra de evidência ao reler completamente as duas funções de trigger. Caso contrário, registrar no plano que o banco já não exige evidência e nenhuma migração é necessária.

## Resultado esperado

- Combo de Analista visível na aba "Atividades", com paginação de 10 em 10.
- Admin / Admin de Contrato: filtro livre (inclui "Todos").
- Usuário comum: combo travado no próprio usuário, vê apenas seus lançamentos.
- Demanda avança de fase sem nenhuma evidência cadastrada, em qualquer fluxo (UI, importação, banco).

## Pontos a confirmar antes de implementar

- Tamanho de página da listagem de atividades: usar **10** por padrão (alinha com o restante do módulo)? Ou prefere 20?
- "Usuário comum" inclui qualquer perfil que não seja `admin` nem `admin_contrato` do módulo Sustentação — confirma esse critério?
