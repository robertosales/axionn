## Diagnóstico

A edge function `process-ai-briefing` está retornando 422 `AI_OUTPUT_INVALID_DATE_FORMAT` porque a IA devolve `dueDate` em formatos que o parser não aceita. O `normalizeDate` atual (linhas 140-198 de `supabase/functions/process-ai-briefing/index.ts`) só reconhece três padrões estritos:

- `YYYY-MM-DD` (mês e dia obrigatoriamente com 2 dígitos)
- `DD/MM/YYYY` ou `DD-MM-YYYY`
- `DD/MM/YY` ou `DD-MM-YY`

Formatos comuns que a IA gera e que quebram tudo hoje:
- `2026-07-09T00:00:00` / `2026-07-09T00:00:00Z` (ISO com hora)
- `2026-7-9`, `9/7/2026` (sem zero-padding)
- `09 de julho de 2026`, `julho de 2026` (linguagem natural em PT-BR)
- `2026/07/09` (barra no formato ISO)

Como o parser lança `HttpError` na primeira falha, um único `dueDate` mal formado invalida o briefing inteiro — mesmo quando as demais sugestões estão perfeitas. Esse é o comportamento que o usuário viu.

## Solução

Alterações **apenas** em `supabase/functions/process-ai-briefing/index.ts`. Sem mudança de UI, migrations ou schemas do cliente.

### 1. Tornar `normalizeDate` mais tolerante

Aceitar, sempre normalizando para `YYYY-MM-DD`:
- ISO com hora: pegar apenas os 10 primeiros caracteres antes de aplicar o regex ISO.
- Mês/dia sem zero à esquerda em ISO: `^(\d{4})-(\d{1,2})-(\d{1,2})$`.
- `YYYY/MM/DD` como sinônimo do ISO.
- `DD de <mês> de YYYY` em PT-BR (janeiro…dezembro, com/sem acento, case-insensitive).

Manter a validação de dia/mês reais (rejeita 31/02) e retornar sempre `YYYY-MM-DD`.

### 2. Falha suave em vez de 422 global

Se, após todas as tentativas, o valor ainda for irreconhecível, **não** derrubar o briefing:
- descartar `dueDate`
- forçar `dateSource = "absent"`
- registrar via `console.warn` para observabilidade

Rationale: o briefing tem valor mesmo sem data em uma sugestão isolada; hoje 1 data ruim = 0 sugestões entregues. Datas mal preenchidas continuam bloqueadas apenas quando o `dateSource` foi `explicit`/`inferred` e nem o modo tolerante conseguiu extrair — e mesmo assim caímos para `absent` em vez de 422.

### 3. Reforçar o prompt

Em `buildPrompt` (linhas 398-448), adicionar instrução explícita no bloco de regras:
- `dueDate` DEVE estar em `YYYY-MM-DD` estrito (ex: `2026-07-09`).
- NUNCA usar linguagem natural, timestamps, hora, timezone ou nomes de mês.
- Se não houver data no texto, omitir `dueDate` e usar `dateSource: "absent"`.

Isso reduz a chance de a IA devolver formatos exóticos em primeiro lugar.

### Fora de escopo

- Não alterar `briefingAnalysisSchema.ts` do cliente (validação server-side é a fonte da verdade aqui).
- Não mexer em migrations, RLS, nem em outras funções.
- Não trocar o modelo/provider.

## Critério de aceite

- Chamadas ao `process-ai-briefing` deixam de retornar 422 quando o único problema é formato de `dueDate`.
- Datas em ISO com hora, ISO sem zero-padding, `YYYY/MM/DD` e `DD de mês de YYYY` são normalizadas para `YYYY-MM-DD`.
- Datas realmente inválidas (ex: `31/02/2026`) continuam sendo capturadas — mas em vez de 422 a sugestão vira `dateSource=absent` e o briefing conclui.
