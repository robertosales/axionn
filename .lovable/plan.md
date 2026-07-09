## Objetivo

Criar a Edge Function `process-ai-briefing` que gera sugestões de tarefas/decisões/riscos a partir de um Briefing armazenado em `ai_briefings`, reutilizando:

- provedor ativo/recomendado cadastrado em `public.ai_providers` (mesma tabela usada pelo APF);
- credencial obtida exclusivamente via RPC `get_ai_provider_key_by_id`;
- RPCs de ciclo de vida do briefing já existentes: `start_ai_briefing_run`, `complete_ai_briefing_run`, `fail_ai_briefing_run` e inserção em `ai_briefing_suggestions`.

Nada da rotina de APF (`apf-generate`, `count-function-points`, `apf-*`) é alterado.

## Arquivos

- `supabase/functions/process-ai-briefing/index.ts` (novo)
- `supabase/config.toml` (adicionar bloco `[functions.process-ai-briefing]` com `verify_jwt = true`)

Nenhuma nova tabela, secret, página, hook ou cadastro. Nenhum arquivo do APF é tocado.

## Contrato da função

- Método: `POST`, `verify_jwt = true`.
- CORS igual às demais functions da plataforma.
- Body: `{ briefingId: string (uuid), providerId?: string }`.
- Autenticação: `Authorization: Bearer <jwt>` do usuário logado (client anon + header). RLS já protege `ai_briefings`, então o carregamento inicial usa o client autenticado do usuário.
- Retorno: `{ success, runId, providerUsed, model, latencyMs, suggestionsCount }` ou `{ success: false, reason, userMessage }` (mesmo padrão do `platform-ai-provider-test`).

## Fluxo

1. Validar JWT via `userClient.auth.getUser()`; recusar 401 se inválido.
2. Ler o briefing com o client do usuário: `select id, org_id, briefing_type, language, source_content, participants, meeting_date, title from ai_briefings where id = :briefingId`. Se não encontrado → 404 (RLS já garante escopo).
3. Selecionar o provedor de IA usando o service role, na ordem:
   - `providerId` recebido (se enviado, e `is_active`);
   - senão, `is_recommended = true and is_active = true` (mais recente);
   - senão, primeiro `is_active = true` ordenado por `created_at desc`.
   Se nenhum → `{ success:false, reason:"AI_PROVIDER_NOT_CONFIGURED" }`.
4. Buscar a credencial exclusivamente via `admin.rpc("get_ai_provider_key_by_id", { p_id: provider.id })`. Se ausente/curta → `AI_PROVIDER_KEY_MISSING`.
5. Chamar `start_ai_briefing_run({ p_briefing_id, p_prompt_version:"briefing.v1", p_request_id: crypto.randomUUID(), p_schema_version:"briefing.suggestions.v1" })` para obter `run_id` e dados oficiais do briefing.
6. Montar o prompt do Briefing (próprio, separado do APF) e o schema de saída (ver seções abaixo). Ambos ficam apenas nesta function.
7. Chamar o provedor usando a mesma lógica de `platform-ai-provider-test`: um helper `callProvider(provider, apiKey, systemPrompt, userPrompt)` que suporta `request_format` `openai_compatible`, `gemini` e `anthropic` (endpoints, headers e parsing idênticos aos já usados na plataforma; sem novas dependências).
8. Extrair o JSON da resposta (bloco ```json ou parse direto). Validar contra o schema (Zod inline). Se falhar → `fail_ai_briefing_run(run_id, "AI_OUTPUT_INVALID", ...)` e retornar erro amigável.
9. Persistir com service role:
   - `insert into ai_briefing_suggestions` — um registro por item, com `ordinal` sequencial, `suggestion_type` (`task` | `decision` | `risk` | `follow_up`), `title`, `description`, `priority_hint`, `suggested_assignee_name`, `suggested_due_date`, `date_source`, `original_payload = item`, `review_status = 'pending'`.
   - `complete_ai_briefing_run({ p_run_id, p_provider_id, p_model_name, p_output_payload, p_duration_ms, p_input_tokens?, p_output_tokens?, p_estimated_cost? })`.
10. Erros do provedor (401/402/404/429/5xx/timeout) reutilizam o mapeamento `sanitizeProviderFailure` do `platform-ai-provider-test`, e chamam `fail_ai_briefing_run` antes de retornar. Logs técnicos vão em `console.error` (nunca no `userMessage`).

## Prompt do Briefing (isolado nesta function)

- System prompt em PT-BR (fallback para o `language` do briefing) explicando que a IA lê uma ata / transcrição de reunião do módulo Sala Ágil e deve extrair itens acionáveis para o time.
- User prompt injeta: `title`, `briefing_type`, `meeting_date`, `participants`, `source_content`.
- Instrução explícita para responder **somente** com JSON válido conforme o schema, sem texto adicional, sem markdown.
- Regras de negócio herdadas do produto: HU/ação com estimativa máxima de 24h, atividades ≤ 8h, datas nunca retroativas à `meeting_date`, idioma PT-BR.

## Schema de saída (próprio do Briefing)

```
{
  "summary": string,                          // resumo executivo curto
  "suggestions": [
    {
      "type": "task" | "decision" | "risk" | "follow_up",
      "title": string,                        // <=120 chars
      "description": string,                  // <=1200 chars
      "priority": "low" | "medium" | "high" | null,
      "assignee_name": string | null,         // texto livre (mapeado depois)
      "due_date": string | null,              // ISO yyyy-mm-dd, >= meeting_date
      "date_source": "explicit" | "inferred" | "none"
    }
  ]
}
```

Validação com Zod (versão via `npm:zod`). Se o modelo devolver campos extras, são ignorados; se faltar campo obrigatório, cai em `AI_OUTPUT_INVALID`.

## Config e publicação

- `supabase/config.toml` recebe:
  ```
  [functions.process-ai-briefing]
  verify_jwt = true
  ```
- Publicar imediatamente via deploy da nova function.

## Validação pós-deploy

- `curl` autenticado com um `briefingId` real:
  - retorna `success: true` e cria linhas em `ai_briefing_suggestions` + `ai_briefing_runs.status = 'completed'`.
- Cenário sem chave configurada → `AI_PROVIDER_KEY_MISSING`, sem stacktrace no toast.
- Cenário com JSON inválido → `AI_OUTPUT_INVALID`, `ai_briefing_runs.status = 'failed'` com `error_code` correspondente.
- Nenhuma alteração observável em `apf-generate` / rotinas de APF.
