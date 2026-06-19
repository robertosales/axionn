
## Diagnóstico — por que o SLA do contrato PF não aparece no Dashboard

Levantei o estado atual no banco e no código:

- O Dashboard de Sustentação tenta auto-selecionar o contrato do time logado via `useTeamContract(currentTeamId)` → RPC `fn_get_team_contract`.
- `fn_get_team_contract` lê **apenas** a tabela `contract_room_teams`.
- `contract_room_teams` está **vazia** (0 linhas), apesar de:
  - `teams.contract_id` estar preenchida para os 7 times (todos apontando para o contrato PF);
  - `demandas.contract_id` estar preenchida em 751/751 demandas;
  - `contract_slas` ter 4 prioridades cadastradas para cada contrato (PF e DETRAN-GO).
- Como o RPC devolve `no_contract_linked`, o filtro do dashboard fica em `"all"` e o painel "SLA POR CONTRATO" mostra "Selecione um contrato".

Selecionando o contrato manualmente no filtro o painel funciona — o problema é **vínculo Time↔Contrato fragmentado em três fontes de verdade** que nunca foram reconciliadas.

## Causas-raiz estruturais (vão além do bug do dashboard)

1. **Três caminhos paralelos para descobrir o contrato de uma demanda**, cada função escolhe um:
   - `demandas.contract_id` (direta)
   - `teams.contract_id` (FK direta no time)
   - `projects.contract_id` (via projeto)
   - `contract_room_teams (contract_id, team_id, room_type)` (N:N — a "oficial" do novo modelo, mas vazia)
   Resultado: `fn_sla_dashboard_batch` faz `COALESCE` dos quatro; `fn_get_team_contract` só lê o quarto; UIs do contrato leem o quarto; importação grava no primeiro. Inconsistência garantida.

2. **Dois hooks `useSLADashboard` distintos** em paralelo:
   - `src/features/sustentacao/hooks/useSLADashboard.ts` → RPC `fn_sla_status_summary` (usado no dashboard).
   - `src/features/contracts/hooks/useSLADashboard.ts` → RPC `fn_sla_dashboard_batch` (mais novo, com fallback correto, usado em relatórios).
   Cálculo de compliance/cor diverge entre telas.

3. **Sala (módulo) não é tratada como atributo do vínculo**, e sim do time (`teams.module`). Contratos `room_mode = 'hibrido'` (ex.: PF) deveriam permitir o mesmo time aparecer nas duas salas via `contract_room_teams.room_type`; hoje isso depende exclusivamente de `teams.module` e ignora o contrato.

4. **Hard-codes que deveriam ser configuração de contrato/banco**:
   - `SITUACAO_LABELS` / `SITUACAO_COLORS` / `SITUACAO_HEX` / `SITUACAO_MAP` duplicados em 7+ arquivos.
   - `SLA_COR_CLASS` no `DemandaDetail.tsx`.
   - `SITUACAO_CONFIG` em `contracts/DemandasPorTimeSection.tsx`.
   - Polling SLA fixo (5 min) embutido nos hooks.
   - Tipos e prazos de IMR (`src/features/sustentacao/types/imr.ts`) hoje em TS — deveriam ser parâmetros por contrato.

## Proposta de fluxo canônico

```text
Contrato (contracts)
  └─► Sala (contract_room_teams.room_type: 'agil' | 'sustentacao')
        └─► Time (teams)
              └─► Projeto (projects.contract_id, projects.team_id)
                    └─► Demanda (demandas.contract_id, project_id, team_id)
```

Regras:
- `contract_room_teams` passa a ser **fonte única de verdade** do vínculo Contrato↔Time↔Sala.
- `teams.contract_id` e `projects.contract_id` viram **derivados sincronizados por trigger** (não removidos — conforme regra de memória: nunca deletar colunas).
- Toda demanda nova herda `contract_id` da chain `project → team → crt`. Demandas órfãs disparam alerta no dashboard.
- "Sala" deixa de ser propriedade do time e passa a ser propriedade do **vínculo** (um mesmo time pode atuar em Ágil e Sustentação se o contrato for `híbrido`).

## Plano de execução (sequencial, com pontos de validação)

### Fase 1 — Backfill e reconciliação (sem mudar UI)

Migração SQL única:

1. **Popular `contract_room_teams`** a partir de `teams.contract_id`:
   - Para cada time com `contract_id NOT NULL`, criar 1 linha em `contract_room_teams` com `room_type = teams.module` (`'agil'` ou `'sustentacao'`) e `is_active = true`.
   - Para times de contrato `room_mode = 'hibrido'`, criar adicionalmente a linha da outra sala se houver demandas/projetos compatíveis.
   - `ON CONFLICT DO NOTHING` para idempotência.
2. **Backfill `demandas.contract_id`** vazias: `COALESCE(project.contract_id, team.contract_id, crt.contract_id)`.
3. **Backfill `projects.contract_id`** vazios via time.
4. Relatório de divergências (linhas que ficaram sem contrato) gravado em uma view `v_sustentacao_orfas` para o dashboard exibir como alerta.

### Fase 2 — Triggers de sincronização

5. Trigger `AFTER INSERT/UPDATE` em `contract_room_teams` → atualiza `teams.contract_id` (último vínculo ativo) para retrocompatibilidade.
6. Trigger `BEFORE INSERT` em `demandas` → se `contract_id` nulo, herda do `project_id` ou `team_id`.
7. Trigger `BEFORE INSERT` em `projects` → se `contract_id` nulo, herda do `team_id` via `contract_room_teams`.

### Fase 3 — Unificação dos RPCs e hooks de SLA

8. Atualizar `fn_get_team_contract` para também ler `teams.contract_id` como fallback (cinto + suspensório).
9. **Deprecar `fn_sla_status_summary`** e migrar `src/features/sustentacao/hooks/useSLADashboard.ts` para chamar `fn_sla_dashboard_batch` (o já existente em `contracts/hooks`). Ficaríamos com **um único hook** de SLA. Mantemos a função antiga no banco por compatibilidade.
10. Ajustar `SLADashboardSection` para a nova forma do retorno (`dentro/em_risco/violado/concluido` em vez de `green/yellow/orange/red`) — apenas troca o mapa de cores.

### Fase 4 — Auto-seleção e UX do filtro

11. No `SustentacaoDashboard`, se o usuário tem **um único contrato visível** (via `contract_room_teams` ou `teams.contract_id`), o filtro `contract_id` já entra pré-selecionado mesmo sem chave `is_active`. Hoje o `useEffect` só dispara quando `teamContract?.contract_id` existir; depois da Fase 1 isso volta a funcionar.
12. Quando houver mais de um contrato (admin global), manter `"all"` e mostrar o painel agregado por contrato (top 3) em vez do estado vazio atual.

### Fase 5 — Migração de hard-codes para o banco (incremental, não bloqueia o fix do SLA)

13. Criar tabela `public.situacao_catalog (code, label, color_hex, ordering, ativo)` populada a partir dos `SITUACAO_LABELS/COLORS/HEX` de hoje. Frontend passa a ler via hook compartilhado, removendo as 7+ cópias.
14. Mover prazos/tipos IMR de `src/features/sustentacao/types/imr.ts` para tabelas `imr_demand_types` e `imr_glosa_rules` (já citadas em memória) — proposta separada porque é grande.
15. Polling SLA passa a usar `system_settings.sla_refresh_minutes` (configurável por admin).

## Decisões que precisam da sua aprovação antes de eu codar

- **D1:** Posso considerar `contract_room_teams` como fonte única (Fase 1+2), com `teams.contract_id` virando coluna sincronizada por trigger? Ou prefere manter `teams.contract_id` editável manualmente e usar `contract_room_teams` apenas como visão N:N?
- **D2:** Para times sem `contract_id` hoje (não vi nenhum no PF, mas pode acontecer ao criar novos), bloqueio o cadastro de demandas/projetos até o admin vincular o time a um contrato?
- **D3:** Topa unificar para apenas um hook/RPC de SLA (`fn_sla_dashboard_batch`) e descontinuar o `fn_sla_status_summary`? Isso muda ligeiramente os rótulos de cor no painel (verde/amarelo/laranja/vermelho → dentro/risco/violado/concluído).
- **D4:** Fase 5 (catálogos no banco) é uma refatoração grande — quer que eu já inclua na mesma entrega ou prefere fazer só Fases 1-4 agora e abrir Fase 5 em plano separado?

## Validação após implementação

- Como Roberto no time `TIME 2`: abrir Dashboard de Sustentação → contrato PF deve aparecer auto-selecionado, painel "SLA por Contrato" deve mostrar compliance e demandas em risco (esperado: dezenas, dado o backlog de 266).
- Como admin global: filtro `"Todos"` deve listar 2 contratos com agregados.
- Importar 1 demanda nova sem `contract_id`: trigger deve preencher automaticamente a partir do time.
- `fn_get_team_contract` deve retornar o contrato tanto para times com vínculo em `contract_room_teams` quanto para os com apenas `teams.contract_id`.
