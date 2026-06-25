# Fluxo APF contratual baseline-first

## Objetivo

A contagem APF usa a planilha oficial da equipe de métricas como fonte de verdade. A IA não define pesos, percentuais ou valores de PF. Ela somente classifica uma HU quando não existe correspondência determinística na baseline.

## Fluxo operacional

```text
Planilha oficial XLSX
  -> parser e validação local
  -> importação versionada da baseline
  -> modelo contratual ativo
  -> seleção de projeto e sprint
  -> busca de correspondência na baseline
      -> correspondência exata: sem IA
      -> correspondência não exata: IA classifica tipo/fator
  -> banco resolve peso e percentual
  -> PF FS = PF Bruto x percentual / 100
  -> deduplicação por baseline/sessão
  -> validação humana por item
  -> evento de aprendizado e auditoria
```

## Regras centrais

1. A baseline ativa pertence a um projeto e ao modelo APF ativo do contrato.
2. Correspondência exata por referência de HU ou descrição homologada não consome IA.
3. A IA retorna somente `function_sigla`, `factor_sigla`, correspondência, confiança e justificativa.
4. Pesos e percentuais são consultados no banco.
5. Itens `N/A` produzem `0` PF.
6. Uma função da baseline é contada uma única vez por sessão e fator, mesmo quando referenciada por mais de uma HU.
7. Toda correção humana exige motivo e gera evento de aprendizado na mesma transação.
8. Totais da sessão são recalculados a partir dos itens persistidos.

## Fórmula

```text
PF FS = PF Bruto x contribuição percentual / 100
```

Exemplo homologado:

```text
HU200
Tipo: TRN
PF Bruto: 4,60
Fator: A
Contribuição: 60%
PF FS: 4,60 x 60 / 100 = 2,76
```

## Componentes frontend

- `ApfBaselineTab`: upload, pré-visualização, versionamento e ativação da baseline.
- `ApfFunctionPointTab`: contagem por HU, totais, confiança e validação.
- `useApfBaselineImport`: importação da planilha e histórico de versões.
- `useContractualApfCounting`: orquestra sessão, matching, classificação, persistência e validação.
- `apfBaselineParser`: normaliza a planilha oficial em itens, tipos funcionais e fatores.

## RPCs de banco

- `apf_import_baseline`
- `get_active_apf_context`
- `get_apf_baseline_candidates`
- `open_counting_session`
- `build_apf_prompt`
- `save_contractual_counting_items`
- `validate_apf_counting_item`

## Ordem de implantação

Aplicar as migrations na ordem:

1. `20260624000002_apf_contractual_schema.sql`
2. `20260624000003_apf_baseline_rpc.sql`
3. `202606240000035_drop_legacy_build_apf_prompt.sql`
4. `20260624000004_apf_counting_rpc.sql`
5. `20260624000005_apf_contractual_invariants.sql`
6. `20260624000006_apf_atomic_validation.sql`

A migration de compatibilidade remove apenas a assinatura legada `build_apf_prompt(UUID)`, necessária quando o ambiente já contém essa função com tipo de retorno diferente. A sobrecarga `build_apf_prompt(UUID, TEXT)` não é removida.

A Edge Function já utilizada pelo fluxo é `apf-generate`. Não existe dependência de uma Edge Function específica para contar ou validar: essas operações usam RPCs autenticados e atômicos.

## Verificação mínima

Após aplicar as migrations:

1. Abrir **APF > Baseline**.
2. Selecionar um projeto com contrato.
3. Importar a planilha oficial e confirmar os totais da prévia.
4. Ativar a baseline.
5. Abrir **APF > Contar PF**.
6. Selecionar a mesma combinação de projeto e sprint.
7. Calcular uma HU que exista na baseline e verificar `deterministic_match` visualmente pela mensagem sem consumo de IA.
8. Validar o item e verificar a criação do evento em `apf_validation_events`.
9. Corrigir tipo ou fator, informar o motivo e confirmar a atualização do PF FS e dos totais.

## Testes automatizados

`src/features/apf/services/apfBaselineParser.test.ts` cobre:

- normalização de contribuição `0,60` para `60%`;
- cálculo de `4,60 x 60% = 2,76`;
- preservação de itens não mensuráveis;
- derivação de pesos e fatores da planilha.
