# Corrigir 400 em `count-function-points`

## Causa raiz
O frontend (`ApfFunctionPointTab.tsx`) envia o body com os campos:
`story_id`, `story_title`, `story_description`, `story_acceptance_criteria`, `provider`, `apiKey`, `calibrationContext`.

Mas a edge function `supabase/functions/count-function-points/index.ts` valida e exige:
`teamId` (UUID), `huId` (UUID), `storyText` (não-vazio), e opcionalmente `context` + `providerId`.

Como `huId` e `storyText` ficam `undefined`, a função retorna **400** com mensagens como `"huId (UUID) é obrigatório"` / `"storyText é obrigatório"`. Daí o erro no console.

## Correção (apenas frontend, sem alterar a edge function)

Em `src/features/function-points/hooks/useFunctionPointCounter.ts` e em `src/features/apf/components/ApfFunctionPointTab.tsx`, ajustar o body enviado para `supabase.functions.invoke("count-function-points", ...)`:

- `huId` ← `hu.id`
- `storyText` ← concatenar `hu.title` + (opcional) `hu.description` em uma única string
- `context` ← `{ storyPoints: hu.story_points ?? null, acceptanceCriteria: hu.acceptance_criteria ?? null, storyType: hu.type ?? null }`
- `providerId` ← `aiPayload.providerId` (manter)
- Remover do payload os campos que a função ignora/não suporta: `story_id`, `sprint_id`, `story_code`, `story_title`, `story_description`, `story_acceptance_criteria`, `provider`, `apiKey`, `calibrationContext`.

Manter o tratamento de erro amigável já existente no hook.

## Validação
1. Recarregar a página `APF → Pontos de Função` em Sala Ágil.
2. Clicar em "Contar PF" para uma HU.
3. Confirmar no Network que o POST retorna 200 e `data.breakdown` é renderizado.
4. Conferir logs do edge function (sem erro 400).

## Escopo
- Edição apenas no frontend (2 arquivos).
- Nenhuma alteração de schema, migração ou edge function.
