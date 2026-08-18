# Proposta Final Consolidada

## Módulo de Evidência de Contagem APF por Impacto

**Produto:** Axionn  
**Domínio:** Medição & Evidências / APF  
**Status:** implementado — fases 0 a 4 concluídas em 18/08/2026
**Objetivo:** gerar no Axionn um dossiê auditável equivalente ao documento-modelo da HU 63

## 1. Correção de entendimento

O objeto desta proposta não é implementar no Axionn o alerta de manutenção descrito pela HU 63. O que se pretende implementar é a capacidade que produziu o documento apresentado: um módulo que recebe uma HU e suas evidências, relaciona critérios de aceite a artefatos construídos, determina o impacto APF, calcula os pontos de função, registra decisões e riscos de auditoria e gera o documento final de evidência.

O tema funcional pode ser manutenção, cadastro, integração, relatório ou qualquer outra entrega. O produto do módulo é sempre o dossiê de contagem e rastreabilidade.

## 2. Visão do produto

Criar no hub **Medição & Evidências** um fluxo chamado **Dossiê APF por Impacto**, capaz de:

1. selecionar uma HU, projeto, sprint, contrato e baseline;
2. importar ou coletar evidências de implementação;
3. identificar critérios de aceite e regras funcionais;
4. relacionar cada critério às evidências técnicas;
5. propor processos elementares e arquivos lógicos;
6. classificar impacto como inclusão, alteração, exclusão ou reuso;
7. calcular DET, FTR, RET, complexidade e PF;
8. separar itens contáveis, absorvidos, reutilizados, pendentes e não contáveis;
9. permitir revisão e homologação humana;
10. produzir documento Markdown e DOCX com rastreabilidade completa;
11. congelar a versão homologada e preservar sua memória de cálculo.

## 3. Diagnóstico do Axionn atual

O Axionn já possui uma base relevante:

- modelos de contagem por contrato;
- baseline por projeto;
- catálogo de tipos, pesos, fatores, categorias e regras;
- sessões e itens de contagem;
- análise de processos elementares;
- itens absorvidos e não contáveis;
- arquivos lógicos candidatos;
- revisão humana de processos e fator;
- precedentes e aprendizado;
- templates de saída;
- conversão de Markdown para DOCX.

Entretanto, a capacidade de gerar o documento final não está operacional. A aba **Gerar Doc** informa que está em manutenção. Também não existe hoje uma camada completa para coletar evidências técnicas, rastrear CA × evidência, versionar o dossiê e gerar todas as seções do modelo apresentado.

### Lacuna principal

O Axionn conta PF, mas ainda não transforma automaticamente a contagem e as evidências em um pacote de auditoria equivalente ao documento-modelo.

## 4. Resultado esperado

Para cada HU analisada, o Axionn deverá gerar um documento contendo, no mínimo:

1. identificação da HU e da medição;
2. resumo executivo;
3. regras de medição aplicadas;
4. merge requests, commits e demais evidências;
5. matriz de rastreabilidade CA × evidências;
6. catálogo de evidências de API, código, banco, interface e testes;
7. contagem transacional;
8. detalhamento DET/FTR;
9. contagem de arquivos lógicos;
10. detalhamento DET/RET;
11. matriz de decisão ALI/AIE ou ILF/EIF;
12. quadro executivo da contagem;
13. memória de cálculo;
14. comparação com precontagem ou contagem anterior;
15. arquivos e links de evidência;
16. evidências técnicas complementares sem PF;
17. riscos e cenários alternativos de auditoria;
18. valor consolidado e status de homologação.

## 5. Novo fluxo funcional

### Etapa 1 — Abrir dossiê

O usuário seleciona:

- organização;
- contrato e versão do ruleset/TR;
- projeto;
- sprint ou medição;
- HU;
- baseline vigente;
- tipo de contagem: projeto, evolutiva por impacto, corretiva ou recontagem;
- precontagem ou contagem anterior, quando houver.

Ao abrir o dossiê, o sistema deve congelar um snapshot das referências utilizadas.

### Etapa 2 — Importar a especificação funcional

Fontes previstas:

- HU existente no Axionn;
- GitLab Issue;
- arquivo Markdown, DOCX, PDF ou texto;
- preenchimento manual;
- futuramente Jira, Azure DevOps ou Redmine.

O sistema extrai:

- objetivo da HU;
- atores;
- critérios de aceite;
- regras de negócio;
- objetos funcionais;
- operações solicitadas;
- fronteiras e sistemas envolvidos;
- requisitos não funcionais.

### Etapa 3 — Coletar evidências de implementação

Fontes previstas:

- merge requests;
- commits e diffs;
- arquivos alterados;
- endpoints;
- migrations e tabelas;
- componentes e rotas de interface;
- testes automatizados;
- anexos e evidências manuais;
- links externos.

Cada evidência recebe:

- ID estável, como `EV-API-01` ou `EV-CODE-02`;
- categoria;
- repositório;
- MR/commit;
- caminho do arquivo;
- símbolo, endpoint ou objeto de banco;
- trecho ou resumo verificável;
- URL permanente quando disponível;
- status de verificação;
- data da coleta;
- hash ou commit de origem.

### Etapa 4 — Montar a rastreabilidade

Para cada critério de aceite, o Axionn propõe:

- comportamento esperado;
- comportamento encontrado;
- evidências relacionadas;
- endpoints envolvidos;
- resultado: atende, atende parcialmente, não atende ou não aplicável;
- tratamento APF;
- justificativa;
- pendências e divergências.

O especialista pode corrigir todos os vínculos e deve justificar mudanças materiais.

### Etapa 5 — Classificar funções APF

O motor existente será ampliado para apresentar, por processo ou arquivo:

- tipo: EI/EE, EO/SE, EQ/CE, ILF/ALI, EIF/AIE ou TRN/ARQ conforme ruleset;
- impacto: novo/inclusão, alteração, exclusão ou reuso;
- FTR e DET para transações;
- RET e DET para arquivos lógicos;
- complexidade;
- PF base;
- fator de impacto;
- PF impactado;
- evidências que sustentam a decisão;
- regra contratual aplicada;
- confiança da sugestão;
- decisão humana final.

### Etapa 6 — Revisar exceções

O Axionn deve permitir marcar itens como:

- contado;
- absorvido por outro processo;
- reutilização com 0 PF;
- não contável;
- requisito não funcional;
- pendente de evidência;
- divergência entre HU e implementação;
- risco de auditoria.

### Etapa 7 — Validar e homologar

Estados do dossiê:

- `draft`;
- `collecting_evidence`;
- `under_review`;
- `validated`;
- `homologated`;
- `superseded`;
- `cancelled`.

A homologação deve exigir:

- inexistência de item contável sem evidência;
- inexistência de CA sem decisão;
- memória de cálculo fechando com o total;
- fator e ruleset confirmados;
- justificativa para overrides;
- identificação do responsável;
- snapshot imutável do resultado.

### Etapa 8 — Gerar e exportar

Formatos iniciais:

- Markdown;
- DOCX;
- JSON estruturado para integração;
- PDF em evolução posterior.

O documento deve ser reproduzível a partir do snapshot homologado, sem nova chamada de IA e sem recalcular valores com regras atuais.

## 6. Seções obrigatórias do documento

### 6.1 Cabeçalho da medição

| Campo | Conteúdo |
|---|---|
| HU | Identificador e link |
| Organização | Tenant responsável |
| Contrato/TR | Identidade e versão congeladas |
| Projeto | Projeto medido |
| Sprint/medição | Competência ou ciclo |
| Fronteira | Sistemas e componentes envolvidos |
| Tipo | Tipo da contagem |
| Baseline | Versão utilizada |
| Contagens anteriores | Referências |
| Precontagem | Valor e status não faturável |
| PF impactado | Total calculado |
| PF consolidado | Total homologado |

### 6.2 Merge requests e mudanças

Tabela por repositório contendo MR, papel funcional, commits, status, autor, data e link permanente.

### 6.3 Rastreabilidade CA × evidências

Tabela contendo CA, esperado, construído, evidência funcional, endpoints, IDs de evidância, resultado funcional e tratamento APF.

### 6.4 Catálogo de evidências

Catálogos separados por API, código, interface, banco, integração, teste e documento.

### 6.5 Contagem transacional

Processo, tipo, impacto, complexidade, PF base, fator, PF impactado, FTR, DET, justificativa e evidências.

### 6.6 Arquivos lógicos

Arquivo, tipo, impacto, RET, DET, complexidade, PF base, fator, PF impactado e justificativa.

### 6.7 Matriz ALI/AIE ou ILF/EIF

Reconhecibilidade, manutenção, ciclo de vida, fronteira, uso por transação e decisão.

### 6.8 Memória de cálculo

Linhas individuais, subtotais, fatores, arredondamentos e igualdade obrigatória com o total consolidado.

### 6.9 Riscos de auditoria

Cenários alternativos com efeito financeiro, por exemplo:

- fundir ou separar processos;
- alterar complexidade;
- considerar ou rejeitar arquivo lógico;
- classificar como reuso;
- reconhecer FTR adicional;
- aplicar fator de impacto diferente.

## 7. O que será reaproveitado

| Capacidade atual | Uso no novo módulo |
|---|---|
| `apf_counting_models` | Ruleset associado ao contrato |
| `apf_project_baselines` | Baseline da contagem |
| `apf_baseline_items` | Catálogo funcional homologado |
| `apf_counting_sessions` | Sessão de contagem |
| `apf_counting_items` | Itens e valores calculados |
| `apf_process_analysis_*` | Processos, análogos, arquivos e exceções |
| revisão de fator | Confirmação humana e override |
| biblioteca de conhecimento | Precedentes e explicação |
| templates APF | Estrutura visual do documento |
| `markdownToDocx` | Exportação DOCX |
| GitLab existente | Coleta futura de MRs, commits e diffs |

## 8. Novas entidades recomendadas

### 8.1 `apf_evidence_dossiers`

Identidade do dossiê, HU, projeto, sprint, contrato, baseline, tipo, status, totais, versões e hashes.

### 8.2 `apf_evidence_sources`

Fonte coletada: MR, commit, arquivo, endpoint, tabela, teste, anexo ou link, incluindo proveniência e status de verificação.

### 8.3 `apf_acceptance_criteria`

Critérios extraídos ou cadastrados, com ordem, texto original, origem e identificador estável.

### 8.4 `apf_traceability_links`

Relação entre CA, evidência, processo/arquivo APF, resultado e justificativa.

### 8.5 `apf_evidence_catalog_entries`

IDs documentais estáveis (`EV-API-01`, `EV-CODE-01` etc.) e apresentação consolidada das fontes.

### 8.6 `apf_audit_scenarios`

Riscos, classificação alternativa, justificativa e efeito em PF.

### 8.7 `apf_dossier_versions`

Snapshots imutáveis de dados, regras, prompt, evidências, decisões, documento renderizado e hash.

### 8.8 `apf_dossier_events`

Trilha de criação, coleta, revisão, alteração, validação, homologação, exportação e substituição.

## 9. Requisitos de rastreabilidade e auditoria

- Toda afirmação do documento deve apontar para dado persistido ou evidência identificada.
- Evidência automática deve informar repositório e commit.
- Evidência manual deve informar autor, data e justificativa.
- Conteúdo coletado deve ter hash para detectar alteração posterior.
- Sugestão da IA e decisão humana devem permanecer separadas.
- Overrides devem exigir motivo.
- Dossiê homologado não pode ser atualizado in-place.
- Correção posterior deve criar nova versão e marcar a anterior como substituída.
- Visualizar ou exportar documento homologado não deve recalcular PF.
- O documento deve informar itens não verificados e lacunas de evidência.
- Links privados não devem ser tratados como verificados sem coleta autenticada bem-sucedida.

## 10. Papel da inteligência artificial

A IA poderá:

- extrair CA e regras da HU;
- resumir MRs e diffs;
- sugerir ligações CA × evidência;
- identificar processos e arquivos candidatos;
- sugerir DET, FTR e RET;
- apontar reutilização, absorção e itens não contáveis;
- redigir justificativas e resumo executivo;
- propor riscos de auditoria.

A IA não poderá:

- homologar o dossiê;
- inventar evidência ausente;
- alterar fórmulas contratuais;
- substituir o cálculo determinístico;
- marcar link inacessível como verificado;
- recalcular documento homologado com ruleset novo;
- ativar automaticamente uma regra aprendida.

## 11. Interface proposta

Substituir a aba **Gerar Doc** por um workspace operacional com:

1. **Visão geral:** identidade, status, progresso e pendências;
2. **Especificação:** HU, CA, regras e fronteira;
3. **Evidências:** MRs, commits, arquivos, endpoints, banco e testes;
4. **Rastreabilidade:** matriz editável CA × evidância;
5. **Contagem:** TRN/ARQ, DET/FTR/RET, complexidade e impacto;
6. **Auditoria:** riscos, cenários alternativos e divergências;
7. **Documento:** prévia, validação, versão e exportação.

Indicadores de completude:

- CA com evidência;
- itens APF com justificativa;
- evidências verificadas;
- pendências;
- consistência da memória de cálculo;
- prontidão para homologação.

## 12. Perfis e permissões

Capacidades sugeridas:

- `apf.dossier.view`;
- `apf.dossier.create`;
- `apf.dossier.collect_evidence`;
- `apf.dossier.review`;
- `apf.dossier.validate`;
- `apf.dossier.homologate`;
- `apf.dossier.export`;
- `apf.dossier.manage_templates`.

Criação, revisão e homologação devem ser separáveis por perfil. O acesso deve respeitar organização, contrato, projeto e time.

## 13. Critérios de aceite do MVP

1. Usuário cria um dossiê para uma HU existente.
2. O sistema importa o texto e separa os critérios de aceite.
3. Evidências podem ser cadastradas manualmente e importadas do GitLab configurado.
4. Cada evidência recebe ID estável e proveniência.
5. O sistema sugere vínculos entre CA e evidências.
6. O especialista confirma ou corrige os vínculos.
7. A contagem existente é associada ao dossiê sem duplicar o motor.
8. Processos, arquivos, itens absorvidos e itens sem PF aparecem no documento.
9. DET/FTR/RET e complexidade podem ser revisados.
10. A memória de cálculo fecha exatamente com o total.
11. O sistema registra riscos de auditoria e efeito alternativo em PF.
12. Nenhum item sem evidência pode ser homologado como comprovado.
13. O usuário visualiza uma prévia do documento.
14. O Axionn exporta Markdown e DOCX equivalentes ao modelo.
15. A homologação cria snapshot imutável e hash.
16. Reexportar a versão homologada produz o mesmo conteúdo e total.
17. Uma correção posterior cria nova versão, preservando a anterior.
18. RLS impede acesso cross-tenant e homologação sem permissão.

## 14. Fases de implementação

### Fase 0 — Fundação contratual e snapshot

- fechar identidade de contrato/TR/ruleset;
- versionar regras e catálogos;
- congelar contrato, baseline, fatores e pesos por dossiê;
- eliminar dependência de configuração mutável para reexportação.

Essa fase é obrigatória porque hoje o motor não possui snapshot contratual completo por contagem.

### Fase 1 — Dossiê e evidência manual

- entidades do dossiê;
- seleção de HU e contagem;
- extração/revisão de CA;
- cadastro de evidências;
- matriz de rastreabilidade;
- montagem determinística das tabelas APF;
- prévia Markdown;
- exportação Markdown e DOCX;
- validação e snapshot.

### Fase 2 — Coleta GitLab

- selecionar MRs e commits;
- coletar metadados e diffs;
- indexar arquivos, endpoints, migrations e testes;
- gerar catálogo de evidências;
- links permanentes e hash de commit;
- sugestão de rastreabilidade pela IA.

### Fase 3 — Auditoria APF assistida

- conferência automatizada de DET/FTR/RET;
- matriz ALI/AIE;
- detecção de reuso e absorção;
- cenários alternativos;
- lacunas e contradições HU × código;
- qualidade e confiança da evidência.

### Fase 4 — Integrações e consolidação

- GitHub, Jira, Azure DevOps e Redmine;
- medição consolidada por sprint/competência;
- workflow de glosa, aprovação e faturamento;
- assinatura ou aprovação formal;
- pacote de auditoria em PDF/ZIP;
- dashboards de divergência e acurácia.

## 15. Riscos principais

| Risco | Tratamento |
|---|---|
| IA inventar evidência | Exigir proveniência, status e revisão humana |
| Link mudar depois da homologação | Persistir commit, hash e snapshot permitido |
| Recontagem mudar com ruleset atual | Versionar e congelar ruleset |
| Dois motores produzirem resultados diferentes | Adotar o motor contratual baseline-first como autoridade |
| CA extraído incorretamente | Manter texto original e revisão humana |
| Contagem fechar sem evidência suficiente | Bloquear homologação ou marcar explicitamente como não verificada |
| Vazamento cross-tenant | RLS, RPCs com checks internos e testes de isolamento |
| Documento depender de nova IA | Renderização determinística do snapshot |
| Evidência privada indisponível ao auditor | Informar status e permitir anexo/snapshot autorizado |

## 16. Benefícios

### Operacionais

- elimina montagem manual repetitiva do documento;
- reduz tempo de fechamento da medição;
- padroniza evidências entre projetos e equipes;
- centraliza HU, implementação, contagem e justificativa.

### Financeiros e contratuais

- aumenta a defensabilidade da cobrança;
- reduz risco de glosa;
- evidencia alterações, reuso e itens sem PF;
- preserva a regra contratual aplicada no momento da contagem;
- permite simular impacto de interpretações alternativas.

### Qualidade e governança

- liga cada critério ao que foi construído;
- identifica requisito atendido parcialmente;
- diferencia sugestão de IA de decisão homologada;
- cria trilha auditável e reprodutível;
- alimenta aprendizado com decisões humanas validadas.

## 17. Indicadores de sucesso

- tempo médio para produzir um dossiê;
- percentual de CA com evidência verificada;
- percentual de itens APF com rastreabilidade completa;
- quantidade de correções humanas por tipo;
- divergência entre precontagem e contagem homologada;
- divergência entre sugestão da IA e decisão humana;
- taxa de glosa por falta de evidência;
- reprodutibilidade de documentos homologados;
- quantidade de links ou fontes indisponíveis;
- acurácia de DET/FTR/RET sugeridos.

## 18. Decisão recomendada

**Aprovar o desenvolvimento do Módulo de Evidência de Contagem APF por Impacto.**

A implementação deve aproveitar o motor APF existente e restaurar a capacidade de geração documental, sem criar um segundo motor de contagem. A prioridade inicial deve ser:

1. snapshot contratual e versionamento;
2. dossiê por HU;
3. critérios de aceite;
4. catálogo de evidências;
5. rastreabilidade CA × evidência;
6. documento determinístico em Markdown e DOCX;
7. coleta automatizada do GitLab na fase seguinte.

O resultado esperado é que o Axionn passe a gerar, revisar, homologar e reproduzir documentos equivalentes ao modelo apresentado, independentemente do tema da HU, com evidência verificável, memória de cálculo e governança suficientes para auditoria e cobrança.

## 19. Fechamento da implementação

### 19.1 Situação das fases

| Fase | Situação | Entregas verificadas |
|---|---|---|
| Fase 0 — Fundação contratual e snapshot | Concluída | Snapshot de contrato, baseline e ruleset; versões imutáveis e hash |
| Fase 1 — Dossiê e evidência manual | Concluída | Workspace, CA, catálogo, rastreabilidade, contagem, prévia, Markdown, DOCX, validação e homologação |
| Fase 2 — Coleta GitLab | Concluída | MRs, commits, artefatos técnicos, catálogo, links permanentes e sugestões revisáveis |
| Fase 3 — Auditoria APF assistida | Concluída | DET/FTR/RET, matriz ALI/AIE, exceções, reúso, absorção, achados, contradições e qualidade |
| Fase 4 — Integrações e consolidação | Concluída | GitHub, Jira, Azure DevOps, Redmine, lotes por competência, glosa, aprovação formal, faturamento, PDF/ZIP e indicadores |

### 19.2 Critérios do MVP

Os 18 critérios de aceite da seção 13 possuem implementação correspondente. A reexportação usa o snapshot homologado; a correção cria sucessor; homologação e coleta respeitam imutabilidade; todos os novos acessos são delimitados por organização e protegidos por RLS ou RPC com verificação interna.

O pacote ZIP contém o manifesto JSON estruturado, documentos homologados, hashes, versões e trilha de decisões. O PDF consolida a medição e a auditoria sem recalcular o resultado homologado.

### 19.3 Dependências operacionais

O código do módulo está concluído, mas a coleta depende da configuração dos serviços externos:

- GitLab, GitHub e Azure DevOps precisam de `git_integrations` ativa, sincronização e vínculo da atividade com a HU;
- Redmine precisa de integração ativa e `redmine_issue_links` sincronizado;
- o conector Jira deve alimentar `upsert_apf_jira_issue_link` usando `service_role` antes da importação pelo usuário;
- documentos e faturamento dependem das migrations desta proposta estarem aplicadas na ordem cronológica;
- evidência proveniente de conectores externos permanece não verificada até decisão humana, exceto atividade Git já coletada pelo fluxo autenticado existente.

### 19.4 Evidência técnica de conclusão

A implementação está registrada na sequência de migrations `20260817120000` a `20260818190000`, acompanhada por testes de contrato para fundação, snapshot, homologação, correção, conectores, auditoria, métricas, consolidação, faturamento e governança.
