# Plano de ação — Cérebro de Contagem APF/PFS

## 1. Problema observado

A comparação entre a medição oficial e o Axion revelou dois desvios independentes:

1. **Superfragmentação:** uma HU é decomposta em dois ou três processos e todos entram automaticamente na contagem.
2. **Fator genérico incorreto:** na ausência de evidência suficiente, o motor utiliza `A — Alteração`, produzindo 2,76 PF onde a área de métricas utiliza `I — Inclusão`, com 4,60 PF.

A fórmula contratual está correta. O erro acontece antes dela, nas decisões de:

- quantos processos elementares devem ser contados;
- qual fator de impacto deve ser aplicado.

## 2. Princípios arquiteturais

O Axion deve seguir esta ordem:

```text
A IA sugere.
A política limita.
A memória orienta.
O usuário confirma.
O evento validado alimenta o aprendizado.
A auditoria explica a decisão.
```

Regras essenciais:

- processo identificado não significa processo contado;
- múltiplos processos exigem revisão humana;
- somente um processo fica pré-selecionado por padrão;
- `A` não pode ser fallback genérico;
- histórico oficial prevalece sobre qualquer inferência;
- correções humanas devem ser registradas como dados de aprendizado;
- o sistema não deve retreinar o modelo automaticamente após cada contagem.

## 3. Fases

### Fase 1 — Correção conservadora e memória estruturada

**Status:** implementada nesta branch.

Entregas:

- quando houver mais de um processo candidato, a análise passa para revisão;
- todos os processos continuam visíveis;
- somente o processo principal fica marcado inicialmente;
- somente processos confirmados entram na contagem;
- fator resolvido por precedência:
  1. histórico oficial;
  2. decisões validadas semelhantes no mesmo projeto;
  3. regras textuais explícitas;
  4. `I — Inclusão` como fallback conservador;
- `A — Alteração` somente com evidência explícita ou precedente validado;
- armazenamento da fonte, confiança e justificativa do fator;
- registro da seleção sugerida versus seleção confirmada;
- visão semanal de acurácia da quantidade de processos.

Critérios de aceite:

- uma análise com três candidatos abre revisão com apenas um marcado;
- confirmar somente o principal gera 4,60 PF bruto, e não 13,80;
- HUs sem evidência de alteração não recebem `A` automaticamente;
- histórico oficial continua prevalecendo;
- a decisão humana fica registrada em `apf_process_learning_events`.

### Fase 2 — Revisão explícita do fator na interface

Entregas propostas:

- seletor de fator na tela de revisão de processos;
- exibição de percentual e PF previsto antes da confirmação;
- fonte do fator: oficial, precedente, regra explícita ou fallback;
- confiança calibrada e justificativa;
- motivo obrigatório quando o usuário alterar o fator;
- gravação de `confirmed_factor_sigla`, usuário e data;
- impedimento de materialização quando fator ou baseline estiverem pendentes.

Critérios de aceite:

- usuário consegue trocar `A → I` antes da materialização;
- PF previsto é recalculado imediatamente;
- toda troca gera evento de validação auditável.

### Fase 3 — Memória de casos para processos

Entregas propostas:

- embeddings específicos para decisões de granularidade;
- recuperação de HUs semelhantes já homologadas;
- comparação entre processos sugeridos e confirmados;
- precedentes por projeto, domínio e organização;
- inclusão dos casos semelhantes no prompt estruturado;
- explicação: “casos semelhantes foram contados como um processo”.

Critérios de aceite:

- o modelo recebe os cinco precedentes mais relevantes;
- decisões de outro projeto não prevalecem sem compatibilidade de domínio;
- casos oficiais possuem maior peso que inferências do modelo.

### Fase 4 — Regras candidatas e governança

Entregas propostas:

- identificação de correções recorrentes;
- geração de regras candidatas, sem ativação automática;
- estados `candidate`, `approved` e `rejected`;
- aprovação por especialista de métricas;
- versionamento e vigência das regras;
- rollback de regra;
- métricas de superfragmentação, subfragmentação e fator.

Exemplo:

```text
Em 18 HUs do projeto GESP, “validar dados” foi removido como processo
independente em 17 decisões homologadas.

Regra candidata: tratar validação de dados como etapa interna, salvo
objetivo de negócio e resultado funcional independentes.
```

### Fase 5 — Especialização do modelo

Somente após volume suficiente de decisões homologadas:

- dataset versionado;
- separação de treino, validação e teste;
- treinamento offline;
- avaliação contra a versão atual;
- publicação controlada;
- monitoramento de regressão;
- rollback imediato.

Fine-tuning não deve substituir regras, baseline, precedentes ou revisão humana.

## 4. Métricas obrigatórias

### Granularidade

- acurácia exata da quantidade de processos;
- erro absoluto médio de processos;
- quantidade de processos removidos pelo usuário;
- quantidade de processos adicionados pelo usuário;
- taxa de superfragmentação;
- taxa de subfragmentação.

### Fator

- acurácia do fator;
- matriz de confusão `A → I`, `I → A`, `E → I` etc.;
- taxa de fallback conservador;
- desempenho por fonte de decisão;
- confiança declarada versus acurácia real.

### PF final

- erro absoluto médio entre Axion e medição homologada;
- taxa de contagem integralmente correta;
- supercontagem e subcontagem por projeto.

## 5. Estratégia de implantação

1. Aplicar migration em ambiente de homologação.
2. Reanalisar um conjunto controlado de HUs já medidas.
3. Comparar resultado antigo, resultado novo e medição oficial.
4. Validar especialmente HUs que anteriormente resultavam em 8,28 e 6,90 PF.
5. Confirmar que somente um processo aparece marcado por padrão.
6. Monitorar `v_apf_process_learning_accuracy`.
7. Publicar em produção somente após aprovação da área de métricas.

## 6. Casos mínimos de regressão

| Cenário | Resultado esperado |
|---|---|
| Três processos candidatos, um principal | Revisão obrigatória; somente o principal marcado |
| Usuário mantém apenas o principal | Um TRN contado |
| Usuário confirma dois independentes | Dois TRNs contados |
| HU sem evidência de alteração | Fator `I`, fonte `conservative_default` |
| HU com “ajustar regra existente” | Fator `A`, fonte `explicit_rule` |
| HU com medição oficial | Fator oficial, confiança 100% |
| Dois precedentes semelhantes validados | Fator do precedente, com fonte e confiança |
| Correção da seleção humana | Evento de aprendizado armazenado |

## 7. Fora do escopo da fase 1

- retreinamento automático da LLM;
- ativação automática de regras aprendidas;
- alteração do peso contratual de 4,60 PF;
- alteração da fórmula de PF Simples;
- rematerialização automática de contagens históricas;
- substituição da decisão da área de métricas por decisão autônoma do modelo.
