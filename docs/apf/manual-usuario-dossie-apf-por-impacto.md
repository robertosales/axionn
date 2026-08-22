# Manual do Usuário — Dossiê APF por Impacto

| Informação | Detalhe |
| --- | --- |
| Produto | Axionn |
| Módulo | Medição & Evidências |
| Funcionalidade | Dossiê APF por Impacto |
| Público | Usuários responsáveis por documentação, evidências, contagem, validação e homologação |
| Versão do manual | 1.0 |
| Atualização | 21/08/2026 |

## 1. Para que serve esta funcionalidade?

O **Dossiê APF por Impacto** reúne, em um único lugar, as informações necessárias para comprovar o impacto funcional de uma História de Usuário (HU).

Ele conecta:

- o que foi solicitado na HU;
- os critérios de aceite;
- as evidências do que foi implementado;
- a contagem de Pontos de Função (PF);
- as decisões tomadas durante a análise;
- os riscos ou interpretações alternativas;
- a versão final validada e homologada.

O resultado é um documento rastreável e auditável. Assim, outra pessoa consegue entender **o que foi contado, por que foi contado e quais evidências sustentam a contagem**.

> O dossiê não substitui a História de Usuário nem executa a implementação. Ele documenta e comprova o impacto funcional da implementação.

## 2. Entenda os termos principais

| Termo | Significado simples |
| --- | --- |
| **HU** | História de Usuário. Descreve uma necessidade que deve ser atendida pelo sistema. |
| **APF** | Análise de Pontos de Função. Método usado para medir o tamanho funcional de uma entrega. |
| **PF** | Ponto de Função. Unidade usada no resultado da medição. |
| **Critério de aceite (CA)** | Condição que precisa ser atendida para considerar a HU correta. |
| **Evidência** | Comprovação do que foi implementado, como commit, Merge Request, arquivo, teste, tela, endpoint ou documento. |
| **Rastreabilidade** | Ligação entre cada critério de aceite e suas evidências. |
| **Sessão de contagem** | Registro que contém o contrato, a baseline, as regras e a contagem APF usada pelo dossiê. |
| **DET, FTR e RET** | Informações técnicas usadas pelo responsável pela contagem para determinar a complexidade de uma função. |
| **Memória de cálculo** | Detalhamento que demonstra como o total de PF foi obtido. |
| **Validar e congelar** | Criar uma versão imutável do conteúdo revisado. |
| **Homologar** | Aprovar formalmente uma versão validada e bloquear seu resultado final. |

Se você não é responsável pela contagem APF, não altere classificações, DET, FTR, RET ou fatores sem orientação do analista de métricas.

## 3. Visão geral do processo

O fluxo recomendado é:

1. Criar o dossiê.
2. Revisar a especificação e os critérios de aceite.
3. Adicionar as evidências da implementação.
4. Vincular evidências aos critérios de aceite.
5. Revisar a contagem e a memória de cálculo.
6. Verificar riscos e pendências na auditoria.
7. Validar e congelar uma versão.
8. Homologar a versão aprovada.
9. Exportar o documento, se necessário.

## 4. Antes de começar

Tenha em mãos:

- o projeto correto;
- a História de Usuário que será analisada;
- a especificação ou descrição funcional;
- os critérios de aceite;
- os links, arquivos ou registros que comprovam a implementação;
- a sessão de contagem APF, quando já existir;
- as justificativas para exceções ou decisões especiais.

Os botões disponíveis podem variar conforme o seu perfil. Se uma ação não aparecer ou ocorrer uma mensagem de falta de permissão, procure o administrador ou o responsável pelo processo.

## 5. Como acessar

1. Entre no Axionn com seu usuário.
2. No menu, acesse **Medição & Evidências**.
3. Selecione a aba **Dossiês APF**.

A tela apresenta:

- **Dossiês ativos**: quantidade de dossiês ainda em andamento;
- **Homologados**: quantidade de dossiês concluídos formalmente;
- **Prontidão global**: indicador geral de preenchimento;
- a lista dos dossiês, com código, status, título, HU, atualização e total de PF impactados;
- o botão **Novo dossiê**.

Para abrir um dossiê existente, localize-o na lista e use a seta exibida no lado direito.

## 6. Criar um dossiê

1. Clique em **Novo dossiê**.
2. Preencha os campos solicitados:

| Campo | Como preencher |
| --- | --- |
| **Projeto** | Selecione o projeto ao qual a HU pertence. |
| **História de Usuário** | Selecione a HU que será comprovada. A lista depende do projeto escolhido. |
| **Sessão de contagem** | Selecione a sessão APF aplicável. Se ela ainda não existir, escolha **Vincular posteriormente**. |
| **Código do dossiê** | Informe um código único e fácil de identificar, por exemplo `APF-HU-063`. |
| **Tipo de contagem** | Selecione o tipo adequado conforme a orientação da área de métricas. |
| **Título** | Use um nome curto que descreva a entrega analisada. |

3. Clique em **Criar dossiê**.

### Tipos de contagem disponíveis

- **Evolutiva por impacto**: mede inclusão, alteração ou exclusão causada por uma evolução. É a opção mais comum neste fluxo.
- **Projeto**: usada para uma medição de projeto conforme as regras do contrato.
- **Corretiva**: usada quando o trabalho é tratado como correção, conforme as regras aplicáveis.
- **Recontagem**: usada para revisar uma contagem anterior.

Em caso de dúvida, confirme o tipo com o analista de métricas antes de continuar.

## 7. Conhecer as etapas do dossiê

Ao abrir o dossiê, você verá sete abas:

| Aba | Finalidade |
| --- | --- |
| **Visão geral** | Resumo do dossiê, situação, tipo de contagem e progresso da revisão. |
| **Especificação** | Cadastro e decisão dos critérios de aceite. |
| **Evidências** | Registro das comprovações da implementação. |
| **Rastreabilidade** | Ligação entre critérios de aceite e evidências. |
| **Contagem** | Revisão dos itens APF e da memória de cálculo. |
| **Auditoria** | Identificação de bloqueios, riscos e interpretações alternativas. |
| **Documento** | Validação, congelamento, homologação e exportação das versões. |

## 8. Etapa 1 — Revisar a Visão geral

Na aba **Visão geral**, confira:

- o código e o título do dossiê;
- a HU vinculada;
- o tipo de contagem;
- o status atual;
- quantos critérios já possuem decisão.

Enquanto o dossiê estiver em **Rascunho**, usuários autorizados podem abrir o menu de ações para:

- editar código, título ou tipo de contagem;
- excluir permanentemente o rascunho.

> Atenção: a exclusão é permanente e remove o rascunho e seus dados associados. Confira o código antes de confirmar.

## 9. Etapa 2 — Preparar a Especificação

Acesse a aba **Especificação**. Cada critério deve representar uma condição verificável da HU.

### Opção A — Importar uma especificação

1. Clique em **Importar especificação**.
2. Selecione um arquivo nos formatos TXT, Markdown, DOCX ou PDF.
3. Aguarde a conversão do conteúdo.
4. Revise todos os critérios extraídos.

Nenhum critério importado é aprovado automaticamente. A pessoa responsável deve conferir o texto e registrar a decisão.

### Opção B — Adicionar um critério manualmente

1. Clique em **Adicionar critério**.
2. Informe um identificador estável, como `CA-01`.
3. Escreva o critério de forma clara e verificável.
4. Selecione a **Decisão funcional**.
5. Registre a justificativa quando necessária.
6. Clique em **Salvar**.

### Como revisar um critério

Para cada item, responda com base na HU e no que foi entregue. Não deixe a decisão como **Pendente** ao finalizar o dossiê.

Uma boa decisão deve permitir que um revisor entenda:

- se a condição foi atendida;
- qual tratamento funcional foi adotado;
- por que esse tratamento foi escolhido;
- quais evidências comprovam a conclusão.

## 10. Etapa 3 — Adicionar Evidências

Acesse a aba **Evidências**.

Uma evidência deve ser objetiva, identificável e, sempre que possível, possuir uma origem permanente.

### Importar evidências do desenvolvimento

1. Clique em **Importar do Git**.
2. Selecione as atividades sincronizadas e vinculadas à HU.
3. Confira repositório, título, origem e link.
4. Clique em **Importar selecionadas**.

O Axionn pode apresentar atividades sincronizadas do GitLab, GitHub ou Azure DevOps, de acordo com as integrações configuradas pela organização.

### Adicionar uma evidência manual

1. Clique em **Adicionar evidência**.
2. Selecione a categoria, como API, código, interface, banco de dados, integração, teste ou documento.
3. Selecione o tipo de fonte.
4. Descreva de maneira curta o que a evidência comprova.
5. Informe uma URL permanente, quando disponível.
6. Preencha a **Justificativa da evidência manual**.
7. Informe o hash ou o commit de origem, quando aplicável.
8. Selecione o estado de verificação correto.
9. Clique em **Salvar evidência**.

Não marque uma evidência como verificada sem ter conferido seu conteúdo e sua relação com a implementação.

### Estados de verificação

| Estado | O que significa |
| --- | --- |
| **unverified** | A evidência foi cadastrada, mas ainda não foi conferida. |
| **verified** | A evidência foi conferida e é válida. |
| **failed** | A conferência falhou ou o conteúdo não comprova o que deveria. |
| **stale** | A evidência ficou desatualizada e precisa ser revista ou substituída. |

### O que caracteriza uma boa evidência?

Uma boa evidência:

- aponta para o item exato, não apenas para a página inicial de uma ferramenta;
- informa o que está sendo comprovado;
- está relacionada à HU e ao critério de aceite;
- pode ser consultada por um revisor autorizado;
- preserva identificação, URL e hash ou commit, quando aplicável;
- continua compreensível sem depender da memória de quem a cadastrou.

Evite descrições vagas como “feito”, “ajustado” ou “testado”. Prefira: “Teste automatizado comprova o bloqueio do envio quando o campo CPF está vazio”.

## 11. Etapa 4 — Fazer a Rastreabilidade

Acesse a aba **Rastreabilidade**.

A tabela mostra:

- o identificador do critério;
- o texto do critério;
- a decisão registrada;
- as evidências vinculadas;
- a situação da cobertura.

Para vincular uma evidência:

1. Volte à aba **Evidências**.
2. Localize a evidência desejada.
3. Clique em **Vincular CA**.
4. Selecione o critério de aceite.
5. Clique em **Vincular**.
6. Retorne à aba **Rastreabilidade** e confira a cobertura.

Cada critério deve possuir uma decisão e pelo menos uma evidência adequada antes da validação.

> Quantidade não substitui qualidade. Uma única evidência precisa pode ser melhor que vários links genéricos.

## 12. Etapa 5 — Revisar a Contagem

Acesse a aba **Contagem**.

Se aparecer **Contagem ainda não vinculada**, será necessário vincular o dossiê a uma sessão de contagem APF antes de concluir o processo.

Quando houver uma sessão vinculada:

1. Confira os itens funcionais identificados.
2. Verifique o tipo e o impacto de cada item.
3. Use **Revisar DET/FTR/RET** para conferir a classificação e a complexidade.
4. Confirme as justificativas e exceções.
5. Compare o total calculado com o total da sessão.

O indicador final deve mostrar **Memória fechada**. Se aparecer **Total divergente**, a soma dos itens não corresponde ao total da sessão e o dossiê não está pronto para validação.

As decisões de contagem devem ser tomadas ou confirmadas por uma pessoa capacitada em APF. Sugestões automáticas servem como apoio e não substituem a decisão humana.

## 13. Etapa 6 — Executar a Auditoria

Acesse a aba **Auditoria**.

### Conferência automatizada

1. Clique em **Executar varredura**.
2. Analise todos os achados apresentados.
3. Clique em **Revisar** em cada achado.
4. Marque-o como **Resolvido** ou **Risco aceito**.
5. Preencha a justificativa obrigatória.
6. Clique em **Salvar decisão**.

Achados críticos podem impedir a validação ou homologação.

### Cenários de auditoria

Use **Novo cenário** quando existir uma interpretação alternativa que precise ficar registrada, por exemplo:

- outra classificação funcional possível;
- possibilidade de separar uma função em duas;
- diferença potencial em PF;
- possível efeito financeiro;
- risco aceito pela equipe responsável.

O cenário registra a alternativa sem alterar silenciosamente a contagem principal. Ele pode ficar **Em aberto**, **Aceito**, **Rejeitado** ou **Mitigado**.

## 14. Etapa 7 — Validar e congelar

Acesse a aba **Documento**.

O checklist informa se o dossiê está pronto. Todos os itens abaixo devem estar atendidos:

- todos os critérios possuem decisão;
- todos os critérios possuem evidência;
- existe pelo menos uma evidência verificada;
- todos os itens contáveis foram validados;
- a memória de cálculo fecha com a sessão;
- contrato, baseline e conjunto de regras estão congelados pela sessão vinculada.

Quando não houver bloqueios:

1. Clique em **Validar e congelar**.
2. Aguarde a criação da versão.
3. Clique em **Prévia** para conferir o documento.
4. Confira código, HU, critérios, evidências, contagem, total e decisões.

A versão recebe um número e um código de integridade SHA-256. Esse código ajuda a comprovar que o conteúdo não foi alterado.

Se o dossiê for ajustado depois da validação e antes da homologação, use **Criar nova versão** para registrar um novo conteúdo congelado.

## 15. Etapa 8 — Homologar

A homologação é a aprovação formal do dossiê.

1. Na lista de **Versões imutáveis**, localize a versão correta.
2. Confira novamente a prévia e o total de PF.
3. Clique em **Homologar**.
4. Leia o aviso de bloqueio definitivo.
5. Confirme somente se a versão estiver correta.

Após a homologação:

- o total e o conteúdo daquela versão ficam bloqueados;
- o dossiê passa a representar o registro oficial;
- correções não devem ser feitas diretamente no original.

Sempre que possível, criação, validação e homologação devem ser realizadas por pessoas diferentes. Essa separação reduz erros e melhora a segurança da aprovação.

## 16. Corrigir um dossiê homologado

Não altere o histórico de um dossiê homologado.

Para corrigir:

1. Abra o dossiê homologado.
2. Acesse **Documento**.
3. Clique em **Criar correção sucessora**.
4. Informe o novo código e o motivo da correção.
5. Revise todo o conteúdo copiado.
6. Verifique novamente as evidências, pois elas retornam como não verificadas.
7. Conclua validação e homologação do sucessor.

O original permanece homologado até que o sucessor também seja homologado. Depois disso, o histórico indica que o dossiê anterior foi substituído.

## 17. Exportar o dossiê

Na aba **Documento**, uma versão pode ser exportada nos formatos:

- **Markdown (.md)**: indicado para documentação e repositórios;
- **DOCX (.docx)**: indicado para leitura, revisão ou envio em formato de documento;
- **JSON (.json)**: indicado para integração, processamento ou auditoria estruturada.

Para exportar:

1. Localize a versão desejada.
2. Clique no formato necessário.
3. Aguarde o download.
4. Confirme se o nome do arquivo contém o código do dossiê e o número da versão.

Se a exportação não estiver disponível, verifique sua permissão com o responsável pelo Axionn.

## 18. Significado dos status do dossiê

| Status | Significado |
| --- | --- |
| **Rascunho** | Dossiê recém-criado e disponível para preparação. |
| **Coletando evidências** | Especificação e evidências estão sendo reunidas. |
| **Em revisão** | Conteúdo está sendo conferido antes da validação. |
| **Validado** | Existe uma versão congelada pronta para decisão formal. |
| **Homologado** | Uma versão foi aprovada e bloqueada como registro oficial. |
| **Substituído** | Um dossiê sucessor homologado passou a representar a correção oficial. |
| **Cancelado** | O processo foi encerrado sem homologação. |

## 19. Problemas comuns

### O botão Criar dossiê não fica disponível

Confira se projeto, HU, código e título foram preenchidos.

### A HU não aparece na lista

Confirme o projeto selecionado. A HU precisa estar vinculada ao projeto e disponível para sua organização.

### Não há atividades para importar do Git

Verifique se a integração está configurada e se as atividades estão vinculadas à HU. Se necessário, cadastre uma evidência manual com origem e justificativa.

### Um critério aparece como pendente

Abra a aba **Especificação**, revise o critério, registre a decisão e salve.

### A cobertura aparece como pendente

Verifique se existe uma evidência vinculada ao critério e se ela foi conferida.

### A evidência está como failed ou stale

Abra a origem, confirme o conteúdo e substitua ou atualize a evidência. Não avance usando uma comprovação inválida ou desatualizada.

### Aparece Total divergente

Revise os itens, fatores e valores da contagem. O total calculado precisa ser igual ao total da sessão.

### Não consigo validar e congelar

Leia o checklist da aba **Documento**. O próprio checklist indica quais requisitos ainda estão bloqueando a ação.

### Não consigo editar um dossiê homologado

Esse é o comportamento esperado. Use **Criar correção sucessora** para preservar o histórico oficial.

### A tela apresentou falha de carregamento

Use **Tentar novamente**. Se o erro persistir, anote o código do dossiê e envie a informação ao suporte ou administrador.

## 20. Checklist rápido do usuário

Antes de solicitar validação, confirme:

- [ ] O projeto e a HU estão corretos.
- [ ] O código e o título identificam claramente a entrega.
- [ ] Todos os critérios foram revisados e possuem decisão.
- [ ] Cada critério possui pelo menos uma evidência adequada.
- [ ] Existe pelo menos uma evidência verificada.
- [ ] Evidências manuais possuem origem e justificativa.
- [ ] A sessão de contagem está vinculada.
- [ ] Todos os itens contáveis foram revisados.
- [ ] A memória de cálculo está fechada.
- [ ] Os achados de auditoria foram tratados.
- [ ] Riscos e exceções possuem justificativa.
- [ ] A prévia da versão apresenta os dados e o total corretos.

Antes de homologar, confirme novamente:

- [ ] Estou homologando a versão correta.
- [ ] O total de PF está correto.
- [ ] As evidências comprovam a implementação.
- [ ] As decisões estão justificadas.
- [ ] Entendo que a homologação bloqueará definitivamente essa versão.

## 21. Boas práticas finais

- Use textos curtos, objetivos e verificáveis.
- Registre a justificativa no momento da decisão.
- Prefira links permanentes e itens identificados por hash ou commit.
- Não aprove critérios ou evidências automaticamente sem revisão humana.
- Trate todos os bloqueios antes de validar.
- Confira a prévia antes de homologar.
- Preserve o dossiê homologado; para correções, crie um sucessor.
- Em caso de dúvida sobre APF, procure o analista de métricas responsável.

---

**Resultado esperado:** ao concluir este fluxo, qualquer revisor autorizado deverá conseguir relacionar a solicitação original, os critérios de aceite, as evidências da implementação, a memória de cálculo e o total de Pontos de Função homologado.
