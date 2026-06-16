## Plano: remover obrigatoriedade de justificativa + revisão de perfis de acesso

### Parte 1 — Remover obrigatoriedade de justificativa (todas as fases)

Sistema hoje exige justificativa para: `rejeitada`, `cancelada`, `planejamento_ag_aprovacao` — em três camadas:

**1.1 Banco — trigger de validação**
Nova migration que substitui as funções dos triggers:
- `supabase/migrations/20260520060000_trigger_validate_demanda_transition.sql`
- `supabase/migrations/20260601000000_fix_trigger_rollbacks.sql`

Remove o bloco "Regra 3: Justificativa obrigatória" das funções de trigger (passa a aceitar `justificativa` nula em qualquer transição). Mantém demais regras (idempotência, status terminal, adjacência de fluxo, primeira transição). O campo `justificativa` continua existindo (não apagar coluna).

**1.2 Frontend — `src/features/sustentacao/hooks/useDemandas.ts`**
- Remover `REQUIRES_JUSTIFICATIVA` do `moveTo` (deixa de bloquear quando vazia).

**1.3 Frontend — `src/features/sustentacao/types/demanda.ts`**
- Esvaziar `REQUIRES_JUSTIFICATIVA = [] as const` (mantém o export para não quebrar imports).

**1.4 Frontend — `src/features/sustentacao/components/DemandaDetail.tsx`**
- Deixar `JustificativaDialog` opcional: não abrir automaticamente em transições para `rejeitada`/`cancelada`/`planejamento_ag_aprovacao`; move direto. Mantém o dialog disponível apenas como ação manual (campo de observação opcional ao mover).

**1.5 Importação de demandas**
- Como o trigger é a fonte da validação, removê-lo já desbloqueia o import. Confirmar em `src/features/sustentacao/hooks/useDemandasImport*` que não há checagem extra de `REQUIRES_JUSTIFICATIVA` antes do insert (ajustar se houver).

**Resultado:** demanda avança de qualquer fase para qualquer outra sem exigir justificativa, em UI e import.

---

### Parte 2 — Revisão completa de perfis de acesso (RBAC)

Regras alvo confirmadas:

| Perfil | Escopo de visualização | Escopo de edição |
|---|---|---|
| `admin` (global) | Tudo | Tudo |
| `admin_contrato` | Todos os contratos onde está como `admin_contrato` em `contract_members` (união, sem filtro pelo seletor) | Tudo dentro desses contratos |
| `admin_time` (líder do time — `team_members.role = 'leader'` ou similar) | Apenas o(s) time(s) que lidera | Tudo do(s) time(s) que lidera |
| Usuário comum (`member`) | Tudo do(s) time(s) que participa | Apenas registros onde é responsável/assignee |

**2.1 Funções de apoio (security definer)**
Nova migration cria/atualiza:
- `public.is_admin_contrato(_uid uuid, _contract_id uuid)` → existe linha em `contract_members` com `role='admin_contrato'`.
- `public.user_contract_ids(_uid uuid)` → contratos em que é `admin_contrato`.
- `public.is_team_leader(_uid uuid, _team_id uuid)` → líder em `team_members`.
- `public.user_team_ids(_uid uuid)` → todos os times do usuário (via `team_members` + `profiles.team_id`).
- `public.can_view_demanda(_uid, demanda_id)` e equivalente para HU/sprint/atividade — usa as funções acima.
- `public.can_edit_demanda(_uid, demanda_id)` — admin/admin_contrato/admin_time veem tudo; member só edita se é responsável (responsavel_dev/req/arq/teste, criado_por ou `demanda_responsaveis`).

Todas `SECURITY DEFINER` para evitar recursão em RLS.

**2.2 Reescrita das policies (mesma migration)**
Tabelas afetadas (SELECT + INSERT/UPDATE/DELETE reescritos seguindo a matriz):

Sustentação: `demandas`, `demanda_hours`, `demanda_evidencias`, `demanda_fases`, `demanda_responsaveis`, `demanda_transitions`, `demanda_eventos`, `impediments`, `attachments`, `activity_comments`.

Sala Ágil: `user_stories`, `sprints`, `activities`, `epics`, `releases`, `workflow_columns`, `developers`, `planning_*`, `retro_*`, `impediments`.

Comum: `teams`, `team_members`, `projects`, `project_teams`, `contracts`, `contract_members`, `contract_room_teams`, `contract_slas`, `notifications`, `calendar_events`, `okr_*`, `rdms` e tabelas RDM.

Padrão de policy (exemplo `demandas`):
```sql
-- SELECT
USING (
  public.has_role(auth.uid(),'admin')
  OR EXISTS (SELECT 1 FROM contract_members cm
             WHERE cm.user_id = auth.uid()
               AND cm.role = 'admin_contrato'
               AND cm.contract_id = demandas.contract_id)
  OR demandas.team_id = ANY(public.user_team_ids(auth.uid()))
);
-- UPDATE/DELETE: idem + para member, exige ser responsável
```

GRANTs `SELECT/INSERT/UPDATE/DELETE` a `authenticated`, `ALL` a `service_role` mantidos em todas.

**2.3 Frontend — alinhamento**
- `src/app/hooks/usePermissions.ts` (ou equivalente): expor `isAdmin`, `isAdminContrato`, `isTeamLeader(teamId)`, `canEdit(record)` — derivados das mesmas regras, para esconder botões.
- `src/app/contexts/AuthContext.tsx`: carregar `contract_memberships` e `team_memberships` no login, com role.
- Listagens: deixar de filtrar por team no client quando RLS já filtra (evita lista vazia para admin_contrato). Manter filtros visuais (seletor de time/contrato) como conveniência.
- Botões de editar/excluir em HU, Demanda, Atividade, Sprint: usar `canEdit(record)`.
- Dashboard Admin: seletor de contrato passa a ser **apenas filtro visual** (não restringe permissão).

**2.4 Validação manual após migrar**
Testar com 4 contas (uma por perfil) em: Kanban Sustentação, Kanban Ágil, Backlog, Detalhe de demanda (botões), Sprint, Métricas, Times. Verificar:
- admin vê tudo.
- admin_contrato vê só seus contratos, edita tudo neles.
- admin_time vê só seu(s) time(s), edita tudo neles.
- member vê tudo do time, mas só edita o que é dele (botões desabilitados nos demais).

### Detalhes técnicos

- Tudo via migrations (DDL + funções + policies). Nenhuma coluna/tabela apagada.
- Coluna `justificativa` é preservada — só deixa de ser obrigatória.
- Funções `SECURITY DEFINER` evitam recursão em RLS (padrão `has_role`).
- Tabela `user_roles` segue como fonte de verdade do role global; `contract_members.role` define admin_contrato; `team_members.role` define líder.
- Memória `mem://features/sustentacao/evidence-management-logic` será atualizada para refletir que justificativa não é mais obrigatória (já que evidência também não é).

### Ordem de execução

1. Migration A: remover validação de justificativa nos triggers.
2. Patch frontend (1.2–1.4) para deixar de exigir e não abrir dialog automático.
3. Migration B: funções helpers de RBAC + reescrita de policies (em uma única migration grande, transacional).
4. Patch frontend de permissões (2.3).
5. Validação manual.
