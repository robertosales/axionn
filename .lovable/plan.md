# Conectar aba "Contar PF" ao backend APF real

## Objetivo
Substituir a chamada da Edge Function inexistente `count-function-points` em `src/features/apf/components/ApfFunctionPointTab.tsx` pelo fluxo real já deployado: `open_counting_session` → `build_apf_prompt` → `apf-generate` → `save_counting_items`.

Sem mudanças em layout, estilos, JSX, KPIs, validação humana ou carregamento de sprints/HUs.

## Mudanças

**Arquivo único:** `src/features/apf/components/ApfFunctionPointTab.tsx`

Reescrever apenas o corpo do `try { ... }` dentro de `countFpForHu`:

1. **PASSO 1** — `supabase.rpc("open_counting_session", { p_project_id: teamId, p_sprint_ref: selectedSprintId, p_release_ref: null, p_redmine_ref: hu.code, p_baseline_id: null })` → retorna `sessionId`.
2. **PASSO 2** — `supabase.rpc("build_apf_prompt", { p_session_id: sessionId })` → retorna `builtPrompt`.
3. **PASSO 3** — `supabase.functions.invoke("apf-generate", { body: { prompt: \`${builtPrompt}\n\n=== HISTÓRIA DE USUÁRIO ===\n${buildStoryText(hu)}\n=== FIM ===\`, skipDocx: true } })`. Se `!aiResult.success`, lançar `aiResult.userMessage`.
4. **Parse** de `aiResult.markdown`: limpar cercas ```json, `JSON.parse`, aceitar `Array` direto, `.items`, `.efs` ou `.functions`. Montar `breakdown = {EI,EO,EQ,ILF,EIF,total}` somando 1 por tipo e peso 3/4/6 conforme `complexity` SIMPLE/MEDIUM/COMPLEX. `confidence = parsed.confidence ?? 0.8`. Erro amigável se JSON inválido ou lista vazia.
5. **PASSO 4** — `supabase.rpc("save_counting_items", { p_session_id: sessionId, p_items: items, p_ai_model: aiResult.providerUsed ?? null })`.
6. **Estado local** — atualizar `analyses[hu.id]` e `userStories` com `breakdown`, `totalPf`, `confidence` (mesma forma que hoje, só trocando a origem dos dados). Toast de sucesso com `totalPf`.

O `catch` existente permanece — continua mostrando toast amigável (incluindo a mensagem de "sem créditos" vinda de `aiResult.userMessage`).

## Não alterar
- `buildStoryText`, `validateFp`, `countAllPending`, carregamento de sprints/HUs, tipos, imports, JSX, KPIs, tabela.

## Ponto de atenção (precisa decisão sua)
O componente hoje tem um seletor de provedor de IA (incluindo "Lovable AI grátis") adicionado nas últimas mensagens, que envia `providerId`/`forceProvider` para `count-function-points`. A função `apf-generate` **não aceita esses parâmetros** — ela escolhe o provedor sozinha no backend.

Opções:
- **A (recomendada, segue o prompt):** remover o seletor de provedor da UI desta aba. O `apf-generate` faz fallback automático entre provedores configurados.
- **B:** manter o seletor visualmente mas ignorar a seleção (não tem efeito real).
- **C:** não tocar no seletor agora e adaptar depois o `apf-generate` para aceitar `forceProvider`.

Qual seguir?
