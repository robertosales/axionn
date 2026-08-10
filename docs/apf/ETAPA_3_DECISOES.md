# ETAPA 3 — DECISÕES BLOQUEADORAS

> Estado: PRECISA DE DECISÃO
>
> Regra: nenhum default desta página pode alterar silenciosamente resultado financeiro ou histórico.

| ID | Decisão | Estado | Bloqueia | Opções/evidência sem decisão implícita |
| --- | --- | --- | --- | --- |
| DEC-001 | Data de referência da medição | PRECISA DE DECISÃO | Context resolver/snapshot | Abertura, realização, aceite ou faturamento; Legacy atual usa contexto de execução sem vigência formal |
| DEC-002 | Definição e fórmula de PF faturável | PRECISA DE DECISÃO | Engine/finalização | Até decisão, `pf_faturavel = null`; apenas PF ajustado pode ser reproduzido |
| DEC-003 | Glosa | PRECISA DE DECISÃO | Engine/billing | Definir escopo, estado, autoria, reversão e fórmula |
| DEC-004 | Aprovação parcial | PRECISA DE DECISÃO | Engine/billing | Definir granularidade por item/sessão e trilha de auditoria |
| DEC-005 | Modo de arredondamento | PRECISA DE DECISÃO | Ruleset/engine | Runtime contratual atual usa `round(..., 2)`; não generalizar sem aprovação |
| DEC-006 | Escala decimal | PRECISA DE DECISÃO | Ruleset/engine | Atual materializa duas casas em vários pontos; contrato futuro precisa declarar escala |
| DEC-007 | Etapa do arredondamento | PRECISA DE DECISÃO | Engine/totais | Por item, subtotal, total ou combinação; altera resultado |
| DEC-008 | Segregação de aprovação/publicação | PROPOSTO EM M4 / PRECISA DE APROVAÇÃO | Lifecycle/RLS | Implementação conservadora: `admin_contrato` edita/submete; owner/admin aprova/publica/retira |
| DEC-009 | Histórico oficial versus TR vigente | PRECISA DE DECISÃO | Precedência/fator | Código atual prioriza histórico em determinados fluxos; arquitetura propõe snapshot/TR como autoridade |
| DEC-010 | Reabertura/recontagem | PRECISA DE DECISÃO | Lifecycle da sessão | Recomendação técnica: nova sessão/revisão, nunca sobrescrever resultado validado |

## Constatações que não são decisões de negócio

- **CONFIRMADO:** o total Legacy é recalculado pela Edge Function com pesos fixos; o `total` da IA não é aceito como autoridade.
- **CONFIRMADO:** o runtime contratual calcula `pf_fs = round(weight * contribution_pct / 100, 2)` no banco atual.
- **CONFIRMADO:** `function_point_analyses`, `project_fp_baselines`, `useFunctionPointCounter`, `count-function-points` e `FunctionPointBaseline` possuem consumidores e serão preservados.
- **NÃO VERIFICADO:** schema, grants, RLS, funções e dados efetivamente implantados no banco remoto.
- **PROPOSTO:** canonical JSON v1 restringe valores decimais a strings, evitando diferença TS/PostgreSQL.

## Decisão necessária para prosseguir

M1–M4 foram implementadas sem defaults financeiros: versões não podem ser publicadas com política de arredondamento incompleta. Aplicação/rollout exige validação de DEC-005, DEC-006, DEC-007 e DEC-008. O contexto/snapshot/engine exige também DEC-001, DEC-002, DEC-009 e DEC-010. DEC-003/004 podem permanecer bloqueadas se PF faturável continuar explicitamente não implementado.
