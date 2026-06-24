Aplicar parser robusto de JSON na edge function `count-function-points` para tolerar respostas malformadas de modelos de IA (Groq, Perplexity, Sakana, Gemini).

## Arquivo único alterado
`supabase/functions/count-function-points/index.ts`

## Mudanças

1. **Novo helper `extractJsonFromText`** com 4 estratégias em cascata:
   - Parse direto do texto
   - Extração de bloco markdown ```` ```json ... ``` ````
   - Primeiro `{...}` balanceado via varredura de chaves
   - Limpeza de trailing commas (`,}` / `,]`)

2. **`parseFpResponse` reescrito**:
   - Usa `extractJsonFromText` em vez de regex única
   - Fallback final: extrai EI/EO/EQ/ILF/EIF/confidence/reasoning via regex e recalcula total
   - Normaliza números com `parseInt`, clamp em `confidence` (0–1), trunca `reasoning` em 1000 chars
   - Mantém a interface `FpBreakdown` intacta

3. **`buildFpPrompt`**: substituir o bloco final `## IMPORTANTE` por instrução "REGRA ABSOLUTA" com exemplos CORRETO/INCORRETO explícitos.

4. **`callGemini`**: após obter o texto, logar warning se começar com ```` ``` ```` (Gemini ignorando `response_mime_type`).

5. **Handler principal**: adicionar `console.log` do `rawResponse` (provider, tamanho, primeiros 500 chars) imediatamente antes de `parseFpResponse`.

## Fora do escopo
- Nenhum outro arquivo é tocado.
- Interface de resposta da função preservada.
- Deploy ocorre automaticamente após a edição.
