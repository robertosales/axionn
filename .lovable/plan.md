## 1. Modal de detalhes ao clicar no nome no Painel de Capacidade

Hoje `CapacityGrid` apenas lista nomes. Vou tornar cada nome clicável e abrir um `Dialog` (mesmo padrão visual usado em Sala Ágil → Métricas → Desempenho Individual).

**Conteúdo do modal por módulo:**

- **Sala Ágil (`module='agil'`)** — abas:
  - **HUs em andamento** — id, título, sprint, status, story points / horas estimadas, % de progresso.
  - **Atividades** — atividade, HU pai, status, horas planejadas vs. realizadas.
- **Sustentação (`module='sustentacao'`)** — abas:
  - **Demandas** — RHM, projeto, título, situação, SLA/cor, criada em.
  - **Horas lançadas** — data, demanda, fase, horas, descrição.

**Arquivos:**
- `src/features/admin/components/CapacityMemberDetailDialog.tsx` (novo) — Dialog com `DialogTitle/Description`, tabs shadcn, tabelas compactas.
- `src/features/admin/hooks/useMemberCapacityDetail.ts` (novo) — busca dados por `devId/userId` no módulo correto (queries em `user_stories` + `activities` para Ágil; `demandas` + `demanda_hours` para Sustentação) e respeita RLS.
- `src/features/admin/components/CapacityGrid.tsx` — nome vira `<button>` que abre o dialog e passa `{ devId, devName, module, teamId }`.

Sem alteração de regra de negócio nem de schema.

## 2. Demanda 25925 → projeto SISGCORP

Há duplicidade no banco: existe `25925` em `[SUST] SINARM 2` (fila_atendimento) e em `[SUST] SISGCORP` (fila_atendimento). Vou:
- Mover transitions/hours/evidências/eventos/responsáveis/fases da linha SINARM 2 para a linha SISGCORP (preservar histórico).
- Excluir a linha duplicada de SINARM 2.
- Tudo em migration única e transacional.

## 3. Falhas de importação (8 demandas)

Causa: o trigger `fn_validate_demanda_transition` só permite avançar **um passo** no fluxo principal. A planilha traz:
- `hom_homologada → ag_aceite_final` (pula `fila_producao`) — 28425, 28413.
- `hom_ag_homologacao → ag_aceite_final` (pula 2 passos) — 23630, 19740, 16638, 16615.
- Demandas já em `ag_aceite_final` recebendo o mesmo status — 27450, 25485 (regra de terminal barra mesmo idempotente).

Correção em `upsert_demandas_batch` (RPC do banco, sem mexer no trigger nem afrouxar regra para uso manual):

1. **Idempotência forte** — se a situação nova == situação atual, ignorar silenciosamente (inclui terminais como `ag_aceite_final`).
2. **Caminhada automática no fluxo** — quando o destino está adiante no `FLOW_PRINCIPAL`, inserir transitions intermediárias (`from→next`, `next→next+1`, …) com `justificativa = 'Importação automática (planilha)'`, satisfazendo a regra de adjacência. Para passos que exigem justificativa (`planejamento_ag_aprovacao`), usar a mesma string.
3. **Atualização final de `demandas.situacao`** segue como hoje.

Resultado esperado: as 8 demandas passam a importar sem erro, mantendo histórico coerente.

## Sem mudanças

- Nenhum schema novo, nenhuma coluna/tabela removida.
- Trigger de validação manual permanece intacto (UI manual continua exigindo passo-a-passo).
- Paletas: Sala Ágil verde, Sustentação azul — mantidas no novo modal.
