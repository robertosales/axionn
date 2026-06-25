# Fluxo APF contratual baseline-first

## Objetivo

A baseline APF pertence ao projeto e representa seu catálogo funcional oficial. Ela não pertence à sprint. Cada sprint contém HUs que funcionam como gatilhos de impacto sobre esse catálogo.

A IA não define pesos, tipos ou processos inexistentes. Ela pode auxiliar na seleção dos processos da baseline que foram impactados pela HU. O banco usa os itens oficiais, o PF Bruto registrado na baseline e o fator de impacto aplicável à HU.

## Fluxo operacional

```text
Baseline oficial XLSX do projeto
  -> validação e importação versionada
  -> catálogo de EFs/processos e itens funcionais
  -> sprint seleciona as HUs da medição
  -> clique em Calcular na HU
  -> recuperação dos processos candidatos da baseline
  -> seleção determinística ou assistida por IA
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
5. Cada linha funcional oficialmente separada na baseline preserva tipo, complexidade e PF Bruto próprios.
6. Consultas, entradas, saídas e arquivos só são separados quando a própria baseline os registra como funções oficiais distintas.
7. A mesma linha da baseline não é contada duas vezes na mesma sessão e fator, mesmo quando impactada por mais de uma HU.
8. O fator da baseline representa seu estado de origem; o fator aplicado à HU representa o tipo de impacto da demanda atual.

## Exemplo GESP3

O grupo `EF172` contém itens funcionais oficiais distintos:

```text
EE / Baixa = 3 PF Bruto
CE / Média = 4 PF Bruto
CE / Baixa = 3 PF Bruto
Total do grupo = 10 PF Bruto
```

Se uma HU de manutenção impactar o grupo e o fator contratual for `A = 60%`:

```text
PF Simples = 3 x 60% + 4 x 60% + 3 x 60%
PF Simples = 1,80 + 2,40 + 1,80
PF Simples = 6,00
```

O sistema não converte `EE`, `CE`, `SE`, `ALI` ou `AIE` em `TRN`. O PF Bruto vem diretamente da linha oficial da baseline, considerando sua complexidade.

## Fatores de impacto

O fator é inferido a partir da HU e pode ser corrigido na validação. A regra inicial é:

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
- `apfBaselineParser`: interpreta processos, itens, tipos, complexidades e fatores da planilha.
- `get_apf_project_process_candidates`: recupera grupos funcionais candidatos para uma HU.
- `projectBaselineCounting.service`: decide fator inicial e expande processos para itens oficiais.
- `useContractualApfCounting`: executa cálculo individual, cálculo de pendentes e recálculo.
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
4. Confirmar que `EF172` reúne três linhas funcionais com PF Bruto total 10.
5. Calcular a HU de distribuição de processos bancários.
6. Confirmar que o sistema recupera `EF172` e seus itens oficiais.
7. Confirmar que o fator da HU é `A`, salvo evidência de outro impacto.
8. Confirmar PF Bruto 10 e PF Simples 6 para `A = 60%`.
9. Clicar em **Recalcular** e verificar nova execução com histórico preservado.
10. Excluir uma baseline de teste e verificar exclusão física ou arquivamento conforme seu uso.

## Testes automatizados

Os testes cobrem:

- agrupamento de itens por código EF;
- preservação de tipo, complexidade e PF Bruto;
- pesos por tipo e complexidade;
- fatores de impacto;
- seleção determinística de processo;
- inferência inicial do fator;
- expansão de processo para itens oficiais;
- rejeição de processos inexistentes;
- integridade e totais da baseline.
