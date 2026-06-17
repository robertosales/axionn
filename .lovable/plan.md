## Diagnóstico

### 1) Card volta à origem no Kanban (Ágil e Sustentação) para usuários comuns
Verifiquei as políticas de UPDATE no banco:

- `user_stories_update` exige `is_team_manager(...) OR assignee_id = auth.uid()`.
- `demandas_update_manager_or_responsible` exige `is_team_manager(...) OR is_demanda_responsible(auth.uid(), id)`.

Resultado: um usuário comum (membro do time, sem ser gestor nem responsável/assignee do card) consegue arrastar pelo HTML, o update otimista pinta a nova coluna, mas o `UPDATE` é negado silenciosamente pelo RLS e o realtime devolve o card à coluna original. Mesmo padrão nas duas telas.

### 2) Responsável da HU some após salvar
No `HUEditDrawer` o `assigneeId` é enviado corretamente para `updateUserStory` (SprintContext), que faz `update(... assignee_id ...).select()`. Como a política `user_stories_update` aplica `WITH CHECK (is_team_manager OR assignee_id = auth.uid())`, quando o próprio assignee se troca por outra pessoa, o `WITH CHECK` reprova o registro pós-update e o PostgREST devolve `data: []`. O `updateUserStory` exibe "nenhuma linha afetada" e/ou o estado local fica sem responsável. Para gestores também há um caminho: o `useTeamAssignees` filtra por time e, se o assignee atual não pertence ao time atual, o select aparece vazio mas o id continua, mas isso é UI; o sumiço real após salvar vem do `WITH CHECK`.

### 3) `PATCH /demandas?id=eq... 400`
A tabela `public.demandas` não possui as colunas `sla_priority` nem `data_abertura`, mas o tipo `Demanda` (src/features/sustentacao/types/demanda.ts) as declara. Sempre que o UI passa um objeto `Demanda` (ou um spread dele) para `updateDemanda`, o PostgREST devolve 400 ("column 'sla_priority' of relation 'demandas' does not exist"). `sla_priority` chega via RPC enriquecida e contamina updates subsequentes (inline edit, ações no `DemandaDetail`, etc.).

## Mudanças

### A. RLS — permitir mover cards a qualquer membro do time
Migração:

- `user_stories_update`: USING/WITH CHECK `can_view_team(auth.uid(), team_id)`.
- `demandas_update_manager_or_responsible`: renomear para `demandas_update_team_member` com USING/WITH CHECK `can_view_team(auth.uid(), team_id)`.

Isso libera drag-and-drop e edições básicas para qualquer membro do time, mantendo o isolamento por time (gerencial e exclusão continuam restritos a manager).

### B. HU — preservar responsável após salvar
- Em `src/contexts/SprintContext.tsx > updateUserStory`: trocar `.select()` por `.select().maybeSingle()` (com fallback) e, em vez de exibir "nenhuma linha afetada", refazer um `select` separado e atualizar o estado a partir dele. Isso evita perder o `assignee_id` quando o retorno do PATCH vier vazio por qualquer motivo residual de RLS/PostgREST.
- Em `src/components/HUEditDrawer.tsx`: ao montar a lista de assignees, garantir que o assignee atual da HU é incluído mesmo se não pertencer ao time corrente (fallback à lista global de developers), para não "desaparecer" visualmente.

### C. Demandas — eliminar 400 no PATCH
- Em `src/features/sustentacao/services/demandas.service.ts > updateDemanda`: aplicar um whitelist de colunas reais antes do `.update(...)`. Filtrar qualquer chave que não exista na tabela (incluindo `sla_priority`, `data_abertura`, `contract_id` quando vier do enriquecimento RPC, etc.).
- Em `src/features/sustentacao/types/demanda.ts`: marcar `sla_priority` e `data_abertura` como apenas leitura e nunca incluí-los em payloads de update.

### D. Validação
- Migração executada e políticas listadas.
- Testar com usuário comum (não-gestor): arrastar card no Ágil e na Sustentação — deve persistir.
- Editar HU como usuário comum: salvar e reabrir — `Responsável` deve continuar preenchido.
- Editar uma demanda no `DemandaDetail` e verificar console: o PATCH deve retornar 200.

## Arquivos

- supabase/migrations/<novo>.sql — política de UPDATE em `user_stories` e `demandas`.
- src/features/sustentacao/services/demandas.service.ts
- src/features/sustentacao/types/demanda.ts
- src/contexts/SprintContext.tsx
- src/components/HUEditDrawer.tsx
