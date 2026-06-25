# Fluxo APF contratual baseline-first

## Objetivo

A baseline APF pertence ao projeto e representa seu catálogo funcional oficial. Ela não pertence à sprint. Cada sprint contém HUs que funcionam como gatilhos de impacto sobre esse catálogo.

A IA não define pesos, tipos ou processos inexistentes. Ela pode auxiliar na seleção dos processos e itens da baseline que foram impactados pela HU. O banco usa os itens oficiais, o PF Bruto registrado na baseline e o fator de impacto aplicável à HU.

## Fluxo operacional

```text
Baseline oficial XLSX do projeto
  -> validação e importação versionada
  -> catálogo de EFs/processos e itens funcionais
  -> sprint seleciona as HUs da medição
  -> clique em Calcular na HU
  -> recuperação dos processos candidatos
  -> seleção dos itens funcionais efetivamente impactados
  -> aplicação do fator de impacto da HU
  -> PF Simples = PF Bruto da baseline x percentual do fator
  -> persistência e deduplicação por item funcional
  -> validação humana
  -> auditoria e aprendizado
```

## Princípio fundamental

1. A HU nunca é a unidade de contagem.
2. A HU apenas dispara a análise de impacto.
3. A baseline é vinculada ao projeto e reutilizada entre as sprints.
4. Cada EF/processo impactado é recuperado do catálogo oficial do projeto.
5. Dentro do processo, somente as linhas funcionais sustentadas pelo texto e pelas evidências da HU são selecionadas automaticamente.
6. Cada linha oficialmente separada na baseline preserva tipo, complexidade e PF Bruto próprios.
7. Consultas, entradas, saídas e arquivos só são separados quando a própria baseline os registra como funções oficiais distintas e a HU os impacta.
8. A mesma linha da baseline não é contada duas vezes na mesma sessão e fator, mesmo quando impactada por mais de uma HU.
9. O fator da baseline representa seu estado de origem; o fator aplicado à HU representa o impacto da demanda atual.

## Exemplo GESP3

O grupo `EF172` contém três linhas funcionais oficiais:

```text
Distribuir Processo: EE / Baixa = 3 PF Bruto
Listar Processos: CE / Média = 4 PF Bruto
Selecionar Analista: CE / Baixa = 3 PF Bruto
```

Uma HU cujo título e critérios mencionem apenas **distribuir processos bancários** seleciona inicialmente somente a linha EE:

```text
PF Bruto = 3,00
Fator A = 60%
PF Simples = 1,80
```

Se os critérios da mesma HU também alterarem explicitamente **listar processos** e **selecionar analista**, essas linhas são adicionadas:

```text
PF Bruto total = 3 + 4 + 3 = 10
PF Simples com A = 1,80 + 2,40 + 1,80 = 6,00
```

Quando o texto não diferencia as linhas do grupo, o sistema preserva os candidatos para decisão do analista em vez de inventar uma função.

O sistema não converte `EE`, `CE`, `SE`, `ALI` ou `AIE` em `TRN`. O PF Bruto vem diretamente da linha oficial da baseline, considerando sua complexidade.

## Fatores de impacto

O fator é inferido a partir da HU e pode ser corrigido na validação:

| Evidência na HU | Fator preferencial |
|---|---|
| Função existente alterada | `A` |
| Exclusão/remoção | `E` |
| Migração/carga | `PMD` |
| Correção de erro | `COR`, `COR50` ou fator contratual disponível |
| Nova função fora da baseline | fluxo específico de inclusão |

O sistema aceita somente fatores cadastrados pela planilha/modelo do projeto.

## Baseline do projeto

A importação registra:

- projeto proprietário;
- versão e arquivo de origem;
- checksum;
- itens funcionais;
- código e nome do processo/EF;
- tipo funcional;
- complexidade;
- PF Bruto;
- fatores de impacto;
- referências de produto, projeto e medição.

A baseline ativa pode ser substituída por uma versão nova. As versões anteriores permanecem arquivadas para auditoria.

### Exclusão

- baseline nunca utilizada: exclusão física;
- baseline com sessões de contagem: retirada da operação e arquivamento auditável;
- baseline ativa excluída: o projeto fica sem baseline ativa até nova importação.

## Recálculo de HU

A ação **Recalcular**:

1. grava um snapshot da contagem atual;
2. remove apenas os vínculos da HU selecionada;
3. preserva itens compartilhados com outras HUs;
4. recalcula os totais da sessão;
5. executa novamente a identificação na baseline ativa.

O recálculo é explícito. O botão de cálculo em lote processa somente HUs pendentes.

## Revisão humana

Na validação, o analista pode:

- confirmar os itens recuperados da baseline;
- corrigir o fator de impacto;
- decidir se um item deve ser absorvido ou contado;
- informar precedente e justificativa;
- homologar PF Bruto e PF Simples.

O tipo e o PF Bruto de um item vinculado à baseline não são alterados livremente pela interface; eles são atributos do catálogo oficial.

## Componentes principais

- `ApfBaselineTab`: importação, validação, histórico e exclusão da baseline do projeto.
- `apfBaselineParser`: interpreta processos, itens, tipos, complexidades e fatores.
- `get_apf_project_process_candidates`: recupera grupos candidatos para uma HU.
- `projectBaselineItemSelection.service`: diferencia as linhas impactadas dentro do grupo.
- `projectBaselineCounting.service`: decide o fator inicial e monta os itens oficiais.
- `useContractualApfCounting`: executa cálculo individual, pendentes e recálculo.
- `reset_apf_story_counting`: preserva snapshot e limpa a HU para nova execução.

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
11. `20260625000011_apf_project_baseline_catalog.sql`
12. `20260625000012_apf_project_counting_runtime.sql`

## Verificação mínima

1. Importar `APF-GESP 3-Baseline.xlsx` no projeto GESP3.
2. Confirmar escopo **Projeto** e aproximadamente 480 itens funcionais.
3. Confirmar os tipos `EE`, `CE`, `SE`, `ALI`, `AIE` e `TRN`.
4. Confirmar que `EF172` reúne três linhas com PF Bruto `3`, `4` e `3`.
5. Calcular a HU de distribuição de processos bancários.
6. Confirmar seleção inicial da linha `EE / Baixa / 3 PF Bruto`.
7. Confirmar fator `A` e PF Simples `1,80`, salvo evidência de outro impacto.
8. Adicionar critérios explícitos de listagem/seleção e confirmar inclusão das CEs.
9. Clicar em **Recalcular** e verificar nova execução com histórico preservado.
10. Excluir uma baseline de teste e verificar exclusão física ou arquivamento conforme seu uso.

## Testes automatizados

Os testes cobrem:

- agrupamento de itens por código EF;
- preservação de tipo, complexidade e PF Bruto;
- pesos por tipo e complexidade;
- fatores de impacto;
- seleção determinística de processo;
- seleção de linhas impactadas dentro do processo;
- inferência inicial do fator;
- rejeição de itens fora da baseline;
- integridade e totais da baseline.
