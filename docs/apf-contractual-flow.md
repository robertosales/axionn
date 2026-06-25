# Fluxo APF contratual baseline-first

## Objetivo

A contagem APF usa a planilha oficial da equipe de métricas como fonte de verdade. A IA não define pesos, percentuais ou valores de PF.

A HU é somente o gatilho de impacto. A unidade funcional avaliada é a EF da baseline, e uma transação só gera PF separado quando representa processo elementar único, completo e independente.

## Fluxo operacional

```text
Planilha oficial XLSX
  -> validação e importação versionada da baseline
  -> HU identifica impactos
  -> referência exata da baseline ou classificação assistida
  -> identificação do processo central
  -> consolidação de ações auxiliares
  -> revisão dos casos ambíguos
  -> banco resolve peso e percentual
  -> PF Simples = PF Bruto x percentual / 100
  -> deduplicação por processo elementar
  -> validação humana
  -> evento de aprendizado e auditoria
```

## Princípio fundamental

1. A HU nunca é a unidade de contagem.
2. A HU apenas dispara a análise de impacto.
3. Cada EF impactada da baseline deve ser avaliada.
4. Transações só são contadas separadamente quando o processo é completo e independente.
5. Histórico, preview, validações, consultas, visualizações, mensagens e carregamentos são auxiliares por padrão.
6. Uma ação auxiliar só pode ser separada quando a baseline ou um precedente oficial da equipe comprovar sua independência.
7. EFs transacionais com a mesma chave de processo elementar são contadas uma única vez por sessão e fator.
8. EFs de dados continuam sendo deduplicadas pela função da baseline.

## Decisões do motor

| Decisão | Efeito |
|---|---|
| `counted` | Gera PF Bruto e PF Simples |
| `absorbed` | Ação absorvida pelo processo central; gera 0 PF |
| `review_required` | Não gera PF até decisão humana |
| `not_countable` | Item não mensurável; gera 0 PF |

## Revisão humana

Na validação, o analista informa:

- papel: processo central, independente ou ação auxiliar;
- se o processo é completo;
- se o processo é independente;
- precedente oficial para separação, quando aplicável;
- motivo e justificativa da decisão.

O banco impede a validação final de itens que permanecem em `review_required`.

## Fórmula

```text
PF Simples = PF Bruto x contribuição percentual / 100
```

Exemplo homologado:

```text
HU200
Tipo: TRN
PF Bruto: 4,60
Fator: A
Contribuição: 60%
PF Simples: 4,60 x 60 / 100 = 2,76
```

## Componentes principais

- `ApfBaselineTab`: validação, upload, versionamento e ativação da baseline.
- `ApfFunctionPointTab`: impactos por HU, processos elementares, PF e validação.
- `useContractualApfCounting`: orquestra matching, processo elementar, persistência e revisão.
- `elementaryProcess.ts`: normalização e classificação conservadora de ações auxiliares.
- `apf_elementary_processes`: catálogo de processos da sessão.
- `save_contractual_counting_items`: aplica unicidade, absorção, deduplicação e cálculo.
- `resolve_apf_elementary_process_item`: registra a decisão do analista.

## Ordem de implantação

Aplicar as migrations na ordem:

1. `20260624000002_apf_contractual_schema.sql`
2. `20260624000003_apf_baseline_rpc.sql`
3. `202606240000035_drop_legacy_build_apf_prompt.sql`
4. `20260624000004_apf_counting_rpc.sql`
5. `20260624000005_apf_contractual_invariants.sql`
6. `20260624000006_apf_atomic_validation.sql`
7. `20260625000007_apf_contractual_integrity.sql`
8. `20260625000008_apf_elementary_process_engine.sql`
9. `20260625000009_apf_elementary_process_review.sql`
10. `20260625000010_apf_elementary_process_runtime_patch.sql`

## Verificação mínima

Após aplicar as migrations:

1. Reimporte e ative a baseline oficial.
2. Calcule uma HU com referência exata e confirme `baseline_exact`.
3. Confirme que a HU200 resulta em `TRN/A`, PF Bruto `4,60` e PF Simples `2,76`.
4. Teste uma HU contendo processo central, preview e validação.
5. Confirme que preview e validação ficam como `absorbed` ou `review_required`, nunca como PF automático.
6. Na tela de validação, marque uma ação como independente sem precedente e confirme que o banco rejeita.
7. Informe um precedente oficial e confirme que a separação passa a ser permitida.
8. Confirme que duas HUs ligadas ao mesmo processo transacional não duplicam o PF da sessão.

## Testes automatizados

Os testes cobrem:

- cálculo de PF Bruto e PF Simples da baseline;
- integridade de pesos e fatores;
- identificação de preview, histórico e validação como ações auxiliares;
- absorção de ação auxiliar sem precedente;
- aceitação de processo independente com precedente oficial;
- normalização da chave de processo elementar.
