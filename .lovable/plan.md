O erro "A IA não retornou nenhum item de contagem" dispara no `ApfFunctionPointTab.tsx` quando o parser conseguiu extrair JSON da resposta do `apf-generate`, mas a lista de itens ficou vazia — geralmente porque a IA devolveu o objeto com outra chave (`componentes`, `componentes_funcionais`, `pontos_funcao`, `data.items`, etc.) ou um único objeto em vez de array.

Hoje o código aceita apenas: array direto, `items`, `efs` ou `functions`. Sem log do raw, fica impossível diagnosticar HU a HU.

## Arquivo único alterado
`src/features/apf/components/ApfFunctionPointTab.tsx`

## Mudanças

1. **Normalização ampliada da lista de itens** (após `extractJsonFromAiResponse`):
   - Aceitar também: `componentes`, `componentes_funcionais`, `funcoes`, `functionPoints`, `pontos_funcao`, `data.items`, `result.items`.
   - Se o parsed for um objeto único com campo `type`/`tipo`, encapsular em array de 1 item.
   - Varredura recursiva rasa (1 nível) procurando o primeiro array de objetos com `type`/`tipo`.

2. **Log + erro mais informativo**:
   - `console.warn("[apf-count] raw markdown:", aiResult.markdown?.slice(0, 800))` antes do parse.
   - Quando `items.length === 0`, lançar `Error("A IA não retornou nenhum item. Provedor: <X>. Verifique o console para a resposta crua.")` com snippet (primeiros 200 chars) anexado.

3. **Salvaguarda no breakdown**:
   - Ignorar entries com `type` vazio para não inflar `total` com peso default.

## Fora do escopo
- Não alterar `apf-generate` nem `build_apf_prompt` (RPC do banco).
- Não mexer em outras telas ou no `count-function-points`.
