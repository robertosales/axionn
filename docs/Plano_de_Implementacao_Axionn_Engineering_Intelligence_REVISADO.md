# Plano de Implementação: Evolução do Axionn para Engineering Intelligence

**Autor:** Manus AI
**Data:** 09 de Julho de 2026

## 1. Visão Geral e Objetivos

Este documento detalha o plano de implementação para a evolução do Axionn, transformando-o de uma plataforma de gestão ágil com IA embutida para uma solução de **Engineering Intelligence**. O foco principal será na integração profunda com sistemas de controle de versão (Git), na automação das Métricas DORA (DevOps Research and Assessment) e na implementação de um sistema de predição de risco de sprint baseado em inteligência artificial. O objetivo é fornecer aos times de desenvolvimento e lideranças insights preditivos e acionáveis, automatizar a coleta de métricas de desempenho e otimizar o fluxo de trabalho do desenvolvimento de software.

### Objetivos Específicos:

*   **Aumentar a Visibilidade:** Oferecer uma visão unificada do ciclo de vida do desenvolvimento, desde a concepção da User Story (HU) até a entrega em produção.
*   **Otimizar a Tomada de Decisão:** Fornecer dados e predições para que Product Owners, Scrum Masters e Engenheiros possam tomar decisões mais informadas e proativas.
*   **Melhorar a Produtividade e Qualidade:** Identificar gargalos, prever riscos e automatizar tarefas repetitivas para liberar o tempo do time para focar em inovação e qualidade.
*   **Fortalecer a Governança:** Garantir rastreabilidade e auditoria das entregas, vinculando diretamente o trabalho ágil ao código-fonte.
*   **Consolidar Integrações Corporativas:** Integrar o Axionn com GitLab, Microsoft Teams, 3Scale, Redmine, Keycloak, Oracle Database e Oracle APEX, garantindo interoperabilidade com o ecossistema corporativo.
*   **Medir Uso e Adoção:** Coletar logs de uso dos usuários e eventos das integrações para alimentar relatórios de adoção, auditoria, produtividade e governança.

## 2. Pilar 1: Integração Profunda com Git (GitHub/GitLab)

Esta integração permitirá que o Axionn "entenda" o que está acontecendo no repositório de código, correlacionando atividades de desenvolvimento com as User Stories (HUs) e Sprints.

### 2.1 Regras de Negócio

*   **Vinculação Bidirecional:** HUs no Axionn devem ser vinculadas a branches, commits e Pull Requests (PRs) no Git. Alterações no status da HU podem refletir no Git (ex: fechar HU ao mergear PR) e vice-versa (ex: PR aberto atualiza status da HU).
*   **Rastreabilidade:** Cada commit e PR deve ser rastreável até a HU correspondente no Axionn.
*   **Configuração Flexível:** Permitir a configuração de múltiplos provedores Git (GitHub, GitLab, Bitbucket) por organização/projeto.
*   **Segurança:** Credenciais de acesso ao Git devem ser armazenadas de forma segura e criptografada, seguindo o modelo já existente para provedores de IA.

### 2.2 Detalhes Técnicos

*   **Mecanismo de Integração:** Utilizar Webhooks (para eventos em tempo real) e APIs REST (para sincronização inicial e consultas sob demanda) dos provedores Git.
    *   **Webhooks:** Configurar webhooks para eventos como `push`, `pull_request` (abertura, atualização, merge, fechamento), `commit_comment`.
    *   **APIs:** Utilizar APIs para buscar detalhes de repositórios, branches, commits, PRs e usuários.
*   **Mapeamento de Entidades:**
    *   **HU <> Branch/PR:** Desenvolvedores devem incluir o ID da HU no nome da branch (ex: `feature/AXIONN-123-nova-funcionalidade`) ou no título/descrição do PR. O Axionn fará o parse e a vinculação.
    *   **Usuário Axionn <> Usuário Git:** Mapear usuários do Axionn para usuários do Git (via e-mail ou ID de usuário configurável) para atribuir atividades de código às pessoas certas.
*   **Armazenamento de Dados:**
    *   **`git_integrations` (tabela):** Armazenar configurações de integração por projeto (provedor, URL base, token de acesso criptografado, ID do repositório).
    *   **`git_events` (tabela):** Registrar eventos brutos recebidos dos webhooks para auditoria e processamento assíncrono.
    *   **`hu_git_links` (tabela):** Tabela de relacionamento entre HUs e entidades Git (branches, PRs, commits).
*   **Edge Functions/Workers:** Utilizar Edge Functions ou workers assíncronos para processar eventos de webhook, evitando sobrecarga no backend principal e garantindo resiliência.

### 2.3 Casos de Uso

*   **Visualização do Progresso:** Na tela da HU, mostrar os PRs abertos, commits relacionados e o status do pipeline CI/CD.
*   **Automação de Status:** Quando um PR é aberto, a HU associada pode mudar para "Em Desenvolvimento". Quando o PR é mergeado, a HU pode ir para "Em Homologação" ou "Concluída".
*   **Análise de Código:** A IA pode analisar o código do PR para identificar potenciais problemas de qualidade, complexidade ou aderência aos requisitos da HU.


### 2.4 Escopo Específico para GitLab

Embora o plano já contemple GitLab dentro do pilar de integração Git, a implementação deve tratá-lo como provedor de primeira classe, especialmente em ambientes corporativos que usam GitLab como repositório, controle de merge requests e esteira CI/CD.

#### Regras de Negócio

*   **Merge Requests como entidade principal:** No GitLab, a vinculação deve considerar `merge_request` como equivalente operacional ao PR.
*   **Pipeline e Deploy:** Eventos de pipeline, jobs, environments e deployments devem ser coletados para alimentar Métricas DORA e rastreabilidade da HU.
*   **Namespaces, grupos e projetos:** A integração deve suportar estrutura hierárquica do GitLab, incluindo grupos, subgrupos e múltiplos projetos por organização.
*   **Usuários e permissões:** O mapeamento entre usuário Axionn e usuário GitLab deve respeitar permissões de projeto, grupo e role.

#### Detalhes Técnicos

*   **Webhooks GitLab:** Capturar eventos de `push`, `merge_request`, `pipeline`, `job`, `deployment`, `release` e `note`.
*   **APIs GitLab:** Consultar projetos, branches, commits, MRs, pipelines, environments, approvals e usuários.
*   **Tabelas adicionais:**
    *   **`gitlab_pipeline_events`:** eventos de pipeline/job com status, duração, branch, commit e environment.
    *   **`gitlab_deployment_events`:** eventos de deploy vinculados a commit/MR/HU.
    *   **`gitlab_user_mappings`:** vínculo entre usuário Axionn, e-mail corporativo e usuário GitLab.
*   **Métricas derivadas:** tempo de revisão de MR, tempo de pipeline, taxa de falha de pipeline, tempo de espera por aprovação e deploys por ambiente.

#### Casos de Uso

*   Mostrar na HU o status do MR e do pipeline GitLab.
*   Alertar no Teams quando uma MR ficar parada aguardando revisão.
*   Usar eventos de deployment do GitLab para calcular Deployment Frequency e Lead Time for Changes.

## 3. Pilar 2: Métricas DORA Automatizadas

As Métricas DORA são indicadores chave de desempenho para times de desenvolvimento de software, correlacionando-se diretamente com a performance organizacional. Automatizá-las no Axionn fornecerá insights valiosos sobre a saúde do processo de entrega.

### 3.1 Regras de Negócio

*   **Definição das Métricas DORA:**
    *   **Deployment Frequency (Frequência de Deploy):** Quantidade de deploys em produção por período (dia, semana, mês).
    *   **Lead Time for Changes (Tempo de Lead para Mudanças):** Tempo desde o primeiro commit até o deploy em produção.
    *   **Change Failure Rate (Taxa de Falha de Mudança):** Percentual de deploys que resultam em falha (rollback, bug crítico em produção).
    *   **Time to Restore Service (Tempo para Restaurar o Serviço):** Tempo para restaurar o serviço após uma falha em produção.
*   **Configuração por Projeto:** Permitir que cada projeto configure como os eventos de deploy e falha são identificados (ex: tag de release, webhook de CI/CD, status de monitoramento).
*   **Visualização:** Apresentar as métricas em dashboards claros, com tendências históricas e benchmarks (se disponível).

### 3.2 Detalhes Técnicos

*   **Coleta de Dados:**
    *   **Deployment Frequency & Lead Time:** Integrar com ferramentas de CI/CD (Jenkins, GitLab CI, GitHub Actions, CircleCI) via webhooks ou APIs para capturar eventos de deploy em produção e o timestamp do commit inicial.
    *   **Change Failure Rate & Time to Restore Service:** Integrar com ferramentas de monitoramento (Datadog, New Relic, Sentry) ou sistemas de tickets (Jira, Zendesk) para identificar falhas em produção e o tempo de resolução.
*   **Cálculo e Armazenamento:**
    *   **`dora_metrics_snapshots` (tabela):** Armazenar os valores calculados das métricas DORA diariamente ou semanalmente por projeto.
    *   **`deployment_events` (tabela):** Registrar cada deploy em produção (timestamp, commit_hash, status).
    *   **`incident_events` (tabela):** Registrar incidentes em produção (timestamp_inicio, timestamp_fim, deploy_relacionado, impacto).
*   **Engine de Cálculo:** Um serviço de backend (worker) que roda periodicamente para agregar os eventos de deploy e incidente, calcular as métricas DORA e armazenar os snapshots.

### 3.3 Casos de Uso

*   **Dashboard de Liderança:** Um painel para VPs de Engenharia e CTOs acompanharem a performance dos times e a saúde do processo de entrega.
*   **Identificação de Gargalos:** Se o Lead Time for alto, o time pode investigar onde está o atraso (desenvolvimento, revisão de código, deploy).
*   **Melhoria Contínua:** Usar as métricas para validar a eficácia de novas práticas de engenharia ou mudanças no processo.

## 4. Pilar 3: Predição de Risco de Sprint com IA

Este pilar visa prever, com base em dados históricos e em tempo real, a probabilidade de uma HU ou sprint não ser concluída no prazo, permitindo intervenções proativas.

### 4.1 Regras de Negócio

*   **Gatilhos de Risco:** A IA deve ser acionada para reavaliar o risco em eventos chave (ex: nova HU adicionada, impedimento registrado, mudança de status de HU, atraso em PR).
*   **Níveis de Risco:** Definir níveis de risco (Baixo, Médio, Alto, Crítico) com limiares configuráveis.
*   **Justificativa da Predição:** A IA deve fornecer uma justificativa clara para a predição de risco (ex: "HU com alta complexidade e sem atividade de código", "Time com histórico de atrasos em HUs similares").
*   **Feedback Loop:** O sistema deve aprender com as predições corretas e incorretas, ajustando o modelo ao longo do tempo.

### 4.2 Detalhes Técnicos

*   **Fontes de Dados para o Modelo de IA:**
    *   **Dados Históricos do Axionn:** Velocidade do time, throughput, lead time, histórico de impedimentos, dados de Planning Poker, precisão de estimativas de PF.
    *   **Dados da Integração Git:** Volume de commits, tempo de abertura/revisão de PRs, complexidade do código (via ferramentas de análise estática).
    *   **Dados da HU:** Descrição da HU, PF estimados, dependências, complexidade semântica (já extraída pelo AI Counting Brain).
*   **Modelo de IA:**
    *   **Treinamento:** Utilizar um modelo de Machine Learning (ex: Random Forest, Gradient Boosting, ou até mesmo um LLM fine-tuned para classificação) treinado com dados históricos de sprints (HUs concluídas vs. não concluídas, no prazo vs. atrasadas).
    *   **Features:** As features de entrada para o modelo incluiriam: PF da HU, complexidade semântica, número de impedimentos relacionados, tempo médio de resolução de impedimentos do time, número de PRs abertos para a HU, tempo médio de revisão de PRs, etc.
    *   **Saída:** Probabilidade de atraso ou não conclusão da HU/sprint.
*   **Arquitetura:**
    *   **`risk_prediction_service` (microserviço/worker):** Um serviço dedicado para rodar o modelo de predição de risco. Pode ser uma Edge Function mais robusta ou um serviço separado.
    *   **`sprint_risk_events` (tabela):** Armazenar as predições de risco geradas, com timestamp, HU/sprint, nível de risco, probabilidade e justificativa.
*   **Interface de Usuário:** Exibir o nível de risco diretamente nas telas de Sprint, Backlog e na visualização da HU, com alertas visuais e a justificativa da IA.

### 4.3 Casos de Uso

*   **Alertas Proativos:** Notificar o Scrum Master e o PO quando uma HU ou sprint atingir um nível de risco "Alto" ou "Crítico".
*   **Priorização Dinâmica:** Ajudar o time a re-priorizar tarefas ou alocar mais recursos para HUs de alto risco.
*   **Melhoria Contínua do Processo:** Analisar as predições de risco ao longo do tempo para identificar padrões e ajustar o processo ágil.

## 5. Pilar 4: Integração com Ecossistema Microsoft (Teams & Copilot)

Integrar o Axionn com o Microsoft Teams e o Microsoft 365 Copilot é uma estratégia fundamental para alcançar o mercado Enterprise, onde essas ferramentas são amplamente adotadas. Isso permitirá que os usuários interajam com o Axionn diretamente de seus ambientes de trabalho diários, aumentando a produtividade e a adoção.

### 5.1 Regras de Negócio

*   **Notificações Contextuais no Teams:** O Axionn deve enviar notificações inteligentes e acionáveis para canais do Teams ou chats individuais, baseadas em eventos críticos (ex: HU em risco, PR aguardando revisão, impedimento crítico).
*   **Comandos no Teams:** Usuários devem ser capazes de interagir com o Axionn via comandos de chat no Teams (ex: `/axionn status HU-123`, `/axionn criar impedimento`).
*   **Plugin para Copilot:** O Axionn deve expor suas funcionalidades como um plugin para o Microsoft 365 Copilot, permitindo que os usuários façam perguntas em linguagem natural e recebam respostas do Axionn (ex: "Copilot, qual o status da HU-456 no Axionn?").
*   **Segurança e Autenticação:** A integração deve respeitar os padrões de segurança da Microsoft, utilizando OAuth 2.0 e garantindo que apenas usuários autorizados possam acessar dados do Axionn via Teams/Copilot.
*   **Configuração Centralizada:** A configuração da integração (quais canais receberão notificações, quais funcionalidades estarão disponíveis no Copilot) deve ser gerenciável no backoffice do Axionn.

### 5.2 Detalhes Técnicos

*   **Integração com Microsoft Teams:**
    *   **Aplicativo Teams:** Desenvolver um aplicativo para o Microsoft Teams que inclua:
        *   **Bots de Notificação:** Utilizar o Microsoft Bot Framework para criar um bot que envie mensagens adaptativas (Adaptive Cards) para canais ou chats.
        *   **Extensões de Mensagem:** Permitir que usuários busquem e compartilhem informações do Axionn diretamente de dentro de uma conversa no Teams.
        *   **Comandos de Mensagem:** Implementar comandos de barra (`/`) para que os usuários possam consultar ou atualizar informações do Axionn.
    *   **OAuth 2.0:** Implementar o fluxo de autenticação OAuth 2.0 para que os usuários possam conectar suas contas do Axionn com o Teams de forma segura.
*   **Integração com Microsoft 365 Copilot:**
    *   **Microsoft Graph Connectors:** Utilizar os Microsoft Graph Connectors para indexar dados do Axionn no Microsoft Graph, tornando-os pesquisáveis e acessíveis pelo Copilot.
    *   **Plugins para Copilot:** Desenvolver um plugin para o Copilot que exponha APIs do Axionn. Isso permitirá que o Copilot, ao receber uma pergunta do usuário, chame a API do Axionn para obter a informação relevante.
    *   **APIs do Axionn:** Garantir que as APIs do Axionn sejam bem documentadas, seguras e otimizadas para consultas em linguagem natural.
*   **Armazenamento de Dados:**
    *   **`teams_integrations` (tabela):** Armazenar configurações de integração do Teams por projeto/organização (ID do tenant, IDs de canais, tokens de acesso).
    *   **`copilot_plugins` (tabela):** Armazenar configurações do plugin do Copilot (endpoints de API, esquema de autenticação).
*   **Edge Functions/Workers:** Utilizar Edge Functions ou workers para processar requisições do Teams/Copilot e interagir com o backend do Axionn, garantindo baixa latência e escalabilidade.

### 5.3 Casos de Uso

*   **Alertas Proativos no Teams:** Receber notificações no canal do time sobre HUs atrasadas, impedimentos críticos ou PRs aguardando revisão.
*   **Consulta Rápida via Copilot:** Perguntar ao Copilot: "Qual o status da sprint atual no Axionn?" ou "Me mostre as HUs atribuídas ao João no Axionn".
*   **Criação de Itens no Teams:** Criar um novo impedimento ou uma nova HU diretamente de um chat do Teams usando um comando de barra.
*   **Resumos de Reunião:** O Copilot pode gerar resumos de reuniões do Teams e, se configurado, incluir automaticamente o status de HUs relevantes do Axionn.


### 5.4 Complemento: Logs de Interação via Teams

A integração com Teams também deve gerar eventos de uso para o relatório de adoção e auditoria.

#### Eventos a registrar

*   Comando executado pelo usuário (`/axionn status`, `/axionn criar impedimento`, consultas de HU, consultas de sprint).
*   Canal ou chat de origem, quando permitido pelas políticas da organização.
*   Data/hora da interação.
*   Usuário Axionn associado ao usuário Microsoft.
*   Tipo de resposta: sucesso, erro, permissão negada ou dado não encontrado.
*   Ação decorrente: criação de impedimento, atualização de status, consulta de relatório ou abertura de card.

#### Uso no relatório

*   Medir adoção da integração com Teams por time/projeto.
*   Identificar comandos mais usados e pontos de atrito.
*   Auditar ações feitas fora da interface web do Axionn.

## 6. Pilar 5: Integrações Corporativas — 3Scale, Redmine, Keycloak, Oracle e Oracle APEX

Este pilar complementa a visão de Engineering Intelligence conectando o Axionn ao ecossistema corporativo de identidade, APIs, sistemas legados, banco de dados, aplicações internas e gestão de demandas.

### 6.1 Integração com 3Scale

O 3Scale deve ser usado como camada de gestão, exposição, governança e observabilidade das APIs do Axionn, especialmente quando a solução precisar ser consumida por sistemas externos.

#### Regras de Negócio

*   **Governança de APIs:** APIs do Axionn expostas para consumo externo devem passar pelo 3Scale quando houver exigência de controle centralizado.
*   **Controle de consumo:** Definir planos de acesso por aplicação, projeto, organização ou cliente.
*   **Rate limiting e quotas:** Aplicar limites de chamadas por usuário, sistema consumidor e endpoint crítico.
*   **Auditoria de consumo:** Registrar chamadas relevantes para relatórios de uso, segurança e capacidade.
*   **Versionamento de APIs:** Manter contratos estáveis e versionados para integrações com sistemas legados e aplicações internas.

#### Detalhes Técnicos

*   Publicar APIs REST/GraphQL do Axionn no 3Scale.
*   Configurar autenticação via OAuth2/OIDC integrada ao Keycloak.
*   Habilitar métricas de consumo por endpoint, aplicação, tenant e usuário técnico.
*   Criar políticas para rate limit, circuit breaker, headers obrigatórios, correlation ID e logging.
*   Tabelas sugeridas:
    *   **`api_gateway_applications`:** aplicações consumidoras cadastradas.
    *   **`api_gateway_usage_events`:** eventos agregados de consumo por endpoint.
    *   **`api_contract_versions`:** versões publicadas dos contratos de API.

#### Casos de Uso

*   Expor API de consulta de status de HU para portais internos.
*   Permitir que sistemas externos consultem métricas DORA consolidadas.
*   Controlar consumo das APIs por time, aplicação e ambiente.

### 6.2 Integração com Redmine

O Redmine deve ser considerado como fonte ou destino de demandas, issues, bugs, tarefas técnicas e histórico operacional, conforme o processo de cada organização.

#### Regras de Negócio

*   **Sincronização de issues:** Issues do Redmine podem gerar ou atualizar HUs, bugs, impedimentos ou tarefas no Axionn.
*   **Rastreabilidade:** Cada item sincronizado deve manter o vínculo entre Redmine e Axionn.
*   **Mapeamento flexível:** Status, tipos de issue, prioridades, projetos e usuários devem ser configuráveis por organização.
*   **Evitar duplicidade:** O Axionn deve impedir criação duplicada de HUs ou bugs quando a issue já estiver sincronizada.
*   **Sincronização bidirecional opcional:** A organização poderá escolher se o Axionn apenas lê dados do Redmine ou também atualiza status/comentários no Redmine.

#### Detalhes Técnicos

*   Usar API REST do Redmine para consultar projetos, issues, usuários, status e journals.
*   Implementar job incremental por `updated_on` para sincronização periódica.
*   Quando disponível, usar webhooks/plugins do Redmine para eventos em tempo quase real.
*   Tabelas sugeridas:
    *   **`redmine_integrations`:** configuração por organização/projeto.
    *   **`redmine_issue_links`:** vínculo entre issue Redmine e entidade Axionn.
    *   **`redmine_sync_events`:** histórico de sincronização, erros e payloads relevantes.
*   Mapear campos principais: `issue_id`, `project_id`, `tracker`, `status`, `priority`, `assigned_to`, `author`, `estimated_hours`, `spent_hours`, `created_on`, `updated_on`.

#### Casos de Uso

*   Importar bugs do Redmine como impedimentos de sprint.
*   Vincular uma issue Redmine a uma HU Axionn.
*   Usar tempo gasto e prioridade do Redmine como feature para predição de risco.

### 6.3 Integração com Keycloak

O Keycloak deve ser usado como provedor central de identidade, autenticação, autorização e federação de usuários.

#### Regras de Negócio

*   **SSO corporativo:** Usuários devem acessar o Axionn com autenticação centralizada via Keycloak.
*   **RBAC/ABAC:** Perfis, papéis e grupos do Keycloak devem ser usados para controlar permissões no Axionn.
*   **Provisionamento:** Usuários e grupos podem ser sincronizados automaticamente para reduzir cadastro manual.
*   **Auditoria de acesso:** Eventos de login, logout, falha de autenticação e troca de token devem alimentar os relatórios de segurança e uso.
*   **Multitenancy:** Realms, clients e grupos devem suportar separação por organização, tenant ou unidade de negócio.

#### Detalhes Técnicos

*   Implementar OIDC/OAuth2 com Keycloak como Identity Provider.
*   Mapear claims do token para permissões internas do Axionn.
*   Criar clients específicos para Web App, API, Teams Bot, Copilot Plugin, 3Scale e integrações técnicas.
*   Tabelas sugeridas:
    *   **`identity_providers`:** configuração do provedor de identidade.
    *   **`keycloak_user_mappings`:** vínculo entre usuário Axionn e usuário Keycloak.
    *   **`auth_audit_events`:** eventos de autenticação e autorização.
*   Validar tokens em APIs internas e externas, preferencialmente com introspection/JWKS e cache seguro.

#### Casos de Uso

*   Login único no Axionn usando credenciais corporativas.
*   Controle de acesso por grupo: PO, Scrum Master, Developer, Tech Lead, Manager, Admin.
*   Bloqueio automático de acesso quando o usuário for removido do grupo no Keycloak.

### 6.4 Integração com Oracle Database

A integração com Oracle deve permitir leitura e/ou escrita controlada em bases corporativas, relatórios legados, dados de sistemas internos e informações necessárias para enriquecer a visão de Engineering Intelligence.

#### Regras de Negócio

*   **Fonte corporativa de dados:** O Axionn pode consumir dados de sistemas internos armazenados em Oracle.
*   **Escrita controlada:** Qualquer escrita em Oracle deve ser explicitamente configurada, auditada e preferencialmente feita por APIs ou stored procedures aprovadas.
*   **Segurança:** Credenciais devem ser criptografadas e segregadas por ambiente.
*   **Rastreabilidade:** Consultas e cargas devem gerar logs de execução, volume processado e erros.
*   **LGPD e minimização:** O Axionn deve coletar apenas os campos necessários para análise e relatório.

#### Detalhes Técnicos

*   Conectar via driver Oracle compatível com o backend adotado.
*   Suportar conexões por service name, wallet, TLS e secrets gerenciados.
*   Implementar jobs de ETL/ELT para ingestão incremental.
*   Tabelas sugeridas:
    *   **`oracle_integrations`:** configuração de conexão e escopo.
    *   **`oracle_sync_jobs`:** jobs de extração/carga, agenda e status.
    *   **`oracle_sync_events`:** execuções, erros, volume de linhas e checkpoints.
*   Estratégias de ingestão:
    *   Pull incremental por timestamp/chave.
    *   Views materializadas aprovadas pela área de dados.
    *   Staging tables para cargas controladas.
    *   APIs intermediárias quando acesso direto ao banco não for permitido.

#### Casos de Uso

*   Enriquecer relatórios com dados corporativos de times, centros de custo, sistemas e aplicações.
*   Cruzar dados de entrega com indicadores internos.
*   Alimentar painéis executivos com dados consolidados do Axionn e de sistemas legados.

### 6.5 Integração com Oracle APEX

O Oracle APEX deve ser tratado como camada de aplicações internas que podem consumir dados do Axionn ou expor dados operacionais para o Axionn.

#### Regras de Negócio

*   **Consumo por aplicações APEX:** Aplicações APEX podem consultar APIs do Axionn para exibir status, métricas e relatórios.
*   **Integração com aplicações legadas:** APEX pode funcionar como ponte para processos internos já existentes.
*   **Autenticação integrada:** Acesso entre APEX e Axionn deve usar OAuth2/OIDC, preferencialmente com Keycloak e controle via 3Scale.
*   **Auditoria:** Chamadas feitas por aplicações APEX devem ser registradas como consumo técnico e, quando possível, associadas ao usuário final.

#### Detalhes Técnicos

*   Expor APIs do Axionn no 3Scale para consumo pelo APEX.
*   Criar REST Data Sources no APEX para dashboards, consultas de HUs, métricas DORA e relatórios de uso.
*   Quando necessário, consumir APIs ORDS/APEX a partir do Axionn.
*   Tabelas sugeridas:
    *   **`apex_integrations`:** aplicações APEX integradas ao Axionn.
    *   **`apex_usage_events`:** chamadas e interações oriundas do APEX.
    *   **`external_app_user_mappings`:** vínculo entre usuário APEX, Keycloak e Axionn.
*   Padronizar correlation ID entre APEX, 3Scale e Axionn para rastreamento ponta a ponta.

#### Casos de Uso

*   Portal APEX exibindo status de projetos, HUs críticas e métricas DORA.
*   Aplicação interna APEX abrindo uma demanda que gera item no Axionn.
*   Relatório executivo em APEX consumindo snapshots calculados no Axionn.

### 6.6 Orquestração entre Integrações

As integrações devem compartilhar padrões comuns de autenticação, autorização, auditoria e observabilidade.

#### Padrões obrigatórios

*   **Correlation ID:** Toda chamada entre sistemas deve carregar um identificador de correlação.
*   **Idempotência:** Eventos externos devem ser processados de forma idempotente para evitar duplicidade.
*   **Retry controlado:** Falhas temporárias devem ser reprocessadas com backoff e limite de tentativas.
*   **Dead-letter queue:** Eventos que falharem após tentativas devem ir para fila/tabela de exceção.
*   **Auditoria:** Toda ação relevante deve registrar origem, usuário, sistema, payload mínimo, status e timestamp.
*   **Configuração por tenant/projeto:** Cada integração deve poder ser habilitada/desabilitada por organização, projeto ou ambiente.

## 7. Pilar 6: Telemetria, Logs de Uso dos Usuários e Relatórios

Este pilar atende diretamente à necessidade de pegar logs de uso dos usuários e acrescentá-los aos relatórios. A telemetria deve medir adoção, produtividade, governança, segurança e efetividade das funcionalidades do Axionn.

### 7.1 Regras de Negócio

*   **Coleta de uso por usuário:** Registrar ações relevantes realizadas no Axionn, Teams, Copilot, APEX e APIs.
*   **Relatório de adoção:** Consolidar uso por usuário, time, projeto, funcionalidade e período.
*   **Relatório de produtividade:** Cruzar uso com dados de entrega, sem transformar o relatório em vigilância individual indevida.
*   **Auditoria:** Registrar ações sensíveis, alterações de configuração, acessos administrativos, integrações e chamadas externas.
*   **Privacidade e LGPD:** Definir retenção, minimização de dados, controle de acesso e finalidade explícita para os logs.
*   **Transparência:** Usuários e administradores devem saber quais tipos de eventos são coletados e para qual finalidade.

### 7.2 Eventos de Uso a Coletar

#### Interface Web do Axionn

*   Login, logout e falha de login.
*   Acesso a projeto, sprint, backlog, HU, dashboard e relatório.
*   Criação, edição, exclusão e mudança de status de HU.
*   Criação e resolução de impedimentos.
*   Uso de funcionalidades de IA: geração de HU, estimativa, análise de risco, resumo e recomendações.
*   Exportação de relatórios.
*   Alterações administrativas e configurações de integração.

#### Integrações e APIs

*   Chamadas recebidas via 3Scale.
*   Comandos executados no Teams.
*   Consultas feitas pelo Copilot Plugin.
*   Sincronizações com GitLab, Redmine, Oracle e APEX.
*   Eventos de autenticação e autorização via Keycloak.
*   Falhas de permissão, timeouts, erros de integração e reprocessamentos.

### 7.3 Modelo de Dados Sugerido

*   **`user_usage_events`:** eventos de uso da interface e ações do usuário.
    *   Campos: `id`, `tenant_id`, `project_id`, `user_id`, `event_type`, `entity_type`, `entity_id`, `source`, `metadata_json`, `ip_hash`, `user_agent`, `created_at`.
*   **`integration_usage_events`:** eventos gerados por integrações externas.
    *   Campos: `id`, `tenant_id`, `integration_type`, `external_system`, `event_type`, `status`, `correlation_id`, `metadata_json`, `created_at`.
*   **`auth_audit_events`:** autenticação, autorização e falhas de acesso.
    *   Campos: `id`, `user_id`, `provider`, `event_type`, `client_id`, `result`, `reason`, `created_at`.
*   **`report_usage_snapshots`:** agregações diárias/semanais para relatórios.
    *   Campos: `id`, `tenant_id`, `project_id`, `period_start`, `period_end`, `metric_name`, `metric_value`, `dimension_json`.
*   **`audit_log_events`:** eventos sensíveis e administrativos.
    *   Campos: `id`, `actor_user_id`, `action`, `target_type`, `target_id`, `before_json`, `after_json`, `source`, `created_at`.

### 7.4 Indicadores para o Relatório

*   Usuários ativos diários, semanais e mensais.
*   Adoção por funcionalidade: HUs, Planning Poker, IA, DORA, risco de sprint, dashboards, exportações.
*   Uso por integração: GitLab, Teams, 3Scale, Redmine, Keycloak, Oracle e APEX.
*   Volume de chamadas de API por endpoint e aplicação consumidora.
*   Taxa de erro por integração.
*   Tempo médio de sincronização por sistema.
*   Eventos críticos por projeto.
*   Uso de IA por projeto, time e tipo de operação.
*   HUs criadas/editadas/concluídas por período.
*   Relatórios exportados por usuário/projeto.
*   Alertas enviados e ações tomadas após alertas.

### 7.5 Visualização no Produto

*   **Relatório Executivo:** adoção, DORA, risco, uso de IA e saúde das integrações.
*   **Relatório de Segurança e Auditoria:** acessos, falhas de autenticação, permissões negadas e ações administrativas.
*   **Relatório de Integrações:** status, volume, erros, latência e última sincronização.
*   **Relatório de Uso por Time:** usuários ativos, funcionalidades usadas e evolução no tempo.
*   **Relatório de IA:** quantidade de chamadas, custo estimado, funcionalidades mais usadas e taxa de aceitação das sugestões.

### 7.6 Cuidados de Implementação

*   Evitar registrar dados sensíveis desnecessários em payloads.
*   Aplicar hash ou mascaramento em IP e user agent quando apropriado.
*   Definir retenção por tipo de log.
*   Separar logs operacionais de logs analíticos.
*   Garantir que relatórios individuais sejam usados para auditoria e suporte, não para microgestão sem critério.
*   Permitir exportação controlada em CSV/PDF conforme perfil de permissão.

## 8. Considerações Arquiteturais Comuns

*   **Microserviços/Edge Functions:** Manter a arquitetura modular, utilizando Edge Functions ou microserviços para cada nova funcionalidade (integração Git, cálculo DORA, predição de risco) para garantir escalabilidade e resiliência.
*   **Banco de Dados:** Continuar utilizando PostgreSQL/Supabase, aproveitando as capacidades de RLS e triggers para manter a segurança e a integridade dos dados.
*   **Observabilidade:** Implementar logging, monitoramento e tracing para todas as novas funcionalidades, garantindo que problemas possam ser rapidamente identificados e resolvidos. A observabilidade deve incluir logs de uso dos usuários, logs de integração, métricas de consumo de API, falhas de autenticação, rastreamento por correlation ID e painéis de saúde operacional.
*   **UI/UX:** Integrar as novas informações de forma intuitiva nas interfaces existentes do Axionn, mantendo a consistência visual e a usabilidade.

## 9. Roadmap Sugerido (Fases de Implementação)

Este roadmap é uma sugestão e pode ser ajustado conforme a prioridade e os recursos disponíveis.


### Fase 0: Fundações de Identidade, Governança de APIs e Telemetria (2-3 semanas)
*   **Objetivo:** Preparar os blocos transversais que serão usados por todas as integrações.
*   **Entregas:**
    *   Definição de modelo de autenticação via Keycloak/OIDC.
    *   Definição do padrão de publicação de APIs via 3Scale.
    *   Modelo de correlation ID para rastreabilidade ponta a ponta.
    *   Estrutura inicial das tabelas `user_usage_events`, `integration_usage_events`, `auth_audit_events` e `audit_log_events`.
    *   Política de retenção, privacidade e mascaramento de logs.
    *   Painel inicial de saúde das integrações.

### Fase 1: Integração Básica com Git e Coleta de Eventos (2-4 semanas)
*   **Objetivo:** Estabelecer a base para a coleta de dados do Git.
*   **Entregas:**
    *   Módulo de configuração de integração Git (GitHub/GitLab) por projeto.
    *   GitLab tratado como provedor de primeira classe, com suporte a grupos, subgrupos, projetos e merge requests.
    *   Armazenamento seguro de credenciais Git.
    *   Implementação de webhooks para `push`, `pull_request`/`merge_request`, `pipeline`, `job` e `deployment`.
    *   Tabelas `git_integrations`, `git_events`, `gitlab_pipeline_events`, `gitlab_deployment_events` e `gitlab_user_mappings`.
    *   Edge Function/Worker para processar eventos brutos do Git.
    *   Mapeamento básico de usuários Axionn para usuários Git/GitLab.

### Fase 2: Vinculação HU-Git e Métricas DORA (4-6 semanas)
*   **Objetivo:** Conectar HUs ao código e iniciar a coleta das Métricas DORA.
*   **Entregas:**
    *   Funcionalidade de vincular HUs a branches/PRs (via ID no nome da branch/título do PR).
    *   Visualização de PRs e commits relacionados na tela da HU.
    *   Tabelas `hu_git_links`, `deployment_events`, `incident_events`.
    *   Integração com uma ferramenta de CI/CD para `deployment_events`.
    *   Dashboard inicial das 4 Métricas DORA (Frequência de Deploy, Lead Time for Changes, Taxa de Falha de Mudança, Tempo para Restaurar o Serviço).
    *   Engine de cálculo de Métricas DORA.

### Fase 3: Predição de Risco de Sprint com IA (6-8 semanas)
*   **Objetivo:** Implementar o modelo de predição de risco e feedback loop.
*   **Entregas:**
    *   Coleta e preparação de dados históricos para treinamento do modelo de IA.
    *   Desenvolvimento e treinamento do modelo de predição de risco de sprint/HU.
    *   Serviço/Worker de predição de risco (`risk_prediction_service`).
    *   Tabela `sprint_risk_events`.
    *   Integração da predição de risco nas telas de Sprint e HU (alertas visuais, justificativas).
    *   Mecanismo de feedback loop para o modelo de IA (usuário pode marcar predição como correta/incorreta).

### Fase 4: Integração com Microsoft Teams (4-6 semanas)
*   **Objetivo:** Levar o Axionn para o ambiente de colaboração Enterprise.
*   **Entregas:**
    *   Desenvolvimento de um aplicativo básico para Microsoft Teams.
    *   Implementação de bot de notificações para eventos críticos do Axionn (risco de HU, PRs, impedimentos).
    *   Comandos de consulta e ação via Teams.
    *   Configuração de autenticação OAuth 2.0 para o Teams integrada ao Keycloak.
    *   Registro de logs de interação via Teams em `user_usage_events` e `integration_usage_events`.
    *   Tabela `teams_integrations` para gerenciar as configurações.

### Fase 5: Integração com Microsoft 365 Copilot (6-8 semanas)
*   **Objetivo:** Permitir interação com o Axionn via linguagem natural através do Copilot.
*   **Entregas:**
    *   Desenvolvimento de um plugin para o Microsoft 365 Copilot.
    *   Exposição de APIs do Axionn otimizadas para consultas do Copilot.
    *   Utilização de Microsoft Graph Connectors para indexação de dados.
    *   Tabela `copilot_plugins` para gerenciar as configurações.

### Fase 6: Integrações Corporativas — 3Scale, Redmine, Keycloak, Oracle e Oracle APEX (6-10 semanas)
*   **Objetivo:** Conectar o Axionn ao ecossistema corporativo de APIs, identidade, demandas, dados e aplicações internas.
*   **Entregas:**
    *   Integração com Keycloak para SSO, RBAC, claims e auditoria de autenticação.
    *   Publicação das APIs críticas do Axionn no 3Scale, com controle de consumo, rate limit e métricas.
    *   Integração com Redmine para sincronização de issues, bugs, tarefas e impedimentos.
    *   Integração com Oracle Database para ingestão controlada de dados corporativos.
    *   Integração com Oracle APEX para consumo de APIs do Axionn e exposição de relatórios internos.
    *   Tabelas `redmine_integrations`, `redmine_issue_links`, `oracle_integrations`, `oracle_sync_jobs`, `apex_integrations`, `api_gateway_usage_events` e tabelas correlatas.
    *   Logs de integração em `integration_usage_events`.

### Fase 7: Relatórios de Uso, Auditoria e Adoção (3-5 semanas)
*   **Objetivo:** Acrescentar logs de uso dos usuários aos relatórios do Axionn.
*   **Entregas:**
    *   Instrumentação da interface web para coletar eventos de uso.
    *   Instrumentação de Teams, Copilot, GitLab, Redmine, 3Scale, Keycloak, Oracle e APEX.
    *   Agregações em `report_usage_snapshots`.
    *   Relatório Executivo de adoção e uso.
    *   Relatório de Segurança e Auditoria.
    *   Relatório de Integrações.
    *   Relatório de Uso por Time/Projeto.
    *   Definição de política de retenção, privacidade e mascaramento de dados.

### Fase 8: Refinamentos e Expansão (Contínuo)
*   **Objetivo:** Melhorar a precisão, adicionar mais integrações e expandir funcionalidades.
*   **Entregas:**
    *   Integração com ferramentas de monitoramento para `incident_events`.
    *   Agente de Grooming Automático (sugestão de quebra de HUs).
    *   Transparência de Custos de IA.
    *   AI Audit Log para decisões da IA.
    *   Customização de "Brain" por projeto.
    *   Integração com ferramentas de comunicação (Slack/Discord).
    *   Evolução dos relatórios de logs de uso para análises preditivas de adoção.

---

Este plano oferece um caminho claro para a evolução do Axionn, focando em funcionalidades de alto valor que o diferenciarão no mercado. A modularidade da sua arquitetura atual com Edge Functions e Supabase facilitará a implementação incremental dessas novas capacidades. 


## 10. Notas da Revisão

As integrações solicitadas foram tratadas da seguinte forma:

*   **GitLab:** já estava citado no pilar Git, mas foi detalhado como provedor de primeira classe, incluindo merge requests, pipelines, jobs e deployments.
*   **Teams:** já estava previsto no pilar Microsoft, mas foi complementado com comandos, logs de interação e uso nos relatórios.
*   **3Scale:** incluído como camada de API Management, controle de consumo e governança.
*   **Redmine:** incluído para sincronização de issues, bugs, tarefas, impedimentos e histórico operacional.
*   **Keycloak:** incluído como provedor de identidade, SSO, RBAC e auditoria de autenticação.
*   **Oracle Database:** incluído para integração com dados corporativos e sistemas legados.
*   **Oracle APEX:** incluído para consumo/exposição de dados e relatórios em aplicações internas.
*   **Logs de uso dos usuários:** incluídos como pilar próprio de telemetria, com eventos, tabelas, indicadores e relatórios.
