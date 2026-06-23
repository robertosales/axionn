## Resolver erro AI_PROVIDER_ERROR do Sakana AI (Fugu — APF)

### Diagnóstico
Log da edge `apf-generate`: `API key não configurada para "Sakana AI (Fugu — APF)"`. O provider existe em `ai_providers`, mas não há key no Vault. Solução: salvar o token como secret e adicionar fallback no `resolveProvider`.

### Passos

1. **Pedir o secret `SAKANA_API_KEY`** via formulário seguro (você cola o token que já compartilhou).

2. **Patch em `supabase/functions/apf-generate/index.ts` — função `resolveProvider` (após a tentativa do Vault, antes do erro):**
   - Se `apiKey` segue nulo **e** `row.provider_type === "sakana"`, ler `Deno.env.get("SAKANA_API_KEY")` como fallback.
   - Demais providers seguem o comportamento atual (Vault → chave inline → erro).

3. **Validar** chamando `apf-generate` (via curl autenticado) com o provider Sakana e conferindo nos logs que o erro sumiu.

### Fora de escopo
- Frontend, outros providers, schema do banco — nada muda.

### Importante (segurança)
O token foi colado em chat. Trate-o como comprometido: gere um novo no painel da Sakana após o teste e me peça para atualizar o secret.