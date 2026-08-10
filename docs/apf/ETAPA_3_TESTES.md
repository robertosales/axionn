# ETAPA 3 — TESTES DO PRIMEIRO GATE

## Suítes adicionadas

| Arquivo | Cobertura |
| --- | --- |
| `goldenMaster.test.ts` | Legacy v1 e contratual atual, proposta IA congelada, pesos, fator, percentual, PF bruto/ajustado, total e side effects |
| `canonicalJson.test.ts` | ordenação, null, campos ignorados, Unicode NFC, arrays, decimais, timestamps, restrição numérica e SHA-256 |
| `apfProfileVersioning.contract.test.ts` | Contrato estático M1–M4: schema, compatibilidade Legacy, ausência de defaults, hash, imutabilidade, RLS e grants |
| `supabase/tests/database/21_apf_profile_versioning.test.sql` | pgTAP: lifecycle, publicação, hash cross-runtime, imutabilidade, audit e isolamento tenant |

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

## Pendências de validação em banco

- validar fixtures contra amostra anonimizada de ambiente autorizado;
- executar introspecção e testes SQL em banco efêmero/clone;
- executar no PostgreSQL os vetores de canonicalização já portados para pgTAP;
- obter aceite financeiro dos valores Golden.

## Resultado desta execução

- Golden/canonicalização direcionados: **2 arquivos, 7 testes, todos aprovados**.
- Contratos M1–M4 direcionados: **3 arquivos, 13 testes, todos aprovados**.
- Suíte completa `npm test`: **104 arquivos, 504 testes, todos aprovados**.
- `npm run lint`: **aprovado com 0 erros e 1.718 warnings preexistentes**; nenhum warning novo foi identificado nos arquivos deste gate.
- `npm run build`: **aprovado**; exigiu execução fora do sandbox porque o esbuild tentou ler caminho bloqueado. Permaneceram avisos de Browserslist desatualizado e `eval` em dependência `bluebird`.
- Testes de banco: **não executados**, pois Supabase CLI/conexão não estão disponíveis.
