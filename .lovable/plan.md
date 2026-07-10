## Diagnóstico

O erro que o usuário recebe é:

```
POST /process-ai-briefing → 502 Bad Gateway
{ "error": "AI_PROVIDER_429", "message": "Nao foi possivel processar o briefing." }
```

Confirmado pelos logs da edge function:

```
[process-ai-briefing] AI_PROVIDER_429 Provedor respondeu HTTP 429
```

O provedor de IA (Gemini/OpenAI/Anthropic, dependendo do `ai_providers` configurado) devolveu **HTTP 429 — rate limit**. Hoje o `callProvider` em `supabase/functions/process-ai-briefing/index.ts` (linhas 511-640) faz **uma única tentativa**: qualquer 429 ou 5xx do provedor cai direto em `throw new HttpError(502, "AI_PROVIDER_${status}", ...)`. Sem retry, sem backoff, sem respeitar `Retry-After`.

Além disso, o front recebe `502` mesmo quando o provedor devolve `429` — o que confunde monitoramento e não sinaliza corretamente "tente de novo em alguns segundos".

## Solução

Alterações **somente** em `supabase/functions/process-ai-briefing/index.ts`. Sem UI, sem migrations, sem mudar prompt ou schema.

### 1. Retry com backoff exponencial em `callProvider`

Envolver as 3 chamadas `fetch` (gemini, anthropic, openai-compatible) num helper único `fetchWithRetry`:

- Tentativas: **3** no total (1 original + 2 retries).
- Retriável quando: `response.status === 429` **ou** `response.status >= 500 && response.status <= 599` **ou** erro de rede/timeout transitório.
- Backoff base: `500ms → 1500ms` com jitter aleatório (±20%).
- Se o provedor mandar header `Retry-After` (segundos ou HTTP-date), respeitar esse valor no lugar do backoff calculado, com teto de 5s para não estourar o timeout total da função.
- Nunca retriar em 4xx que não seja 429 (400/401/403/404 seguem falhando imediatamente).

### 2. Propagar corretamente 429 do provedor

Quando todas as tentativas esgotam com 429, retornar ao cliente:

- HTTP `429` (não 502).
- Body: `{ success: false, error: "AI_PROVIDER_429", message: "O provedor de IA está sobrecarregado. Tente novamente em alguns segundos." }`.

Para 5xx persistente do provedor, manter `502 AI_PROVIDER_5xx` como hoje.

Isso é feito ajustando a construção do `HttpError` no ponto onde a última tentativa falha (mapear 429 → status 429, resto → 502) e deixando o handler `catch` no fim da função repassar `error.status` intacto (já é o comportamento atual — só precisa garantir que `HttpError.status = 429` seja usado tal qual).

### 3. Finalização de uso em falha

Manter a chamada `finalize_ai_briefing_usage` com `status="failed"` e `error_code="AI_PROVIDER_429"` no bloco `catch` para não deixar reserva pendurada (comportamento já existente — apenas confirmar que continua acionando após retries).

### Fora de escopo

- Não trocar provedor nem modelo.
- Não mexer em `normalizeDate`, prompt, schema ou validação de evidências.
- Não adicionar fila/worker para reprocessamento assíncrono (fora do MVP; o retry em processo já resolve rate limits transitórios).
- Não alterar UI — o front já mostra o `message` retornado pela function.

## Critério de aceite

- Um 429 transitório do provedor não chega mais ao usuário: as 2 retries recuperam a chamada.
- Se o provedor insistir em 429, o front recebe **HTTP 429** com `error: "AI_PROVIDER_429"` e mensagem clara pedindo para tentar novamente.
- 5xx persistente continua chegando como `502 AI_PROVIDER_5xx`.
- Reservas em `ai_usage_events` são finalizadas como `failed` em vez de ficarem em `reserved`.
