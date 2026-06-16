## Diagnóstico

Investiguei o banco e o código e localizei **duas causas-raiz distintas**, não relacionadas a UI:

### 1) Colunas do Kanban "sumindo" para não-admin (Sala Ágil e Sustentação)

As tabelas que definem as colunas do fluxo têm **apenas uma política de RLS, restrita a admin**:

| Tabela | Políticas existentes |
|---|---|
| `workflow_columns` (Sala Ágil) | `Admin full access` → `has_role(uid,'admin')` apenas |
| `sustentacao_workflow_steps` (Sustentação) | `Admin full access` → `has_role(uid,'admin')` apenas |

Como o `SELECT` é negado para qualquer perfil que não seja admin, o `useSprint` recebe `workflowColumns = []` e cai no fallback `DEFAULT_KANBAN_COLUMNS` (que **não contém** as colunas customizadas do time, como "Code Review" e "Em Teste"). O mesmo acontece em Sustentação: `useWorkflowSteps` devolve vazio → `SustentacaoBoard` usa `FLOWPRINCIPAL` mínimo. Por isso o Valter (e qualquer Dev/QA/Analista) vê um Kanban "reduzido", enquanto o admin vê todas as colunas.

Isso também explica por que o problema afeta **todos os usuários não-admin**, em ambos os módulos, mesmo após os fixes anteriores em `loadExpandedCols` e dedup de keys — o bug nunca foi de cliente; é de permissão.

### 2) Combo "Responsável" do Editar User Story incompleto (time NEXO)

O combo usa `developers` (carregado pelo `SprintContext`). No time `[NEXO] - TIME A - B`: 12 membros em `team_members`, mas apenas **8 registros em `developers`**. Os 4 membros faltantes nunca foram cadastrados na tabela `developers`, por isso não aparecem como Responsável.

Verifiquei também: a política do `developers` é OK para contract members (SELECT permitido), então não é RLS — é dado faltante por desenho (precisa estar cadastrado duas vezes: em `team_members` e em `developers`).

## Plano de correção

### Migração 1 — RLS de `workflow_columns`

Adicionar políticas para `authenticated` ler/gerenciar colunas do(s) time(s) ao qual pertence (sem mexer na política de admin existente):

```sql
-- SELECT: qualquer membro do time vê as colunas do time
CREATE POLICY "members can select workflow_columns"
  ON public.workflow_columns FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid(), team_id));

-- INSERT/UPDATE/DELETE: apenas admin já coberto pela policy existente
```

Confirmar GRANTs (já devem existir, mas garantir):

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workflow_columns TO authenticated;
GRANT ALL ON public.workflow_columns TO service_role;
```

### Migração 2 — RLS de `sustentacao_workflow_steps`

Mesma estratégia. Como o workflow de Sustentação é **global** (não vinculado a time — ver memória `global-workflow-sharing`), basta liberar SELECT a qualquer autenticado:

```sql
CREATE POLICY "authenticated can select sustentacao_workflow_steps"
  ON public.sustentacao_workflow_steps FOR SELECT TO authenticated
  USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sustentacao_workflow_steps TO authenticated;
GRANT ALL ON public.sustentacao_workflow_steps TO service_role;
```

(INSERT/UPDATE/DELETE continuam restritos a admin pela policy "Admin full access" já existente.)

### Ajuste de cliente — combo "Responsável" da HU

Em `src/components/HUEditDrawer.tsx`, trocar a fonte do combo de `developers` para **membros do time atual** (`team_members` + `profiles`), garantindo que todos os 12 membros do NEXO apareçam.

Passos:
1. Adicionar hook/efeito que carrega `team_members.user_id` do `currentTeamId` e faz join com `profiles(display_name)`.
2. Renderizar `<SelectItem value={userId}>{display_name}</SelectItem>` para cada membro, ordenado por nome.
3. Manter compatibilidade: `assigneeId` continua sendo um UUID — apenas a fonte muda.
4. Se um `assigneeId` antigo apontar para um `developers.id` que não está em `team_members`, mostrá-lo como opção legada para não quebrar HUs já salvas.

> Observação: não vou alterar o schema de `user_stories.assignee_id`. Se preferir manter o vínculo via `developers`, posso em vez disso fazer um botão "Sincronizar membros → developers" no TeamMembersManager. Diga qual abordagem prefere antes de eu implementar.

## Validação após aplicar

1. Logar como Valter (Dev) → abrir Kanban Sala Ágil do NEXO → conferir coluna "Code Review" visível.
2. Logar como QA → conferir coluna "Em Teste" visível.
3. Abrir Sustentação → conferir todas as etapas do fluxo global visíveis.
4. Abrir Backlog → Editar HU → combo "Responsável" lista os 12 membros do NEXO.
5. Rodar `supabase--linter` para checar se as novas policies não introduzem warnings.

## Arquivos impactados

- Nova migration: políticas SELECT em `workflow_columns` e `sustentacao_workflow_steps`.
- `src/components/HUEditDrawer.tsx`: fonte do combo Responsável.
- (Opcional) `src/contexts/SprintContext.tsx`: nenhum ajuste necessário, mas posso remover o fallback silencioso para `DEFAULT_KANBAN_COLUMNS` quando o time tem colunas configuradas, evitando regressões futuras.
