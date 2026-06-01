
# Plano de execução — Onda 1 (escalabilidade para 150 usuários)

## Respostas às suas perguntas

1. **Mudanças incrementais e medidas** ✅ Confirmado. Cada onda é dividida em PRs pequenos, com medição antes e depois.
2. **Ambiente de homologação** ⚠️ O Lovable não tem "staging" nativo dentro do mesmo projeto, mas existem 2 caminhos reais:
   - **Opção A (recomendada — barata e rápida):** criar um **segundo projeto Lovable** via "Remix" do projeto atual. Ele vem com cópia do código + Lovable Cloud próprio (banco separado). Custo: mais 1 projeto na sua conta. Bom para testar mudanças de schema e edge functions antes de promover.
   - **Opção B (mais robusta):** usar um **branch Git** (GitHub conectado ao Lovable) e um **segundo Supabase project** manual, com seed de dados anonimizados. Mais trabalho, mais fiel.
   - Para começar já com segurança, sugiro **Opção A**. Posso te orientar passo a passo quando entrar em build mode.
3. **Tabela `apf_jobs`** ✅ Será criada na Onda 3.
4. **Começar pelo mais relevante** ✅ Defini abaixo.

---

## O que é mais relevante começar agora

Olhando os dados reais do banco (34% memória, 5% disco, 19/90 conexões, **97 mil rollbacks acumulados**) + o código do Kanban e Sustentação, o gargalo real para 150 usuários **não é infra**, é **padrão de query no frontend + falta de índices**. Por isso:

### Ordem de ataque (maior ganho / menor risco primeiro)

```text
PASSO 1  →  Índices críticos no banco         (risco: zero, ganho: alto)
PASSO 2  →  Investigar os 97k rollbacks        (risco: zero, leitura de logs)
PASSO 3  →  Otimizar useKanbanBoard            (risco: baixo, ganho: muito alto)
PASSO 4  →  Realtime com debounce + filtro     (risco: médio, ganho: alto)
PASSO 5  →  Medir e decidir próxima onda       (gate de decisão)
```

---

## PASSO 1 — Índices críticos (migration única, ~1 min)

Vou criar **uma migration** com índices nas colunas mais usadas em filtros/joins. São operações `CREATE INDEX IF NOT EXISTS` — não bloqueiam o banco e podem ser revertidas a qualquer momento.

Índices planejados:

| Tabela | Colunas | Por quê |
|---|---|---|
| `user_stories` | `(team_id, sprint_id, status)` | Kanban filtra por isso o tempo todo |
| `user_stories` | `(sprint_id)` quando NULL | Backlog query |
| `demandas` | `(team_id, situacao, created_at)` | Lista de Sustentação |
| `demanda_transitions` | `(demanda_id, created_at)` | Cálculo de TMR/MTTR |
| `demanda_hours` | `(demanda_id)` e `(user_id)` | Trigger de total_horas + KPIs |
| `activities` | `(hu_id)` | Soma de horas por HU |
| `impediments` | `(team_id, resolved_at)` | Impedimentos abertos |
| `demanda_eventos` | `(demanda_id, created_at)` | Cálculo IMR |
| `notifications` | `(user_id, read)` | Sino de notificações |

**Validação:** depois rodo `EXPLAIN ANALYZE` em 3 queries pesadas (Kanban, Sustentação, KPIs admin) e mostro o antes/depois.

## PASSO 2 — Investigar os 97k rollbacks (read-only)

Os rollbacks são um **sintoma escondido**. Cada rollback = uma transação que estourou (provavelmente RLS negando ou trigger falhando). Com 150 usuários isso vira congestionamento.

Vou rodar:
- `pg_stat_database` para taxa de rollback atual.
- Logs do Postgres das últimas 24h filtrando `ERROR`/`ROLLBACK`.
- Identificar top 5 queries que mais falham e propor correção (sem aplicar ainda).

Entrega: **relatório curto** com causa raiz + plano de correção pontual.

## PASSO 3 — Otimizar `useKanbanBoard` (1 PR pequeno)

Mudanças cirúrgicas no hook (sem mudar UI):

1. Trocar `select('*')` por colunas específicas em `user_stories`, `developers`, `epics`, `workflow_columns`.
2. Adicionar filtro `sprint_id` direto na query (em vez de trazer 500 e filtrar no JS).
3. Subir `staleTime` de devs/epics para 5min.
4. Cancelar fetch quando aba não está visível (já tem `useAppResilience`, só precisa integrar).

**Critério de sucesso:** payload do Kanban cai de ~500 KB para <100 KB; tempo de carga cai de Xs para <500ms.

## PASSO 4 — Realtime sob controle

1. Adicionar **debounce de 2s** em `invalidateQueries` disparados por Realtime.
2. Aplicar **filtro server-side** (`filter: team_id=eq.X`) nos canais de Kanban e Sustentação.
3. Invalidar **queryKey específica** (`['kanban', sprintId]`) em vez de invalidação global.

Resultado: write de 1 card em vez de gerar `150 usuários × refetch global`, gera `≤30 usuários do time × refetch específico`. Redução estimada de ~80% no tráfego de Realtime + queries em pico.

## PASSO 5 — Gate de decisão

Depois dos passos 1-4, rodamos um **mini teste de carga** (k6/Artillery, posso te ajudar a configurar) simulando 50 → 100 → 150 usuários. Com os números reais, decidimos:

- Se estiver folgado → Ondas 3 e 4 viram opcionais.
- Se estiver no limite → seguimos com fila assíncrona (`apf_jobs`) + upgrade `ci_small` → `ci_medium`.
- Se quebrar → vamos atrás do gargalo específico que o teste apontar (não chutamos).

---

## Cronograma sugerido

| Passo | Tempo estimado | Aplica em prod? |
|---|---|---|
| Criar projeto de homologação (Opção A) | 15 min (você faz pelo painel) | Não |
| Passo 1 — Índices | 30 min eu monto + você aprova | **Sim** (seguro) |
| Passo 2 — Investigação rollbacks | 1h leitura + relatório | Não |
| Passo 3 — Kanban | 2-3h | Sim, fora de pico |
| Passo 4 — Realtime | 2-3h | Sim, fora de pico |
| Passo 5 — Teste de carga | 1-2h | Em homologação |

Total da Onda 1: **~1 dia de trabalho efetivo**, distribuído.

---

## O que eu preciso de você para apertar "Implementar plano"

1. **Confirma que posso começar pelo Passo 1 (índices)** assim que entrar em build mode?
2. **Quer que eu já te oriente a criar o projeto de homologação por Remix** antes de aplicar os passos seguintes em produção?
3. **Tem janela combinada** (ex: noite/fim de semana) para os Passos 3 e 4, ou prefere que eu aplique a qualquer hora (são mudanças de baixo risco)?
