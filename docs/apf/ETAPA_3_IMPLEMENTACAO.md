# ETAPA 3 — IMPLEMENTAÇÃO DO APF POR CONTRATO/TR

> Branch: `feature/apf-contrato-tr-etapa-3`
>
> Base: `develop` (`0c87dfe6`)
>
> Estado: M1–M4 IMPLEMENTADAS NO REPOSITÓRIO — NÃO EXECUTADAS NO BANCO

## Escopo entregue neste gate

| Backlog | Estado | Evidência |
| --- | --- | --- |
| APF-ET3-001 | PARCIAL | Inventário do repositório concluído; banco implantado NÃO VERIFICADO |
| APF-ET3-002 | CONCLUÍDO | Fixtures offline dos runtimes Legacy v1 e contratual atual |
| APF-ET3-003 | CONCLUÍDO | Outputs financeiros e side effects esperados congelados |
| APF-ET3-004 | CONCLUÍDO NO TYPESCRIPT | Canonical JSON v1, SHA-256 e vetores fixos; implementação PostgreSQL depende de M1+ |
| APF-ET3-005 | BLOQUEADO | Decisões financeiras e de governança precisam de aprovação |

No primeiro gate, nenhuma migration, RPC, policy, tabela ou dado foi criado/alterado. O plano aprovado permaneceu intacto.

## Fase M1–M4

Após autorização explícita para avançar, foram criadas quatro migrations aditivas:

- M1: `apf_profiles` e `apf_profile_versions`, com identidade contratual, estados, revisão otimista, vigência e campos de hash.
- M2: `apf_profile_rulesets`, tipos, pesos, fatores, manutenção e precedência versionados. `apf_function_type_weights` permanece intacta como fonte Legacy v1.
- M3: canonicalização compatível TS/PostgreSQL, SHA-256, proteção contra vigências sobrepostas, bloqueio de alteração/exclusão publicada e imutabilidade dos catálogos filhos.
- M4: RLS hierárquica, grants mínimos, audit trail append-only e RPCs controladas de transição, publicação e retirada.

O lifecycle implementado é conservador: `admin_contrato` pode manter draft e enviar/reabrir revisão; owner/admin da organização aprova, publica e retira. Publicação exige catálogo completo e política de arredondamento explicitamente preenchida. Nenhuma regra de PF faturável foi implementada.

Compatibilidade: nenhuma das quatro migrations altera `apf_counting_sessions`, `apf_counting_items`, `apf_counting_models`, `function_point_analyses`, `project_fp_baselines` ou RPCs existentes.

## Golden Master

Local: `src/features/apf/golden` (padrão de testes colocados ao lado do código, já usado pelo projeto).

- `legacy-v1-basic-ifpug`: congela input, resposta IA, pesos EI/EO/EQ/ILF/EIF, total recalculado e efeitos em `user_stories`/`function_point_analyses`.
- `contractual-current-two-trn-factor-a`: congela dois processos TRN, peso 4,6, fator A/60%, PF bruto 9,2, PF ajustado 5,52, arredondamento atual e efeitos esperados.
- Nenhum teste chama IA, Supabase ou rede.
- Campos financeiros não confiáveis da proposta são deliberadamente diferentes do esperado, provando que não são usados pelos testes determinísticos.
- `pfFaturavel` permanece `null`: nenhuma regra foi inventada.

Limite conhecido: os fixtures são representativos e derivados do código/migrations; sua comparação com casos implantados depende de acesso controlado a dados anonimizados e aprovação do responsável financeiro.

## Canonical JSON v1

Contrato implementado:

- objetos têm chaves ordenadas lexicograficamente;
- `null` é preservado; `undefined` de objeto é omitido;
- strings são NFC e preservam espaços/case;
- arrays preservam ordem, pois sua ordenação é semântica e deve ocorrer no builder de domínio;
- números aceitos são somente inteiros seguros;
- decimais financeiros são strings normalizadas por `canonicalDecimal`;
- timestamps são convertidos explicitamente a UTC/ISO por `canonicalTimestamp`;
- campos voláteis ignorados: `created_at`, `updated_at`, `created_by`, `random_id`, `request_id`;
- SHA-256 usa UTF-8 sobre a representação canônica.

Esta restrição evita divergência entre IEEE-754 do JavaScript e `numeric` do PostgreSQL. Os mesmos vetores deverão ser implementados em testes SQL antes de snapshots serem publicados.

## Gate para aplicar M1–M4 em banco

As migrations não devem ser aplicadas fora de banco efêmero/clone enquanto:

1. as decisões em `ETAPA_3_DECISOES.md` não forem aprovadas no mínimo para lifecycle e modelo financeiro;
2. o Golden Master não for validado contra amostra anonimizada do ambiente relevante;
3. a suíte pgTAP, incluindo os mesmos vetores SHA-256 do TypeScript, não for executada;
4. o inventário de schema/policies/grants implantados não for obtido ou formalmente dispensado com risco aceito.

## Princípios preservados

> IA PROPÕE. BANCO CALCULA. SNAPSHOT CONGELA. SESSION REGISTRA. ITEM MATERIALIZA. AUDITORIA PROVA.

> LEGACY CONTINUA FUNCIONANDO ATÉ QUE A EQUIVALÊNCIA SEJA COMPROVADA.
