# Plano Mestre de Implementação — Fechamento do Ciclo de OKRs no Axionn

**Sistema:** Axionn  
**Repositório de referência:** `robertosales/axionn`  
**Branch-base analisada:** `develop`  
**Documento de origem:** `ANALISE_ARQUITETURAL_PLANO_FINALIZACAO_OKR_AXIONN.md`  
**Objetivo deste documento:** especificar as implementações necessárias para transformar o módulo atual em uma solução completa de planejamento, execução, acompanhamento, governança e encerramento de ciclos de OKRs.

---

# 1. Resultado esperado

Ao final deste plano, o Axionn deverá permitir que uma organização execute o ciclo completo de OKRs:

1. criar e configurar um ciclo;
2. registrar direcionadores estratégicos;
3. criar Objectives e Key Results;
4. validar e publicar os OKRs;
5. alinhar objetivos organizacionais, de produto, contrato e time;
6. vincular iniciativas e atividades;
7. realizar check-ins manuais;
8. medir KRs automaticamente;
9. acompanhar confiança, riscos, tendências e alertas;
10. realizar reuniões de acompanhamento;
11. encerrar Objectives;
12. encerrar o ciclo;
13. registrar avaliação final e lições aprendidas;
14. transportar itens aprovados para o próximo ciclo;
15. preservar histórico, evidências e auditoria;
16. comparar resultados entre ciclos.

O módulo somente será considerado concluído quando todas essas etapas estiverem disponíveis, protegidas por tenant, entitlement e RBAC, cobertas por testes e operáveis em produção.

---

# 2. Princípios não negociáveis

## 2.1 Autoridade do backend

O frontend não poderá executar diretamente operações críticas de:

- criação;
- publicação;
- edição estrutural;
- check-in;
- mudança de meta;
- alteração de peso;
- conclusão;
- cancelamento;
- arquivamento;
- carry-forward;
- fechamento de ciclo.

Essas operações deverão passar por RPCs transacionais no PostgreSQL ou por Edge Functions que chamem essas RPCs.

## 2.2 Preservação de histórico

Depois que um Objective for publicado:

- não poderá ser excluído fisicamente pela aplicação;
- seus KRs não poderão ser excluídos fisicamente;
- check-ins não poderão ser apagados;
- snapshots não poderão ser atualizados ou apagados;
- auditoria não poderá desaparecer por cascata.

A operação padrão será **arquivamento lógico**.

## 2.3 Motor único de cálculo

O progresso e a saúde dos OKRs deverão ser calculados por funções canônicas no backend.

Não poderá existir fórmula concorrente em:

- componentes React;
- hooks;
- serviços frontend;
- Edge Functions;
- triggers legados.

O frontend deverá somente apresentar os resultados retornados pelo backend.

## 2.4 Separação de controles

O acesso deverá ser composto por cinco camadas independentes:

1. **Feature flag:** controla rollout técnico.
2. **Entitlement:** controla o que o plano comercial oferece.
3. **RBAC:** controla o que o usuário pode fazer.
4. **RLS:** controla quais registros o usuário pode acessar.
5. **RPC:** valida e executa a regra de negócio.

## 2.5 Processamento transacional

Check-ins, alterações de meta, fechamento e carry-forward deverão ser executados em transações únicas.

Uma falha não poderá deixar parte da operação persistida.

## 2.6 Ciclo como entidade de negócio

O trimestre não poderá continuar sendo apenas uma string no Objective.

Deverá existir uma entidade `okr_cycles`, responsável por:

- período;
- cadence;
- lifecycle;
- publicação;
- fechamento;
- regras;
- governança;
- configuração de scoring.

---

# 3. Escopo funcional obrigatório

## 3.1 Gestão de ciclos

O sistema deverá permitir:

- criar ciclo trimestral, anual ou customizado;
- definir nome e código;
- definir data inicial e final;
- definir timezone;
- definir frequência de check-in;
- definir quantidade recomendada de Objectives;
- definir quantidade recomendada de KRs;
- definir método de consolidação;
- manter o ciclo em planejamento;
- publicar o ciclo;
- iniciar o ciclo;
- entrar em fechamento;
- fechar o ciclo;
- arquivar o ciclo;
- duplicar configurações de um ciclo anterior;
- consultar ciclos passados e futuros.

## 3.2 Gestão de Objectives

O sistema deverá permitir:

- criar Objective em rascunho;
- selecionar owner;
- selecionar sponsor;
- definir nível estratégico;
- definir escopo;
- associar time, projeto, produto ou contrato;
- vincular a um objetivo superior;
- registrar descrição, contexto e resultado esperado;
- executar validação de qualidade;
- publicar;
- pausar;
- cancelar;
- concluir;
- arquivar;
- transportar para outro ciclo com justificativa.

## 3.3 Gestão de Key Results

Cada KR deverá possuir:

- título;
- descrição;
- owner;
- tipo;
- unidade;
- baseline;
- valor atual;
- meta;
- direção;
- faixa mínima e máxima quando aplicável;
- peso;
- frequência de atualização;
- método de atualização;
- fonte de dados;
- configuração de métrica;
- início e fim;
- tolerância;
- status;
- progresso calculado;
- progresso bruto;
- saúde;
- qualidade da medição;
- data da última medição.

## 3.4 Check-ins

O check-in deverá registrar:

- valor medido;
- valor anterior;
- progresso;
- confiança;
- resumo;
- riscos;
- próximos passos;
- evidências;
- autor;
- data;
- origem;
- período da medição.

Também deverá:

- recalcular o KR;
- recalcular o Objective;
- gerar snapshot;
- gerar ou resolver alertas;
- registrar auditoria;
- atualizar conformidade de cadence.

## 3.5 Iniciativas

A iniciativa deverá possuir:

- título;
- descrição;
- owner;
- prioridade;
- status;
- início;
- prazo;
- progresso;
- Objective relacionado;
- KR relacionado;
- entidade operacional relacionada;
- dependências;
- motivo de cancelamento;
- conclusão;
- auditoria.

## 3.6 Alinhamento

O sistema deverá permitir:

- Objective organizacional;
- Objective de portfólio;
- Objective de produto;
- Objective de contrato;
- Objective de projeto;
- Objective de time;
- contribuição para um ou mais Objectives superiores;
- percentual ou tipo de contribuição;
- consulta da árvore de alinhamento;
- detecção de Objective não alinhado.

## 3.7 Acompanhamento gerencial

O módulo deverá apresentar:

- progresso;
- saúde;
- confiança;
- tendência;
- frequência dos check-ins;
- KRs sem dados;
- métricas atrasadas;
- iniciativas vencidas;
- riscos;
- alertas;
- comentários;
- decisões;
- histórico;
- comparação planejado versus realizado.

## 3.8 Encerramento

O encerramento deverá exigir:

- score final;
- valor final de cada KR;
- justificativa;
- avaliação qualitativa;
- impacto obtido;
- lições aprendidas;
- decisão de continuidade;
- aprovação do owner;
- aprovação do sponsor quando configurada;
- snapshot final;
- bloqueio de edição;
- carry-forward controlado.

---

# 4. Modelo operacional do ciclo

## 4.1 Estados do ciclo

```text
planning
    ↓ publish
active
    ↓ start_closing
closing
    ↓ close
closed
    ↓ archive
archived
```

Transições excepcionais:

```text
planning → cancelled
active → cancelled
closing → active, somente por OKR Admin e com justificativa
```

## 4.2 Estados do Objective

```text
draft
    ↓ validate
ready
    ↓ publish
active
    ├── pause → paused → resume → active
    ├── cancel → cancelled
    └── start_review → under_review
                         ├── complete → completed
                         ├── carry_forward → carried_forward
                         └── return → active
completed/cancelled/carried_forward
    ↓ archive
archived
```

## 4.3 Estados do KR

```text
draft
    ↓ publish
active
    ├── pause → paused
    ├── cancel → cancelled
    └── complete → completed
completed/cancelled
    ↓ archive
archived
```

## 4.4 Estados da iniciativa

```text
planned
    ↓ start
in_progress
    ├── block → blocked
    ├── complete → completed
    └── cancel → cancelled
blocked
    ├── resume → in_progress
    └── cancel → cancelled
```

## 4.5 Regras de transição

- Somente Objectives `draft` ou `ready` podem sofrer alterações estruturais completas.
- Depois de publicado, alteração de meta exige processo de change control.
- Objective não pode ser concluído sem KRs.
- Objective não pode ser concluído com KR ativo sem decisão explícita.
- Ciclo não pode ser fechado enquanto houver Objectives `active` ou `under_review`.
- Objective concluído não pode voltar a ativo sem uma reabertura auditada.
- Archive não apaga registros.
- Ciclo fechado não aceita novos check-ins.

---

# 5. Alterações no banco de dados

## 5.1 Nova tabela `okr_cycles`

### Objetivo

Representar o ciclo formalmente e eliminar dependência de strings como `Q3/2026`.

### Campos

```sql
id uuid primary key
organization_id uuid not null
code text not null
name text not null
cycle_type text not null
starts_at date not null
ends_at date not null
timezone text not null default 'America/Sao_Paulo'
status text not null
check_in_frequency text not null
check_in_weekday smallint
check_in_grace_days integer not null default 1
recommended_objectives_min integer
recommended_objectives_max integer
recommended_krs_min integer
recommended_krs_max integer
scoring_method text not null default 'weighted_or_average'
allow_overachievement boolean not null default true
settings jsonb not null default '{}'
published_at timestamptz
published_by uuid
closing_started_at timestamptz
closed_at timestamptz
closed_by uuid
created_at timestamptz not null
created_by uuid
updated_at timestamptz not null
updated_by uuid
archived_at timestamptz
archived_by uuid
```

### Constraints

- `starts_at <= ends_at`
- `code` único por organização
- status válido
- cadence válida
- limites recomendados coerentes
- timezone válido pela aplicação
- somente um ciclo ativo por código e organização

### Índices

- organização + status;
- organização + período;
- organização + código;
- período ativo.

---

## 5.2 Alterações em `okr_objectives`

### Novos campos

```sql
organization_id uuid not null
cycle_id uuid not null
sponsor_id uuid
objective_level text not null default 'team'
scope_type text not null default 'team'
scope_id uuid
parent_objective_id uuid
quality_score numeric
quality_status text
quality_issues jsonb not null default '[]'
published_at timestamptz
published_by uuid
paused_at timestamptz
cancelled_at timestamptz
cancelled_by uuid
cancellation_reason text
review_started_at timestamptz
completed_at timestamptz
completed_by uuid
archived_at timestamptz
archived_by uuid
version integer not null default 1
lock_version integer not null default 0
```

### Ajustes

- tornar `team_id` opcional para Objectives organizacionais;
- remover `ON DELETE CASCADE` de relações que apaguem histórico;
- manter o campo textual `cycle` somente durante o período de compatibilidade;
- criar backfill para `cycle_id`;
- impedir Objective sem `organization_id`.

### Constraints

- Objective `team` exige `team_id`;
- Objective organizacional não exige time;
- owner obrigatório para publicação;
- sponsor opcional por configuração;
- `completed_at` exige status concluído;
- `archived_at` exige status arquivado.

---

## 5.3 Nova tabela `okr_objective_alignments`

### Campos

```sql
id uuid primary key
organization_id uuid not null
source_objective_id uuid not null
target_objective_id uuid not null
alignment_type text not null
contribution_weight numeric
rationale text
created_at timestamptz not null
created_by uuid not null
archived_at timestamptz
```

### Regras

- Objective não pode alinhar a si mesmo;
- não permitir ciclos recursivos;
- origem e destino devem pertencer à mesma organização;
- peso deve estar entre 0 e 100;
- alinhamento pode ser:
  - contributes_to;
  - supports;
  - depends_on;
  - conflicts_with.

---

## 5.4 Alterações em `okr_key_results`

### Novos campos

```sql
kr_type text not null default 'outcome'
target_tolerance numeric
confidence numeric
confidence_updated_at timestamptz
published_at timestamptz
published_by uuid
paused_at timestamptz
cancelled_at timestamptz
cancellation_reason text
completed_at timestamptz
archived_at timestamptz
version integer not null default 1
lock_version integer not null default 0
```

### Tipos de KR

- `outcome`
- `output`
- `guardrail`
- `health_metric`
- `milestone`

### Regras

- `range` exige `target_min` e `target_max`;
- `automatic` exige `metric_code`;
- `hybrid` exige métrica e permite check-in manual;
- peso, quando utilizado, deve estar entre 0 e 100;
- baseline e target obrigatórios para publicação;
- owner obrigatório para publicação;
- KR arquivado não participa do cálculo;
- KR cancelado não participa do cálculo;
- guardrail pode ter regra de violação separada.

---

## 5.5 Alterações em `okr_check_ins`

### Novos campos

```sql
organization_id uuid not null
cycle_id uuid not null
check_in_type text not null
period_start date
period_end date
progress_before numeric
progress_after numeric
health_before text
health_after text
confidence_before numeric
confidence_after numeric
is_late boolean not null default false
cadence_due_at timestamptz
correlation_id uuid not null
source text not null
```

### Regras

- append-only;
- sem UPDATE ou DELETE pela aplicação;
- confiança entre 0 e 100;
- evidence validada;
- data não pode ser posterior ao fechamento;
- check-in automático deve usar `source = automatic_metric`;
- reprocessamento deve criar snapshot, não sobrescrever histórico.

---

## 5.6 Alterações em `okr_initiatives`

### Novos campos

```sql
organization_id uuid not null
priority text not null default 'medium'
start_date date
progress numeric not null default 0
blocked_reason text
cancelled_reason text
linked_entity_module text
dependency_metadata jsonb not null default '{}'
version integer not null default 1
archived_at timestamptz
```

### Regras

- progresso entre 0 e 100;
- status completed exige progresso 100;
- due date anterior ao início é inválida;
- vínculo com KR deve pertencer ao mesmo Objective;
- owner obrigatório para publicação;
- iniciativa não afeta automaticamente o score do KR.

---

## 5.7 Nova tabela `okr_initiative_dependencies`

```sql
id uuid primary key
organization_id uuid not null
initiative_id uuid not null
depends_on_initiative_id uuid not null
dependency_type text not null
created_at timestamptz not null
created_by uuid not null
```

Regras:

- sem autorreferência;
- sem dependência circular;
- mesma organização.

---

## 5.8 Nova tabela `okr_objective_reviews`

### Objetivo

Registrar o encerramento formal de cada Objective.

### Campos

```sql
id uuid primary key
organization_id uuid not null
cycle_id uuid not null
objective_id uuid not null
review_status text not null
final_score numeric
final_health text
impact_rating text
outcome_summary text
what_worked text
what_did_not_work text
lessons_learned text
recommendation text
carry_forward_decision text
carry_forward_reason text
reviewed_by uuid
reviewed_at timestamptz
approved_by uuid
approved_at timestamptz
created_at timestamptz not null
updated_at timestamptz not null
```

### Estados

- pending;
- in_review;
- submitted;
- approved;
- rejected.

---

## 5.9 Nova tabela `okr_cycle_reviews`

### Campos

```sql
id uuid primary key
organization_id uuid not null
cycle_id uuid not null unique
final_score numeric
objectives_total integer
objectives_completed integer
objectives_cancelled integer
objectives_carried_forward integer
check_in_compliance numeric
main_achievements text
main_failures text
cross_team_dependencies text
lessons_learned text
strategic_recommendations text
approved_by uuid
approved_at timestamptz
created_at timestamptz not null
updated_at timestamptz not null
```

---

## 5.10 Nova tabela `okr_carry_forward_links`

```sql
id uuid primary key
organization_id uuid not null
source_cycle_id uuid not null
source_objective_id uuid not null
target_cycle_id uuid not null
target_objective_id uuid not null
carry_forward_type text not null
reason text not null
created_at timestamptz not null
created_by uuid not null
```

Tipos:

- full_objective;
- selected_key_results;
- rewritten_objective;
- learning_only.

---

## 5.11 Catálogo de métricas

### `okr_metric_definitions`

```sql
id uuid primary key
organization_id uuid
code text not null
name text not null
description text
unit text not null
direction text not null
source_module text not null
scope_types text[] not null
status text not null
created_at timestamptz not null
created_by uuid
```

### `okr_metric_versions`

```sql
id uuid primary key
metric_definition_id uuid not null
version text not null
formula_type text not null
formula_definition jsonb not null
input_contract jsonb not null
output_contract jsonb not null
effective_from timestamptz not null
deprecated_at timestamptz
created_at timestamptz not null
created_by uuid
```

### `okr_metric_bindings`

```sql
id uuid primary key
organization_id uuid not null
key_result_id uuid not null unique
metric_version_id uuid not null
scope_type text not null
scope_id uuid
frequency text not null
timezone text not null
configuration jsonb not null
last_success_at timestamptz
last_error_at timestamptz
last_error text
status text not null
created_at timestamptz not null
updated_at timestamptz not null
```

---

## 5.12 Alertas

Ampliar `okr_alerts` com:

```sql
organization_id uuid not null
cycle_id uuid
initiative_id uuid
rule_code text not null
first_detected_at timestamptz not null
last_detected_at timestamptz not null
acknowledged_at timestamptz
acknowledged_by uuid
resolution_note text
occurrence_count integer not null default 1
correlation_id uuid
```

Regras obrigatórias:

- `objective.health_gap`;
- `objective.no_owner`;
- `objective.no_alignment`;
- `kr.no_baseline`;
- `kr.no_measurement`;
- `kr.stale_measurement`;
- `kr.low_confidence`;
- `kr.automatic_measurement_error`;
- `kr.guardrail_violation`;
- `initiative.overdue`;
- `initiative.blocked`;
- `cycle.check_in_non_compliance`.

---

## 5.13 Auditoria

A tabela `okr_audit_log` deverá:

- deixar de usar cascata destrutiva;
- armazenar organização;
- armazenar ciclo;
- armazenar tipo de entidade;
- armazenar id da entidade;
- armazenar ação;
- armazenar versão;
- armazenar antes e depois;
- armazenar motivo;
- armazenar correlation ID;
- armazenar IP ou contexto quando disponível.

Ações obrigatórias:

- cycle_created;
- cycle_published;
- cycle_closed;
- objective_created;
- objective_updated;
- objective_published;
- objective_paused;
- objective_resumed;
- objective_cancelled;
- objective_completed;
- objective_archived;
- objective_reopened;
- kr_created;
- kr_updated;
- kr_target_changed;
- kr_archived;
- check_in_recorded;
- automatic_measurement_recorded;
- health_overridden;
- initiative_created;
- initiative_updated;
- initiative_completed;
- alert_acknowledged;
- review_submitted;
- review_approved;
- carry_forward_created.

---

# 6. Migrations necessárias

## 6.1 Migration 1 — Preflight e correção de versões

Objetivo:

- eliminar colisões de timestamps;
- mapear migrations já aplicadas;
- criar runbook de compensação;
- não renomear silenciosamente arquivo aplicado.

Entregáveis:

- relatório de `schema_migrations`;
- mapa por ambiente;
- migrations compensatórias;
- teste de `supabase db reset`.

## 6.2 Migration 2 — Ciclos e organization_id

Objetivo:

- criar `okr_cycles`;
- adicionar `organization_id` e `cycle_id`;
- realizar backfill;
- validar tenant;
- manter compatibilidade temporária.

## 6.3 Migration 3 — Lifecycle, alinhamento e revisão

Objetivo:

- ampliar Objectives e KRs;
- criar alinhamentos;
- criar reviews;
- criar carry-forward;
- remover cascatas destrutivas.

## 6.4 Migration 4 — Métricas e fila

Objetivo:

- criar catálogo;
- criar bindings;
- ampliar fila;
- adicionar leases e dead-letter;
- criar funções de claim.

## 6.5 Migration 5 — RBAC e RLS

Objetivo:

- cadastrar permissões;
- mapear roles;
- revogar mutações diretas;
- criar policies de leitura;
- liberar somente RPCs.

## 6.6 Migration 6 — Funções canônicas

Objetivo:

- criar motor de cálculo;
- criar RPCs transacionais;
- remover trigger legado;
- reconciliar valores.

## 6.7 Migration 7 — Auditoria e alertas

Objetivo:

- auditoria completa;
- alertas estáveis;
- snapshots imutáveis;
- append-only.

---

# 7. Motor canônico de cálculo

## 7.1 Função de progresso do KR

Criar:

```sql
calculate_okr_kr_progress_v2(
  p_direction text,
  p_baseline numeric,
  p_current numeric,
  p_target numeric,
  p_target_min numeric,
  p_target_max numeric,
  p_allow_overachievement boolean
)
```

Retorno:

```text
raw_progress
calculated_progress
calculation_status
calculation_reason
```

## 7.2 Aumento

```text
raw = (current - baseline) / (target - baseline) × 100
```

## 7.3 Redução

```text
raw = (baseline - current) / (baseline - target) × 100
```

## 7.4 Faixa

- dentro da faixa: 100%;
- fora da faixa: calcular aproximação ao limite aplicável;
- baseline dentro da faixa deve receber tratamento explícito;
- faixa inválida deve retornar erro de configuração.

## 7.5 Booleano

- false → true;
- baseline e target explícitos;
- não usar regra implícita diferente do modelo comum.

## 7.6 Overachievement

- `raw_progress` pode ultrapassar 100;
- `calculated_progress` deverá seguir configuração do ciclo;
- dashboards devem informar overachievement sem distorcer consolidação.

## 7.7 Progresso do Objective

Criar:

```sql
recalculate_okr_objective_v2(p_objective_id uuid)
```

Regras:

- ignorar KR draft, paused, cancelled e archived;
- respeitar pesos;
- se nenhum KR tiver peso, usar média simples;
- se algum peso for usado, todos os KRs ativos precisam de peso;
- soma dos pesos deve ser 100;
- sem dados não pode ser convertido em zero;
- retornar `no_data` quando não houver medição.

## 7.8 Saúde

Criar:

```sql
resolve_okr_objective_health_v2(
  p_progress numeric,
  p_expected_progress numeric,
  p_confidence numeric,
  p_measurement_quality text,
  p_lifecycle_status text
)
```

Sinais:

- progresso versus tempo;
- confiança;
- staleness;
- guardrail;
- qualidade da medição;
- lifecycle.

Saúdes:

- no_data;
- on_track;
- attention;
- at_risk;
- completed.

---

# 8. RPCs obrigatórias

## 8.1 Ciclos

### `create_okr_cycle_v1`

Responsabilidades:

- validar organização;
- validar permissão;
- validar datas;
- criar ciclo;
- registrar auditoria.

### `publish_okr_cycle_v1`

Responsabilidades:

- validar qualidade;
- validar regras;
- publicar;
- bloquear configurações críticas;
- registrar auditoria.

### `start_okr_cycle_closing_v1`

Responsabilidades:

- mudar para closing;
- gerar pendências;
- gerar reviews;
- impedir novos Objectives.

### `close_okr_cycle_v1`

Responsabilidades:

- validar reviews;
- gerar snapshot consolidado;
- congelar dados;
- gerar review do ciclo;
- fechar;
- auditar.

---

## 8.2 Objectives

### `create_okr_objective_v2`

Entrada:

- cycle;
- level;
- scope;
- team;
- owner;
- sponsor;
- title;
- description;
- dates;
- parent alignments.

### `update_okr_objective_v2`

Regras:

- optimistic locking;
- alterações estruturais por lifecycle;
- justificativa para mudanças críticas;
- auditoria before/after.

### `publish_okr_objective_v2`

Validações:

- owner;
- Objective válido;
- 2 a 5 KRs, salvo configuração;
- baseline e meta;
- pesos;
- fontes;
- datas;
- alinhamento quando obrigatório.

### `archive_okr_objective_v2`

- não executar DELETE;
- marcar `archived`;
- preservar tudo;
- remover do cálculo ativo;
- registrar motivo.

### `reopen_okr_objective_v1`

- somente admin;
- justificativa obrigatória;
- criar nova versão;
- auditar.

---

## 8.3 Key Results

### `create_okr_key_result_v2`

- validar Objective;
- validar tenant;
- validar lifecycle;
- validar entitlement;
- validar RBAC;
- criar em draft.

### `update_okr_key_result_v2`

Deverá atualizar atomicamente:

- `target`;
- `target_value`;
- baseline;
- range;
- direção;
- unidade;
- peso;
- owner;
- fonte;
- frequência.

### `change_okr_key_result_target_v1`

Depois da publicação:

- exigir motivo;
- registrar target anterior;
- criar versão;
- recalcular;
- gerar auditoria;
- opcionalmente exigir aprovação do sponsor.

### `archive_okr_key_result_v2`

- archive lógico;
- sem cascade;
- recalcular Objective;
- auditar.

---

## 8.4 Check-in

### `record_okr_check_in_v2`

Fluxo obrigatório:

1. validar usuário;
2. validar organização;
3. validar acesso ao KR;
4. validar entitlement;
5. validar permissão;
6. verificar ciclo ativo;
7. verificar KR ativo ou híbrido;
8. bloquear KR;
9. calcular atraso;
10. inserir check-in;
11. executar motor canônico;
12. atualizar KR;
13. criar snapshot;
14. recalcular Objective;
15. gerar ou resolver alertas;
16. atualizar cadence;
17. registrar auditoria;
18. retornar Objective completo.

Toda a operação deverá ocorrer em uma única transação.

---

## 8.5 Iniciativas

### `create_okr_initiative_v1`

- aplicar limite comercial;
- validar owner;
- validar vínculo;
- criar;
- auditar.

### `update_okr_initiative_v1`

- controlar transição;
- validar prazo;
- atualizar progresso;
- gerar alerta quando vencida ou bloqueada;
- auditar.

### `archive_okr_initiative_v1`

- archive lógico.

---

## 8.6 Reviews e carry-forward

### `submit_okr_objective_review_v1`

- congelar score proposto;
- registrar impacto;
- registrar lições;
- registrar decisão.

### `approve_okr_objective_review_v1`

- aprovar;
- concluir Objective;
- criar snapshot final;
- auditar.

### `carry_forward_okr_objective_v1`

- criar novo Objective em draft;
- copiar somente campos selecionados;
- não copiar check-ins;
- não copiar snapshots;
- criar vínculo de origem;
- registrar motivo;
- auditar.

---

# 9. Segurança e permissões

## 9.1 Permissões

Cadastrar:

```text
view_okrs
view_all_okrs
manage_okr_cycles
create_okrs
edit_owned_okrs
edit_any_okrs
manage_key_results
check_in_okrs
manage_okr_initiatives
manage_okr_alignments
override_okr_health
approve_okr_reviews
close_okrs
close_okr_cycles
archive_okrs
export_okrs
manage_okr_metrics
```

## 9.2 Papéis

### OKR Admin

- configura ciclos;
- administra todos os Objectives;
- aprova reviews;
- fecha ciclos;
- gerencia catálogo.

### Sponsor

- visualiza Objectives patrocinados;
- revisa;
- aprova mudança de meta;
- aprova encerramento.

### Objective Owner

- cria;
- edita o próprio Objective;
- gerencia KRs;
- conduz review;
- gerencia iniciativas.

### KR Owner

- visualiza;
- realiza check-in;
- atualiza riscos;
- gerencia iniciativas relacionadas quando autorizado.

### Contributor

- visualiza;
- comenta;
- realiza check-in quando delegado.

### Viewer

- somente leitura.

## 9.3 RLS

Toda tabela deverá filtrar por `organization_id`.

Regras adicionais:

- usuário deve pertencer à organização;
- acesso por time deve respeitar membership;
- Objective organizacional pode ser visível a toda organização conforme permissão;
- leitura de review e audit deve respeitar escopo;
- fila e bindings não devem ser acessíveis diretamente pelo cliente;
- snapshots devem ser somente leitura.

---

# 10. Entitlements

## 10.1 Fonte canônica

O resolvedor deverá usar:

- `organization_subscriptions.plan_version_id`;
- `saas_plan_version_features`;
- add-ons;
- overrides.

A estrutura `saas_plan_entitlements` deverá ser:

- migrada;
- utilizada apenas como fallback temporário;
- removida após período de compatibilidade.

## 10.2 Features recomendadas

```text
okr.view
okr.create
okr.edit
okr.archive
okr.check_in
okr.initiatives
okr.automatic_metrics
okr.history
okr.export
okr.alignments
okr.cycle_management
okr.executive_dashboard
okr.advanced_alerts
okr.ai_recommendations
```

## 10.3 Limites

Possíveis limites:

- Objectives ativos por ciclo;
- KRs por Objective;
- iniciativas por KR;
- retenção de histórico;
- exportações mensais;
- métricas automáticas;
- integrações;
- ciclos simultâneos.

## 10.4 Enforcement

Limites devem ser aplicados no backend.

O frontend poderá informar o limite, mas não será autoridade.

---

# 11. Processamento automático

## 11.1 Nova responsabilidade da Edge Function

A Edge Function deverá:

- autenticar chamada;
- reivindicar jobs;
- coletar dados;
- normalizar entradas;
- chamar `apply_okr_measurement_v2`;
- registrar resultado;
- finalizar job.

Ela não deverá possuir a fórmula oficial do progresso.

## 11.2 Claim da fila

Criar:

```sql
claim_okr_recalculation_jobs_v1(
  p_worker_id text,
  p_limit integer,
  p_lease_seconds integer
)
```

Implementação:

- `FOR UPDATE SKIP LOCKED`;
- update para processing;
- incremento de attempts;
- `lease_expires_at`;
- retorno dos jobs reivindicados.

## 11.3 Estados da fila

- pending;
- processing;
- completed;
- retry;
- dead_letter;
- cancelled.

## 11.4 Retry

- tentativa 1: 1 minuto;
- tentativa 2: 5 minutos;
- tentativa 3: 15 minutos;
- tentativa 4: 1 hora;
- tentativa 5: dead letter.

Configuração poderá ser ajustada.

## 11.5 Idempotência

A chave deverá incluir:

- KR;
- versão da fórmula;
- período;
- origem;
- valor ou hash dos dados;
- tipo de trigger.

## 11.6 Triggers

Gerar jobs por:

- atualização de HU;
- encerramento de sprint;
- atualização de impedimento;
- mudança de release;
- schedule;
- execução manual;
- reprocessamento administrativo.

---

# 12. Frontend necessário

## 12.1 Rotas

```text
/okr
/okr/ciclos
/okr/ciclos/:cycleId
/okr/ciclos/:cycleId/planejamento
/okr/ciclos/:cycleId/acompanhamento
/okr/ciclos/:cycleId/encerramento
/okr/objetivos/:objectiveId
/okr/alertas
/okr/metricas
/okr/configuracoes
```

## 12.2 Guard de acesso

Criar `OkrAccessGuard` com:

- feature flag;
- organização;
- entitlement;
- loading;
- erro;
- permissão;
- fallback de acesso negado.

Nenhuma query de OKR deverá ser disparada antes de o contexto ser resolvido.

## 12.3 Página inicial do módulo

A página deverá apresentar:

- ciclo ativo;
- progresso consolidado;
- saúde;
- confiança;
- compliance de check-in;
- Objectives por status;
- Objectives em risco;
- KRs sem dados;
- iniciativas vencidas;
- alertas;
- próximos check-ins;
- acesso ao planejamento e encerramento.

## 12.4 Página de ciclos

Recursos:

- listar ciclos;
- criar;
- duplicar;
- publicar;
- iniciar fechamento;
- fechar;
- arquivar;
- consultar histórico.

## 12.5 Planejamento do ciclo

Recursos:

- direcionadores;
- Objectives;
- alinhamento;
- quality score;
- pendências;
- validação;
- publicação em lote;
- filtros por nível, time e owner.

## 12.6 Editor de Objective

Abas:

1. definição;
2. Key Results;
3. alinhamento;
4. iniciativas;
5. governança;
6. histórico.

Validações em tempo real:

- título orientado a resultado;
- owner;
- sponsor;
- quantidade de KRs;
- pesos;
- métricas;
- datas;
- alinhamento;
- duplicidade.

## 12.7 Editor de KR

Campos:

- título;
- descrição;
- owner;
- tipo;
- baseline;
- target;
- range;
- direção;
- unidade;
- peso;
- atualização;
- fonte;
- frequência;
- período;
- tolerância.

## 12.8 Check-in

O modal atual deverá ser substituído ou ampliado para:

- mostrar valor anterior;
- mostrar previsão de progresso;
- mostrar prazo;
- mostrar atraso;
- permitir confiança;
- riscos;
- próximos passos;
- evidências;
- salvar aguardando resultado;
- manter aberto em caso de erro;
- exibir retorno do backend.

KRs híbridos deverão apresentar:

- check-in manual;
- atualizar automaticamente.

## 12.9 Histórico

Apresentar:

- timeline;
- valor;
- progresso;
- saúde;
- confiança;
- autor;
- evidência;
- risco;
- próximo passo;
- mudança de meta;
- overrides;
- fórmula;
- origem;
- qualidade.

O JSON técnico deverá ficar em uma seção avançada, não como visualização principal.

## 12.10 Iniciativas

O painel deverá permitir:

- criar;
- editar;
- atribuir;
- definir prazo;
- priorizar;
- vincular a KR;
- vincular a entidade;
- bloquear;
- concluir;
- arquivar;
- filtrar.

## 12.11 Alertas

A página deverá apresentar:

- severidade;
- regra;
- entidade;
- owner;
- data;
- status;
- ação recomendada;
- acknowledge;
- resolução.

## 12.12 Encerramento

Fluxo por Objective:

1. mostrar score final;
2. mostrar série histórica;
3. informar impacto;
4. registrar resumo;
5. registrar aprendizados;
6. decidir carry-forward;
7. submeter;
8. aprovar;
9. congelar.

Fluxo do ciclo:

1. verificar pendências;
2. revisar indicadores;
3. consolidar lições;
4. aprovar review;
5. fechar;
6. gerar relatório final.

---

# 13. Dashboards e indicadores

## 13.1 Dashboard executivo

Indicadores:

- progresso consolidado;
- confiança média;
- Objectives por saúde;
- Objectives por nível;
- Objectives por time;
- KRs medidos;
- KRs sem dados;
- taxa de check-in;
- tendência;
- iniciativas atrasadas;
- alertas críticos;
- score final por ciclo.

## 13.2 Dashboard operacional

Indicadores:

- próximo check-in;
- check-ins atrasados;
- KRs stale;
- métricas com erro;
- iniciativas bloqueadas;
- Objective sem owner;
- pesos inválidos;
- Objectives sem alinhamento.

## 13.3 Comparação de ciclos

Exibir:

- score médio;
- taxa de conclusão;
- carry-forward;
- confiança;
- compliance;
- quantidade de Objectives;
- principais aprendizados;
- evolução por time.

---

# 14. Regras de qualidade de OKRs

## 14.1 Objective

Deve ser:

- qualitativo;
- claro;
- inspirador sem ser genérico;
- orientado a resultado;
- limitado ao ciclo;
- associado a owner;
- alinhado à estratégia.

Não deve:

- ser uma tarefa;
- ser uma lista de atividades;
- conter a própria métrica principal;
- ser amplo demais;
- depender apenas de entrega técnica.

## 14.2 Key Result

Deve ser:

- mensurável;
- verificável;
- possuir baseline;
- possuir target;
- possuir owner;
- possuir fonte;
- ter relação causal plausível com o Objective.

## 14.3 Quality score

Sugestão de critérios:

| Critério | Peso |
|---|---:|
| Clareza do Objective | 15 |
| Orientação a resultado | 15 |
| Owner definido | 10 |
| Alinhamento | 10 |
| Quantidade adequada de KRs | 10 |
| Baseline e target | 15 |
| Fonte de dados | 10 |
| Pesos válidos | 5 |
| Datas válidas | 5 |
| Ausência de duplicidade | 5 |

Publicação sugerida:

- mínimo de 80 pontos;
- nenhuma pendência crítica.

---

# 15. Integrações operacionais

## 15.1 Sala Ágil

Vínculos possíveis:

- sprint;
- release;
- epic;
- HU;
- impedimento;
- retrospectiva.

## 15.2 Sustentação

Métricas futuras:

- SLA;
- tempo médio;
- backlog;
- reincidência;
- produtividade;
- satisfação.

## 15.3 RDM

Métricas futuras:

- lead time;
- taxa de sucesso;
- rollback;
- incidentes;
- change failure rate.

## 15.4 Contratos e projetos

Alinhamentos:

- Objective por contrato;
- Objective por projeto;
- indicadores de escopo;
- prazo;
- qualidade;
- custo;
- satisfação.

---

# 16. Testes necessários

## 16.1 Unitários

- aumento;
- redução;
- faixa;
- bool;
- overachievement;
- baseline igual à meta;
- peso;
- nenhum dado;
- guardrail;
- saúde;
- confiança;
- staleness;
- quality score;
- lifecycle.

## 16.2 Banco e pgTAP

- tabelas;
- constraints;
- RLS;
- RBAC;
- entitlements;
- RPCs;
- tenant;
- append-only;
- archive;
- auditoria;
- transações;
- fila;
- idempotência;
- carry-forward;
- fechamento.

## 16.3 Integração

- frontend → RPC;
- Edge Function → RPC;
- fila → worker;
- entitlement → guard;
- metric binding → medição;
- alertas → dashboard.

## 16.4 Concorrência

- dois check-ins simultâneos;
- edição versus check-in;
- dois workers;
- mudança de meta durante recálculo;
- fechamento durante medição.

## 16.5 E2E

Cenário obrigatório:

1. criar ciclo;
2. criar Objective;
3. adicionar KRs;
4. alinhar;
5. publicar;
6. criar iniciativa;
7. realizar check-in;
8. medir automaticamente;
9. gerar alerta;
10. resolver alerta;
11. entrar em fechamento;
12. enviar review;
13. aprovar;
14. carry-forward;
15. fechar ciclo;
16. consultar histórico;
17. exportar.

## 16.6 Segurança

- usuário sem organização;
- membro de outra organização;
- viewer tentando editar;
- owner tentando editar outro Objective;
- plano sem feature;
- limite excedido;
- chamada direta à tabela;
- chamada sem token;
- chamada com token inválido;
- bypass de RLS.

---

# 17. Observabilidade

## 17.1 Logs estruturados

Eventos:

- cycle_created;
- objective_published;
- check_in_completed;
- automatic_measurement_completed;
- automatic_measurement_failed;
- queue_job_claimed;
- queue_job_retried;
- queue_job_dead_lettered;
- objective_closed;
- cycle_closed.

Campos:

- organization_id;
- cycle_id;
- objective_id;
- key_result_id;
- actor_id;
- correlation_id;
- duration_ms;
- status;
- error_code.

## 17.2 Métricas operacionais

- jobs pendentes;
- jobs em retry;
- dead letters;
- tempo médio de processamento;
- taxa de erro;
- check-ins por hora;
- recálculos por hora;
- divergência detectada;
- queries lentas;
- RPC failures.

## 17.3 Alertas técnicos

- fila sem processamento;
- dead-letter acima do limite;
- Edge Function com erro;
- RPC com aumento de latência;
- migration drift;
- falha de workflow;
- snapshot ausente.

---

# 18. Estratégia de compatibilidade

## 18.1 Campos legados

Durante a migração:

- `cycle` continuará disponível;
- `progress` e `status` continuarão preenchidos;
- `target` e `current` continuarão sincronizados;
- novos consumidores usarão `cycle_id`, `calculated_progress`, `calculated_health`, `target_value` e `current_value`.

## 18.2 Reconciliação

Criar job de reconciliação que:

- compara legado e v2;
- registra divergência;
- corrige somente após aprovação;
- gera relatório.

## 18.3 Remoção

Campos legados só poderão ser removidos após:

- dois ciclos completos;
- zero consumidores identificados;
- paridade validada;
- migration aprovada.

---

# 19. Sequência de Pull Requests

## PR 0 — Preflight e baseline

### Implementar

- inventário de migrations;
- correção de colisões;
- CI de build, lint, testes e db reset;
- ADR de arquitetura;
- feature flag `okr_v2_enabled`.

### Saída

Base reproduzível e segura.

---

## PR 1 — Entitlements canônicos

### Implementar

- resolvedor versionado;
- seeds;
- guard;
- limites básicos;
- testes por plano.

### Saída

Acesso comercial previsível.

---

## PR 2 — RBAC, RLS e RPC boundary

### Implementar

- permissões;
- roles;
- policies;
- revogação de mutações diretas;
- esqueleto de RPCs.

### Saída

Segurança correta.

---

## PR 3 — Ciclos

### Implementar

- `okr_cycles`;
- lifecycle;
- UI de ciclos;
- backfill;
- publicação e fechamento inicial.

### Saída

Ciclo formal.

---

## PR 4 — Objectives e alinhamento

### Implementar

- novo modelo;
- owner;
- sponsor;
- levels;
- alignments;
- validação;
- publish.

### Saída

Planejamento estratégico completo.

---

## PR 5 — KRs e motor canônico

### Implementar

- editor completo;
- função de progresso;
- pesos;
- range;
- target change;
- remoção de fórmula duplicada.

### Saída

Scoring consistente.

---

## PR 6 — Check-in transacional

### Implementar

- RPC;
- snapshots;
- auditoria;
- cadence;
- confidence;
- history;
- híbrido.

### Saída

Acompanhamento confiável.

---

## PR 7 — Métricas automáticas e fila

### Implementar

- catálogo;
- bindings;
- claim;
- retry;
- dead letter;
- Edge Function simplificada.

### Saída

Automação resiliente.

---

## PR 8 — Iniciativas e alertas

### Implementar

- CRUD completo;
- vínculos;
- dependências;
- alert engine;
- painel.

### Saída

Gestão operacional semanal.

---

## PR 9 — Reviews, encerramento e carry-forward

### Implementar

- objective review;
- cycle review;
- approvals;
- snapshots finais;
- carry-forward;
- archive.

### Saída

Ciclo fechado de ponta a ponta.

---

## PR 10 — Dashboard, exportação e hardening

### Implementar

- dashboard executivo;
- dashboard operacional;
- comparação;
- exportação por plano;
- observabilidade;
- E2E;
- performance;
- rollout.

### Saída

Módulo production-ready.

---

# 20. Critérios de aceite por marco

## Marco A — Fundação segura

Concluído quando:

- migrations únicas;
- db reset funciona;
- entitlements corretos;
- RLS testada;
- mutações diretas revogadas;
- CI verde.

## Marco B — Planejamento completo

Concluído quando:

- ciclos existem;
- Objectives e KRs podem ser configurados;
- alinhamento funciona;
- quality gate funciona;
- publicação funciona.

## Marco C — Acompanhamento completo

Concluído quando:

- check-ins são transacionais;
- snapshots são imutáveis;
- métricas automáticas funcionam;
- fila é resiliente;
- alertas funcionam.

## Marco D — Fechamento completo

Concluído quando:

- review por Objective funciona;
- approval funciona;
- carry-forward funciona;
- ciclo fecha;
- histórico permanece íntegro.

## Marco E — Produção

Concluído quando:

- E2E verde;
- canary aprovado;
- observabilidade ativa;
- runbook publicado;
- nenhum P0 ou P1 aberto.

---

# 21. Definition of Done final

O ciclo de OKRs estará fechado no Axionn somente quando:

- o ciclo for uma entidade própria;
- Objectives puderem ser alinhados;
- owner e sponsor estiverem definidos;
- KRs possuírem configuração completa;
- qualidade for validada antes da publicação;
- pesos e range funcionarem no backend;
- check-in for transacional;
- KRs híbridos funcionarem;
- métricas automáticas utilizarem fórmula versionada;
- fila for concorrente e resiliente;
- alertas tiverem lifecycle;
- iniciativas tiverem owner, prazo e vínculo;
- RBAC estiver aplicado;
- RLS estiver testada;
- entitlements forem canônicos;
- archive substituir delete;
- snapshots forem imutáveis;
- auditoria cobrir todas as ações críticas;
- Objective review existir;
- cycle review existir;
- carry-forward existir;
- ciclo fechado for imutável;
- dashboards gerenciais estiverem disponíveis;
- exportações respeitarem o plano;
- CI, pgTAP, integração e E2E estiverem verdes;
- canary tiver aprovação formal.

---

# 22. Itens explicitamente fora da primeira conclusão

Os itens abaixo não devem bloquear o fechamento do ciclo principal:

- geração de OKRs por IA;
- recomendações preditivas;
- benchmark externo;
- integrações Jira, GitHub ou GitLab para OKR;
- forecast probabilístico;
- NLP avançado para quality score;
- notificações por WhatsApp;
- marketplace de templates.

Esses itens deverão ser tratados depois do core estabilizado.

---

# 23. Backlog resumido

| Ordem | Epic | Prioridade | Dependência |
|---:|---|---|---|
| 1 | Migration Preflight | P0 | Nenhuma |
| 2 | Entitlements V2 | P0 | Preflight |
| 3 | OKR RBAC/RLS | P0 | Entitlements |
| 4 | Cycle Management | P0 | RBAC |
| 5 | Objective V2 | P0 | Cycles |
| 6 | Key Result V2 | P0 | Objective V2 |
| 7 | Canonical Scoring | P0 | KR V2 |
| 8 | Transactional Check-in | P0 | Scoring |
| 9 | Automatic Measurement | P1 | Check-in |
| 10 | Queue Resilience | P1 | Measurement |
| 11 | Initiatives V2 | P1 | Objective/KR |
| 12 | Alerts | P1 | Measurement |
| 13 | Alignment | P1 | Objective V2 |
| 14 | Objective Review | P1 | Check-in |
| 15 | Cycle Closure | P1 | Reviews |
| 16 | Carry Forward | P1 | Closure |
| 17 | Executive Dashboard | P1 | Histórico |
| 18 | Export and Limits | P1 | Entitlements |
| 19 | Observability | P1 | Todos |
| 20 | AI Recommendations | P2 | Core completo |

---

# 24. Orientação para execução pelo Codex ou Lovable

Ao implementar este plano:

1. analisar o código atual antes de alterar;
2. não remover funcionalidades existentes sem substituição;
3. preservar compatibilidade de dados;
4. não editar migration já aplicada sem runbook;
5. usar migrations aditivas;
6. criar testes junto com cada implementação;
7. não usar `supabase as any` em código novo;
8. regenerar tipos após migrations;
9. não criar lógica de cálculo no frontend;
10. não usar DELETE para dados publicados;
11. usar RPC para mutações críticas;
12. aplicar entitlement e RBAC no backend;
13. registrar auditoria;
14. documentar rollback;
15. dividir o trabalho pelos PRs definidos;
16. não iniciar P2 antes de fechar os marcos A a E.

---

# 25. Resultado final esperado para o usuário

Quando o trabalho estiver concluído, o usuário deverá conseguir:

1. acessar o módulo conforme seu plano;
2. criar um ciclo;
3. configurar as regras;
4. criar Objectives;
5. atribuir responsáveis;
6. criar KRs mensuráveis;
7. alinhar objetivos;
8. validar qualidade;
9. publicar;
10. criar iniciativas;
11. realizar check-ins;
12. acompanhar confiança e risco;
13. obter métricas automáticas;
14. receber alertas;
15. acompanhar dashboards;
16. revisar os resultados;
17. registrar aprendizados;
18. transportar itens selecionados;
19. fechar o ciclo;
20. consultar todo o histórico sem perda de dados.

---

# 26. Recomendação de início

O trabalho deverá começar pelos seguintes itens, sem exceção:

1. **Preflight de migrations.**
2. **Correção do resolvedor de entitlements.**
3. **Definição da fronteira RPC.**
4. **RBAC e RLS.**
5. **Criação de `okr_cycles`.**
6. **Motor canônico de cálculo.**
7. **Check-in transacional.**

Esses sete itens são a fundação. Implementar dashboards, IA ou novas métricas antes deles aumentará o risco técnico e o retrabalho.

**Status do plano:** pronto para decomposição em épicos, histórias técnicas e Pull Requests.
