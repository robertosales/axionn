# ETAPA 3 — TESTES DO PRIMEIRO GATE

## Suítes adicionadas

| Arquivo | Cobertura |
| --- | --- |
| `goldenMaster.test.ts` | Legacy v1 e contratual atual, proposta IA congelada, pesos, fator, percentual, PF bruto/ajustado, total e side effects |
| `canonicalJson.test.ts` | ordenação, null, campos ignorados, Unicode NFC, arrays, decimais, timestamps, restrição numérica e SHA-256 |

## Comandos identificados

- `npm test` → `vitest run`
- `npm run lint` → ESLint
- `npm run build` → Vite build
- Banco: testes SQL em `supabase/tests/database`, mas Supabase CLI não está instalado neste ambiente.

## Critério Golden

- zero chamadas de IA/rede;
- proposta congelada no repositório;
- igualdade exata para contagens e valores normalizados;
- total financeiro recomposto por regras conhecidas;
- side effects atuais declarados, sem executá-los no teste unitário;
- PF faturável ausente até decisão formal.

## Pendências de teste antes de M1

- validar fixtures contra amostra anonimizada de ambiente autorizado;
- executar introspecção e testes SQL em banco efêmero/clone;
- portar vetores de canonicalização para PostgreSQL;
- obter aceite financeiro dos valores Golden.

## Resultado desta execução

- Golden/canonicalização direcionados: **2 arquivos, 7 testes, todos aprovados**.
- Suíte completa `npm test`: **103 arquivos, 498 testes, todos aprovados**.
- `npm run lint`: **aprovado com 0 erros e 1.718 warnings preexistentes**; nenhum warning novo foi identificado nos arquivos deste gate.
- `npm run build`: **aprovado**; exigiu execução fora do sandbox porque o esbuild tentou ler caminho bloqueado. Permaneceram avisos de Browserslist desatualizado e `eval` em dependência `bluebird`.
- Testes de banco: **não executados**, pois Supabase CLI/conexão não estão disponíveis.
