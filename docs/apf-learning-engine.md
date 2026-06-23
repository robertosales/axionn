# Motor de Aprendizado APF

## Visão Geral

O Motor de Aprendizado APF transforma cada validação humana em conhecimento reutilizável, implementando um ciclo de aprendizado contínuo baseado em feedback de especialistas.

**Princípio central:** cada correção de um especialista é um dado de treinamento, não um evento descartável.

---

## Arquitetura

```
apf_validation_events  →  apf_embedding_queue  →  (OpenAI embeddings)
        │
        ├─ pg_cron semanal →  apf_knowledge_patterns  (memória organizacional)
        └─ pg_cron semanal →  apf_learning_metrics    (métricas de qualidade)

match_similar_apf_cases(embedding)  →  RAG inside apf-count Edge Function
```

---

## Tabelas

### `apf_validation_events`
Log imutável de cada item APF validado por um especialista. **Nunca deletar.**

Colunas-chave:
- `was_corrected` — coluna gerada automaticamente (AI != especialista)
- `hu_embedding` — vector(1536) para busca semântica
- `correction_reason_code` — ENUM com 10 causas raiz estruturadas
- `rag_was_used` — permite medir o delta de precisão com/sem RAG

### `apf_knowledge_patterns`
Padrões consolidados gerados semanalmente. Especialistas revisam (`status: auto → validated`).

### `apf_learning_metrics`
Snapshot semanal de métricas. Alimenta o Dashboard de Aprendizado.

---

## Edge Functions

### `apf-validate`
Recebe o payload de validação e persiste em `apf_validation_events`.

**Regra crítica:** `correction_reason_code` é obrigatório quando `was_corrected = true`.

Exemplo de chamada:
```typescript
await supabase.functions.invoke('apf-validate', {
  body: {
    session_id: 'uuid',
    project_id: 'uuid',
    team_id: 'uuid',
    hu_text: 'Como usuário, quero visualizar o dashboard operacional...',
    hu_title: 'Dashboard Operacional',
    project_domain: 'financeiro',
    ai_functional_type: 'CE',
    ai_complexity: 'Media',
    ai_pf_bruto: 4,
    ai_confidence_score: 0.82,
    rag_was_used: true,
    rag_case_count: 3,
    validated_functional_type: 'CE',
    validated_complexity: 'Baixa',  // especialista corrigiu a complexidade
    validated_pf_bruto: 3,
    correction_reason_code: 'wrong_complexity',
    correction_notes: 'Dashboard simples, apenas 3 DETs'
  }
});
```

### `apf-embeddings`
Processa a fila `apf_embedding_queue` em lotes de 20.
Chamar via pg_cron a cada 5 minutos:

```sql
SELECT cron.schedule(
  'apf-embeddings-cron',
  '*/5 * * * *',
  $$SELECT net.http_post(url := '<SUPABASE_URL>/functions/v1/apf-embeddings',
    headers := '{"Authorization": "Bearer <SERVICE_ROLE_KEY>"}'::jsonb)$$
);
```

---

## RAG no apf-count

Adicionar ao início da Edge Function `apf-count`, antes da chamada à IA:

```typescript
// 1. Gera embedding da HU candidata
const embeddingRes = await fetch('https://api.openai.com/v1/embeddings', {
  method: 'POST',
  headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'text-embedding-3-small', input: huText.slice(0, 8000), dimensions: 1536 }),
});
const { data: [{ embedding }] } = await embeddingRes.json();

// 2. Busca casos similares
const { data: similarCases } = await supabaseAdmin.rpc('match_similar_apf_cases', {
  p_query_embedding: `[${embedding.join(',')}]`,
  p_team_id: teamId,
  p_domain: projectDomain,
  p_limit: 5,
  p_similarity_threshold: 0.80,
});

// 3. Formata o contexto RAG para injetar no prompt
const ragContext = similarCases?.length
  ? `=== CASOS SIMILARES VALIDADOS ===\n` +
    similarCases.map((c, i) =>
      `Exemplo ${i+1} (${(c.similarity*100).toFixed(0)}% similar):\n` +
      `HU: "${c.hu_title ?? c.hu_text.slice(0, 120)}"\n` +
      `Tipo: ${c.validated_functional_type} | Complexidade: ${c.validated_complexity} | PF: ${c.validated_pf_bruto}\n` +
      (c.was_corrected ? `⚠ IA havia errado (${c.correction_reason_code})` : '✓ IA acertou')
    ).join('\n---\n') +
    `\n=== FIM DOS EXEMPLOS ===`
  : '';

// 4. Injeta ragContext no início do system prompt
// 5. Registra rag_was_used e rag_case_count no evento de validação posterior
```

---

## Métricas — Views disponíveis

| View | Propósito |
|------|-----------|
| `v_apf_accuracy_trend` | Acurácia semanal — gráfico de linha principal |
| `v_apf_confusion_matrix` | Onde o modelo erra sistematicamente |
| `v_apf_confidence_calibration` | Confiança declarada vs acerto real |

---

## Roadmap

- [x] **Stage 1** — Memória estruturada: `apf_validation_events` + `apf_embedding_queue` + `apf-validate` + `apf-embeddings`
- [x] **Stage 2** — Métricas e padrões: `apf_knowledge_patterns` + `apf_learning_metrics` + views
- [ ] **Stage 3** — RAG ativo: integrar `match_similar_apf_cases` em `apf-count`
- [ ] **Stage 4** — Interface de padrões: tela "Biblioteca APF" + cron jobs de consolidação
- [ ] **Stage 5** — Automação progressiva: auto-aprovação, A/B testing de prompts, alertas de drift

---

## Regra de Ouro

> `correction_reason_code` é obrigatório quando `was_corrected = true`.
> Sem esse campo, o sistema sabe *que* errou mas não *por que*.
> A interface deve torná-lo um dropdown visível e obrigatório.
