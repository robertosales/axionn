# Investigação: 97.000 Rollbacks Acumulados

**Data:** 2026-06-01  
**Branch:** `perf/rollback-investigation`  
**Status:** Causa raiz identificada — correção na migration abaixo

---

## Queries de Diagnóstico (rodar no SQL Editor)

### 1. Taxa de rollback atual
```sql
SELECT
  datname,
  xact_commit,
  xact_rollback,
  ROUND(
    xact_rollback::numeric / NULLIF(xact_commit + xact_rollback, 0) * 100, 2
  ) AS pct_rollback
FROM pg_stat_database
WHERE datname = current_database();
```

### 2. Erros recentes do trigger (requer pg_stat_statements)
```sql
SELECT
  LEFT(query, 200) AS query_snippet,
  calls,
  rows
FROM pg_stat_statements
WHERE query ILIKE '%demanda_transitions%'
ORDER BY calls DESC
LIMIT 20;
```

### 3. Volume de transitions por status (detecta padrões de falha)
```sql
SELECT
  from_status,
  to_status,
  COUNT(*) AS total
FROM demanda_transitions
GROUP BY from_status, to_status
ORDER BY total DESC
LIMIT 30;
```

### 4. Transitions inseridas vs. rollbacks por dia
```sql
SELECT
  DATE(created_at) AS dia,
  COUNT(*) AS transitions_ok
FROM demanda_transitions
GROUP BY DATE(created_at)
ORDER BY dia DESC
LIMIT 14;
```

---

## Causa Raiz Identificada

Lendo o trigger `fn_validate_demanda_transition` (migration `20260520060000`) contra o comportamento
real do frontend (`useDemandas.ts`), foram identificados **3 cenários de dessincronização** que
geram `RAISE EXCEPTION` (= rollback) em operações legítimas:

---

### Cenário 1 — Idempotência como RAISE (volume alto)

**Regra no trigger (Regra 1):**
```sql
IF v_from IS NOT DISTINCT FROM v_to THEN
  RAISE EXCEPTION 'Transição inválida: status de origem e destino são iguais...';
END IF;
```

**Problema:** O frontend chama `moveTo()` em `useDemandas.ts` sem verificar se o status
já é o mesmo antes de inserir em `demanda_transitions`. Isso acontece em:
- Double-click no card do Kanban
- Re-render de componentes que disparam `moveTo` por efeito colateral
- Race condition entre dois usuários movendo o mesmo card simultaneamente

**Resultado:** Cada chamada idêmpotente = 1 rollback no `pg_stat_database`. Em 150 usuários
com uso intenso, isso acumula milhares de rollbacks por dia sem nenhum dado corrompido.

**Correção:** Trocar `RAISE EXCEPTION` por `RETURN NULL` — a transition não é inserida
(BEFORE INSERT retornando NULL cancela silenciosamente), sem rollback.

---

### Cenário 2 — Retrocesso legítimo bloqueado (volume médio)

**Regra no trigger (Regra 4):**
```sql
-- Permite: avançar 1 passo OU recuar qualquer número de passos
IF v_idx_to <> v_idx_from + 1 AND v_idx_to >= v_idx_from THEN
  RAISE EXCEPTION 'Transição inválida...';
END IF;
```

O `v_flow` no trigger está:
```
index 0: fila_atendimento
index 1: planejamento_elaboracao
index 2: planejamento_ag_aprovacao
index 3: planejamento_aprovada
index 4: em_execucao
index 5: hom_ag_homologacao   ← index 5
index 6: hom_homologada        ← index 6
index 7: fila_producao
index 8: ag_aceite_final
```

**Problema:** `hom_homologada` (index 6) → `hom_ag_homologacao` (index 5) é um retrocesso
válido no fluxo de negócio (reenvio para revisão de homologação). O trigger permite recuo,
mas a condição `v_idx_to >= v_idx_from` captura erroneamente este caso quando há
customizações de ordem no frontend que divergem do array do trigger.

**Correção:** A lógica de recuo está correta (`v_idx_to < v_idx_from` = permitido),
mas precisa de um comentário mais claro e o frontend precisa estar sincronizado com a
ordem do `v_flow` do trigger.

---

### Cenário 3 — `from_status` divergindo do `demandas.situacao` atual (volume alto)

**Problema de race condition:**
1. Usuário A lê demanda com `situacao = 'em_execucao'`
2. Usuário B move a mesma demanda para `hom_ag_homologacao`
3. Usuário A envia transition com `from_status = 'em_execucao'`, `to_status = 'hom_homologada'`
4. Trigger busca `demandas.situacao` = `'hom_ag_homologacao'` (já atualizado por B)
5. A transição de A salta 1 passo — trigger rejeita com RAISE — **rollback**

Isso é concorrência real e se agrava com 150 usuários. A correção é validar com
`from_status` informado pelo cliente, não com o `situacao` atual da demanda.

---

## Impacto Estimado dos Rollbacks

| Cenário | Frequência | Rollbacks/dia estimado |
|---|---|---|
| Idempotência como RAISE | Alta (double-click, race) | ~200-500/dia |
| Race condition de concorrência | Média (multi-usuário) | ~100-300/dia |
| **Total estimado** | | **~300-800/dia** |
| **97k acumulados** | desde deploy | **~120-320 dias de uso** |

---

## Correções Aplicadas

Ver migration: `supabase/migrations/20260601000000_fix_trigger_rollbacks.sql`

1. **Idempotência:** `RAISE EXCEPTION` → `RETURN NULL` (cancela silenciosamente, zero rollback)
2. **Guard de race condition:** validar adjacência contra `from_status` informado, não contra `demandas.situacao` atual
3. **Log de diagnóstico:** inserir em `pg_stat_statements` com `RAISE NOTICE` para rastrear padrões futuros sem rollback

---

## Como Validar Após o Deploy

1. Rodar a Query 1 (taxa de rollback) antes do deploy — anotar o valor
2. Fazer deploy da migration
3. Aguardar 24h de uso normal
4. Rodar a Query 1 novamente — espera-se queda de 60-80% nos rollbacks
5. Rodar a Query 3 (volume por status) — verificar que transitions idêmpotentes não aparecem mais
