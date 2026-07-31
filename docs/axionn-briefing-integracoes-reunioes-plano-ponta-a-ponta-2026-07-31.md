# Axionn Briefing — Plano ponta a ponta para integrações de reuniões

**Sistema:** Axionn  
**Módulo:** Axionn Briefing  
**Branch-base analisada:** `develop`  
**Data do plano:** 31/07/2026  
**Status:** planejamento aprovado para detalhamento; implementação não iniciada  
**Prioridade proposta:** Microsoft Teams primeiro, Google Meet na sequência  
**Objetivo deste documento:** preservar o histórico das decisões e orientar a evolução do Axionn Briefing para importar reuniões gravadas, gerar relatórios verificáveis e converter os resultados aprovados em execução operacional no Axionn.

---

# 1. Resumo executivo

O Axionn Briefing será evoluído de um fluxo baseado principalmente em texto colado ou arquivo para uma plataforma de inteligência operacional conectada a reuniões do Microsoft Teams e Google Meet.

A proposta não é criar apenas mais um gerador de atas. O diferencial será fechar o ciclo completo:

```text
Reunião
   ↓
Transcrição e participantes
   ↓
Decisões, ações, riscos e impedimentos
   ↓
Evidências verificáveis
   ↓
Revisão humana
   ↓
Backlog, sprint, impedimento ou acompanhamento
   ↓
Resultado e pauta da próxima reunião
```

A estratégia recomendada é:

1. começar pelo Microsoft Teams;
2. adicionar Google Meet após estabilizar o contrato comum de conectores;
3. utilizar transcrições geradas pelos provedores como fonte principal;
4. manter as gravações armazenadas no provedor durante o MVP;
5. exigir revisão humana antes de criar qualquer item no Axionn;
6. validar o fluxo manual antes de habilitar sincronização automática;
7. preservar upload e texto colado como alternativas de contingência.

---

# 2. Situação atual do Axionn Briefing

O Axionn já possui uma fundação relevante e não deve ser reescrito do zero.

## 2.1 Capacidades existentes

- criação manual por texto colado;
- importação de arquivos `.txt`, `.md` e `.markdown`;
- classificação por Daily, Planning, Review, Retrospectiva, Discovery ou reunião livre;
- extração de decisões, ações, impedimentos, riscos, perguntas em aberto e candidatos ao backlog;
- exigência de evidência literal por sugestão;
- validação da evidência contra a transcrição de origem;
- revisão humana por aprovação, edição ou rejeição;
- confirmação de responsável e prazo;
- aplicação de ações e candidatos no backlog;
- criação de impedimentos vinculados à sprint;
- histórico por equipe;
- indicadores de acompanhamento;
- acompanhamento dos resultados gerados;
- geração de pauta para a próxima reunião;
- retenção, arquivamento, anonimização e exclusão controlada;
- governança de consumo e backoffice operacional.

## 2.2 Referências atuais no repositório

- `src/features/briefing/pages/BriefingPage.tsx`
- `src/features/briefing/services/briefing.service.ts`
- `src/features/briefing/hooks/useBriefing.ts`
- `src/features/briefing/types/briefing.ts`
- `src/features/briefing/components/NextMeetingAgenda.tsx`
- `supabase/functions/process-ai-briefing/index.ts`
- migrations `20260709*_axionn_briefing_*.sql`

## 2.3 Fundação Teams existente

O repositório já contém uma integração Teams voltada a:

- bot;
- comandos;
- notificações;
- Adaptive Cards;
- mapeamento de canais;
- health operacional.

Referências:

- `supabase/migrations/20260709070000_phase4_teams_integration.sql`
- `supabase/functions/teams-bot/index.ts`
- `docs/consolidacao-fase-4b-teams-health-2026-07-11.md`

Essa fundação poderá fornecer padrões de health, auditoria e configuração, mas ainda não importa reuniões, participantes, gravações ou transcrições.

## 2.4 Lacunas atuais

- ausência de conexão OAuth específica para artefatos de reunião;
- ausência de uma caixa de entrada de reuniões externas;
- ausência de sincronização e reconciliação com provedores;
- ausência de modelo canônico para reuniões e artefatos;
- ausência de transcrição segmentada por participante e horário;
- ausência de navegação da evidência para o ponto correspondente da gravação;
- ausência de health e reautorização específicos do conector de reuniões;
- ausência de tratamento de reunião sem transcrição;
- ausência de idempotência por reunião e artefato externos;
- ausência de gestão administrativa de escopos, retenção e sincronização.

---

# 3. Pesquisa de mercado

## 3.1 Padrões observados

As soluções atuais convergem para as seguintes capacidades:

- entrada automática em reuniões ou captura nativa;
- transcrição com identificação de speakers;
- resumos e action items;
- pesquisa na transcrição;
- navegação por timestamps;
- compartilhamento de trechos;
- integração com CRM, Jira e gerenciadores de tarefas;
- busca em múltiplas reuniões;
- templates de relatório por tipo de reunião.

## 3.2 Produtos analisados

| Produto | Capacidades relevantes | Aprendizado para o Axionn |
|---|---|---|
| Microsoft Teams | Recap, resumo por IA, tarefas, speakers e timestamps | Um resumo isolado não será um diferencial suficiente |
| Google Meet | Notas automáticas, próximos passos e citações | Evidência temporal já é uma expectativa do usuário |
| Otter | Autoentrada, transcrição, action items, busca e integrações | Automação pós-reunião precisa ser simples |
| Fireflies | Transcrição, resumos, action items e workflows | Conectores e automações têm alto valor percebido |
| Fathom | Templates, responsáveis, action items e follow-up | O relatório deve considerar o tipo da reunião |
| tl;dv | Clips, timestamps, insights e integração com Jira | Evidências devem ser fáceis de localizar e compartilhar |
| Read.ai | Upload de mídia, capítulos e relatórios | Upload deve permanecer como fallback |

## 3.3 Fontes oficiais consultadas

- Microsoft Teams Recap: <https://support.microsoft.com/en-us/teams/meetings/recap-in-microsoft-teams>
- Microsoft Graph — transcrições: <https://learn.microsoft.com/en-us/graph/api/onlinemeeting-list-transcripts?view=graph-rest-1.0>
- Microsoft Graph — application access policy: <https://learn.microsoft.com/en-us/graph/cloud-communication-online-meeting-application-access-policy>
- Microsoft Graph — notificações de gravações e transcrições: <https://learn.microsoft.com/en-us/graph/teams-changenotifications-callrecording-and-calltranscript>
- Google Meet — Take notes for me: <https://support.google.com/meet/answer/14754931?hl=en>
- Google Meet REST — artefatos: <https://developers.google.com/workspace/meet/api/guides/artifacts>
- Google Workspace Events — Meet: <https://developers.google.com/workspace/events/guides/events-meet>
- Google Meet REST — autenticação: <https://developers.google.com/workspace/meet/api/guides/authenticate-authorize>
- Otter: <https://otter.ai/>
- Fireflies: <https://fireflies.ai/>
- Fathom: <https://help.fathom.video/en/articles/640768>
- tl;dv: <https://tldv.io/product-research-software/>
- Read.ai: <https://www.read.ai/meeting-reports>

---

# 4. Posicionamento do produto

## 4.1 Proposta de valor

> Da fala à execução, com evidência, responsável, prazo e acompanhamento.

## 4.2 Diferencial competitivo

O Axionn deverá se diferenciar por:

- exigir evidência para cada informação operacional;
- preservar a ligação com a fala original;
- manter revisão humana obrigatória;
- transformar itens aprovados em objetos reais do Axionn;
- acompanhar se o compromisso foi concluído;
- transportar pendências para a próxima reunião;
- relacionar reunião, projeto, sprint, backlog, impedimentos e resultados.

## 4.3 O que não será priorizado

- competir com plataformas de videoconferência;
- hospedar vídeos no MVP;
- inserir um bot Axionn nas reuniões no MVP;
- fazer análise emocional ou de sentimento;
- classificar produtividade ou comportamento individual;
- criar tarefas automaticamente sem aprovação;
- substituir a política corporativa de gravação do provedor.

---

# 5. Escopo funcional

## 5.1 MVP Teams

O usuário poderá:

1. conectar uma conta ou tenant Microsoft;
2. listar reuniões concluídas às quais possui acesso;
3. identificar gravação e transcrição disponíveis;
4. selecionar uma reunião para importação;
5. visualizar participantes, data, duração e organizador;
6. relacionar a reunião com equipe, projeto e sprint;
7. gerar um briefing usando a transcrição oficial;
8. navegar da sugestão para a evidência e timestamp;
9. aprovar, editar ou rejeitar sugestões;
10. aplicar sugestões aprovadas ao Axionn;
11. acompanhar os resultados.

## 5.2 MVP Google Meet

O mesmo contrato será disponibilizado para:

- conference records;
- participantes;
- gravações;
- transcrições;
- transcript entries;
- eventos de arquivo gerado.

## 5.3 Estratégia transcript-first

No MVP, importar uma reunião gravada significa:

- importar seus metadados;
- importar participantes;
- importar a transcrição estruturada;
- preservar referência e link autorizado para a gravação;
- utilizar timestamps como evidência;
- não copiar o vídeo para o storage do Axionn.

## 5.4 Reunião sem transcrição

Quando existir gravação sem transcrição:

- apresentar o estado `Gravação disponível, mas sem transcrição`;
- permitir importação manual de `.vtt`, `.txt` ou `.md`;
- futuramente permitir upload de áudio ou vídeo;
- futuramente oferecer transcrição sob demanda com confirmação de custo e retenção.

---

# 6. Arquitetura da informação

O Axionn Briefing será organizado em cinco áreas.

## 6.1 Visão geral

- reuniões importadas;
- briefings aguardando revisão;
- compromissos vencidos;
- itens aplicados;
- taxa de conclusão;
- consumo e limites do plano;
- saúde das conexões.

## 6.2 Reuniões

Nova caixa de entrada contendo:

- reuniões recentes;
- origem Teams, Meet ou upload;
- organizador e participantes;
- duração;
- disponibilidade de gravação e transcrição;
- situação da importação;
- filtros por data, provedor, equipe, projeto e estado;
- ação `Gerar briefing`;
- prevenção visual e técnica de duplicidade.

## 6.3 Briefings

- histórico de relatórios;
- busca e filtros;
- estado de processamento;
- estado de revisão;
- estado de aplicação;
- acesso ao resumo e evidências.

## 6.4 Acompanhamento

- compromissos em aberto;
- responsável;
- prazo;
- reunião de origem;
- evidência de origem;
- objeto criado no Axionn;
- situação atual;
- pauta sugerida para a próxima reunião.

## 6.5 Conexões

Área administrativa contendo:

- provedor;
- conta ou tenant conectado;
- status;
- permissões concedidas;
- última sincronização;
- último erro sanitizado;
- política de sincronização;
- retenção;
- teste de conexão;
- reautorização;
- revogação.

---

# 7. Jornadas do usuário

## 7.1 Conectar um provedor

1. Administrador acessa `Briefing > Conexões`.
2. Seleciona Teams ou Meet.
3. O sistema explica os dados e permissões necessários.
4. Administrador autoriza no provedor.
5. Backend valida os escopos concedidos.
6. Administrador escolhe organizadores, equipes e período inicial.
7. Administrador define importação manual ou automática.
8. Administrador define retenção.
9. Axionn executa um teste de conexão.
10. Conector assume estado `Saudável` ou `Requer atenção`.

## 7.2 Importar uma reunião

1. Usuário acessa `Reuniões`.
2. Filtra ou pesquisa a reunião.
3. Abre o preview.
4. Confirma gravação e transcrição disponíveis.
5. Relaciona equipe, projeto, sprint e tipo de reunião.
6. Seleciona `Gerar briefing`.
7. Processamento ocorre em background.
8. Usuário recebe feedback quando o relatório estiver pronto.

## 7.3 Revisar um briefing

No desktop:

```text
┌──────────────── Transcrição ────────────────┬──────── Relatório ─────────┐
│ Speaker e horário                           │ Resumo executivo           │
│ Trecho destacado                            │ Decisões                   │
│ Navegação pela gravação                     │ Ações                      │
│ Busca na transcrição                        │ Impedimentos e riscos      │
│                                             │ Aprovar / editar / rejeitar│
└─────────────────────────────────────────────┴────────────────────────────┘
```

No mobile:

- transcrição e relatório em abas;
- ações principais em barra fixa;
- painel de evidência em Drawer;
- alvos de toque com pelo menos 44px;
- ausência de conteúdo oculto por barras fixas.

## 7.4 Aplicar e acompanhar

1. Revisor aprova ou edita a sugestão.
2. Axionn solicita confirmação do destino quando necessário.
3. Backend cria o objeto de forma transacional e idempotente.
4. Briefing preserva o vínculo com o objeto criado.
5. Acompanhamento reflete a situação real do objeto.
6. Pendências podem alimentar a pauta seguinte.

---

# 8. Estados de experiência

## 8.1 Estados da conexão

- não conectada;
- conectando;
- saudável;
- sincronizando;
- requer atenção;
- permissão insuficiente;
- token expirado;
- acesso revogado;
- desativada.

## 8.2 Estados da reunião

- descoberta;
- reunião em andamento;
- aguardando artefatos;
- gravação disponível;
- transcrição disponível;
- pronta para importar;
- importando;
- processando;
- aguardando revisão;
- verificada;
- aplicada;
- arquivada;
- falha recuperável;
- falha definitiva.

## 8.3 Estados de interface obrigatórios

- skeleton loading;
- loading com progresso quando possível;
- empty state com ação orientadora;
- erro com causa sanitizada e ação de recuperação;
- sucesso sem interromper a continuidade;
- estado parcial quando apenas alguns artefatos estiverem disponíveis;
- `aria-live` ou `role="alert"` para mensagens relevantes;
- suporte a `prefers-reduced-motion`.

---

# 9. Arquitetura técnica

## 9.1 Contrato de provedores

```text
MeetingProviderAdapter
├── MicrosoftTeamsAdapter
├── GoogleMeetAdapter
└── ManualUploadAdapter
```

Cada adaptador deverá oferecer:

- autorização;
- renovação de credenciais;
- revogação;
- teste de saúde;
- listagem de reuniões;
- obtenção de detalhes;
- obtenção de participantes;
- obtenção de gravações;
- obtenção de transcrições;
- normalização para o modelo Axionn;
- sincronização incremental;
- classificação de erros.

## 9.2 Entidades propostas

- `meeting_connections`
- `meeting_sync_cursors`
- `meeting_webhook_events`
- `external_meetings`
- `meeting_participants`
- `meeting_artifacts`
- `meeting_transcript_segments`
- `meeting_processing_jobs`
- `briefing_source_links`

As entidades atuais de briefing, sugestões, evidências, aplicações, retenção e consumo serão estendidas, não substituídas.

## 9.3 Estado canônico do pipeline

```text
discovered
→ artifacts_pending
→ ready
→ importing
→ normalizing
→ processing
→ needs_review
→ verified
→ applied
→ archived
```

Falhas deverão registrar:

- etapa;
- código interno;
- código do provedor;
- recuperabilidade;
- número de tentativas;
- próxima tentativa;
- correlation ID;
- mensagem sanitizada.

## 9.4 Evidência canônica

Cada evidência deverá preservar:

- `provider`;
- `external_meeting_id`;
- `artifact_id`;
- participante;
- trecho literal;
- posição inicial e final no texto normalizado;
- timestamp inicial e final;
- hash do trecho;
- link autorizado para a gravação;
- versão da transcrição.

## 9.5 Processamento de IA

- dividir transcrições longas em blocos;
- preservar contexto entre blocos;
- usar schema JSON versionado;
- exigir evidência por sugestão;
- validar evidência contra a fonte;
- eliminar duplicidades entre blocos;
- identificar idioma;
- separar decisão, ação, impedimento, risco, pergunta e backlog;
- registrar modelo, versão, latência, tokens e custo;
- impedir instruções maliciosas presentes na transcrição;
- nunca publicar ou aplicar automaticamente por padrão.

---

# 10. Microsoft Teams

## 10.1 Estratégia

- aplicação Microsoft Entra multi-tenant;
- piloto com conexão delegada do organizador;
- acesso empresarial por aplicação limitado por application access policy;
- sincronização inicial por consulta;
- change notifications após validação do MVP;
- reconciliação periódica para eventos perdidos;
- branch específica para `GraphAccessToTranscriptsDisabled`;
- suporte a reautorização e consentimento administrativo.

## 10.2 Permissões a validar na prova técnica

- `OnlineMeetings.Read` ou equivalente necessário ao cenário;
- `OnlineMeetingTranscript.Read.All`;
- `OnlineMeetingRecording.Read.All` quando o produto realmente precisar do artefato;
- escopos adicionais somente após confirmação de necessidade.

## 10.3 Restrições importantes

- consentimento administrativo poderá ser necessário;
- acesso a transcrições pode ser desabilitado pelo tenant;
- application permissions exigem application access policy;
- alguns tipos de reunião possuem limitações específicas;
- assinatura e renovação de subscriptions precisam ser monitoradas;
- artefatos só devem ser processados depois de estarem disponíveis.

---

# 11. Google Meet

## 11.1 Estratégia

- OAuth 2.0 em nome do usuário no MVP;
- menor conjunto possível de escopos;
- Meet REST API para conference records e artefatos;
- Workspace Events e Pub/Sub para eventos;
- reconciliação periódica;
- domain-wide delegation apenas para modalidade Enterprise;
- processamento rápido dos transcript entries.

## 11.2 Escopos a validar

- `meetings.space.readonly`;
- `drive.meet.readonly` somente se o acesso ao arquivo do Drive for necessário.

O escopo `drive.meet.readonly` é restrito e deve ser evitado no primeiro piloto caso os transcript entries sejam suficientes.

## 11.3 Restrições importantes

- o usuário precisa possuir acesso ao espaço ou artefato;
- gravações e transcrições dependem das configurações do Meet;
- transcript entries estruturados ficam disponíveis por período limitado;
- eventos precisam ser recebidos via infraestrutura Pub/Sub;
- arquivos permanecem sujeitos às permissões e regras do Google Drive.

---

# 12. Segurança, RBAC e privacidade

## 12.1 Permissões propostas

- `briefing.connections.view`
- `briefing.connections.manage`
- `briefing.meetings.list`
- `briefing.meetings.import`
- `briefing.process`
- `briefing.review`
- `briefing.apply`
- `briefing.export`
- `briefing.retention.manage`

## 12.2 Controles obrigatórios

- tokens armazenados exclusivamente no backend;
- segredos criptografados ou mantidos no Vault;
- refresh tokens nunca retornados ao frontend;
- RLS por organização;
- validação de organização, equipe e usuário no backend;
- assinatura ou validação de autenticidade de eventos;
- proteção contra replay;
- inbox de eventos idempotente;
- auditoria das operações críticas;
- retenção configurável;
- anonimização e exclusão em cascata;
- não copiar vídeo no MVP;
- revisão humana obrigatória;
- consentimento e política corporativa visíveis;
- ausência de análise emocional ou avaliação individual.

## 12.3 Validação organizacional

Antes da liberação, cada organização deverá confirmar:

- base e política interna para gravação e transcrição;
- comunicação e consentimento dos participantes;
- período de retenção;
- grupos autorizados a visualizar reuniões;
- regras para participantes externos;
- procedimento de revogação e exclusão.

---

# 13. Entitlements e limites comerciais

Entitlements sugeridos:

- `briefing.integrations.enabled`
- `briefing.integrations.teams`
- `briefing.integrations.meet`
- `briefing.integrations.auto_sync`
- `briefing.recording_access`
- `briefing.cross_meeting_insights`
- limite de reuniões por mês;
- limite de minutos processados por mês;
- limite de conexões;
- limite de retenção em dias.

Estratégia comercial inicial sugerida:

- plano Intelligence: importação manual e geração de briefing;
- plano Enterprise: sincronização automática, administração central, retenção avançada e acesso por tenant;
- precificação definitiva somente após obter métricas reais de consumo.

---

# 14. Roadmap de implementação

Estimativa preliminar para um squad com frontend e backend/full-stack dedicados, com design e QA compartilhados: **10 a 12 semanas**.

## Fase 0 — Descoberta e prova técnica

**Duração estimada:** 1 semana.

Entregas:

- app de teste Microsoft Entra;
- app de teste Google Cloud;
- recuperação de uma reunião real do Teams;
- recuperação de uma reunião real do Meet;
- validação de participantes e timestamps;
- validação de link da gravação;
- matriz de permissões;
- decisão de retenção e consentimento;
- estimativa inicial de custo.

Gate:

- uma transcrição real recuperada de cada provedor;
- permissão e limitações documentadas;
- timestamps preservados;
- acesso cruzado entre tenants impossível;
- estratégia transcript-first confirmada.

## Fase 1 — Fundação dos conectores

**Duração estimada:** 2 semanas.

Entregas:

- modelo canônico;
- migrations e validações;
- RLS e RBAC;
- Vault/segredos;
- jobs de processamento;
- webhook inbox;
- deduplicação;
- retries e dead-letter;
- health operacional;
- auditoria;
- feature flags e entitlements.

## Fase 2 — Teams MVP

**Duração estimada:** 2 semanas.

Entregas:

- OAuth;
- consentimento administrativo;
- listagem de reuniões;
- participantes;
- transcrição;
- metadados da gravação;
- importação manual;
- reautorização;
- observabilidade do conector.

## Fase 3 — Nova experiência do Briefing

**Duração estimada:** 2 semanas.

Entregas:

- nova navegação;
- caixa de entrada de reuniões;
- wizard de importação;
- preview da reunião;
- processing center;
- revisão em painel dividido;
- timestamps e deep links;
- estados de loading, vazio, erro e sucesso;
- responsividade e acessibilidade.

## Fase 4 — Google Meet MVP

**Duração estimada:** 2 semanas.

Entregas:

- OAuth Google;
- conference records;
- participantes;
- recordings;
- transcripts e transcript entries;
- importação manual;
- reautorização;
- observabilidade do conector.

## Fase 5 — Automação

**Duração estimada:** 1 semana.

Entregas:

- Microsoft change notifications;
- Google Workspace Events/Pub/Sub;
- renovação de subscriptions;
- reconciliação agendada;
- notificações internas;
- reprocessamento seguro;
- pauta automática da próxima reunião.

## Fase 6 — Hardening e liberação gradual

**Duração estimada:** 1 a 2 semanas.

Entregas:

- carga e performance;
- testes de segurança;
- acessibilidade;
- testes de revogação;
- testes cross-tenant;
- chaos testing de eventos duplicados e fora de ordem;
- quotas e custos;
- canário por organização;
- runbook de rollout e rollback.

---

# 15. Estratégia de testes

## 15.1 Unitários

- adapters;
- parsers de transcrição;
- normalização de participantes;
- cálculo de timestamps;
- state machine;
- classificação de erros;
- deduplicação;
- validação de evidência.

## 15.2 Contrato

- fixtures oficiais de Teams;
- fixtures oficiais de Meet;
- paginação;
- artefatos ausentes;
- payloads duplicados;
- eventos fora de ordem;
- mudanças compatíveis e incompatíveis no provedor.

## 15.3 Banco e segurança

- pgTAP para RLS;
- tenant A não lê tenant B;
- permissões canônicas;
- RPCs endurecidas;
- operações críticas transacionais;
- tokens ausentes de consultas públicas;
- auditoria de todas as mutações críticas.

## 15.4 E2E

```text
Conectar
→ sincronizar
→ selecionar reunião
→ gerar briefing
→ revisar evidência
→ aprovar
→ aplicar
→ validar objeto criado
→ acompanhar resultado
```

## 15.5 Acessibilidade e responsividade

- 375px;
- 768px;
- 1024px;
- 1440px;
- teclado;
- leitor de tela;
- light mode;
- dark mode;
- zoom de 200%;
- reduced motion;
- contraste WCAG AA;
- foco visível;
- alvos mínimos de 44px.

---

# 16. Critérios de aceite do MVP

- usuário não visualiza reuniões de outra organização;
- reunião externa não pode ser importada duas vezes;
- toda sugestão possui pelo menos uma evidência válida;
- evidência preserva speaker e timestamp quando disponíveis;
- link da evidência abre o ponto correspondente quando o provedor permitir;
- nenhum item é aplicado sem revisão humana;
- token revogado altera a conexão para `Requer atenção`;
- eventos duplicados não duplicam reunião ou processamento;
- eventos fora de ordem não corrompem o estado;
- falhas recuperáveis podem ser reprocessadas;
- upload manual continua funcionando;
- a ausência de transcrição é explicada com uma ação possível;
- interface funciona nos breakpoints definidos;
- fluxo principal funciona integralmente por teclado;
- light e dark mode atendem WCAG AA;
- processamento demorado possui feedback persistente;
- toda operação crítica possui correlation ID e auditoria.

---

# 17. Métricas

## 17.1 Produto

- organizações com conector ativo;
- tempo até a primeira reunião importada;
- reuniões importadas por organização;
- tempo entre fim da reunião e briefing pronto;
- sugestões aprovadas, editadas e rejeitadas;
- itens aplicados ao Axionn;
- compromissos concluídos no prazo;
- reuniões que geraram pauta de acompanhamento;
- tempo estimado economizado.

## 17.2 Qualidade

- cobertura de evidências;
- sugestões rejeitadas por falta de sustentação;
- evidências que não localizaram o trecho original;
- taxa de edição humana;
- duplicidades evitadas;
- falhas de parsing;
- processamento parcial.

## 17.3 Operação

- sucesso de sincronização;
- atraso até disponibilização do artefato;
- tokens expirados ou revogados;
- subscriptions expiradas;
- retries e dead letters;
- latência p50 e p95;
- custo por minuto;
- storage utilizado;
- incidentes de isolamento de tenant.

---

# 18. Riscos e respostas

| Risco | Resposta planejada |
|---|---|
| Transcrição não habilitada | Estado explícito e fallback manual |
| Consentimento administrativo demorado | Preflight e guia para administradores |
| Token revogado | Health, aviso e reautorização |
| Evento duplicado | Inbox e chave idempotente |
| Evento perdido | Reconciliação periódica |
| Evento fora de ordem | State machine monotônica |
| Reunião muito longa | Chunking e processamento assíncrono |
| Custo elevado | Transcript-first, quotas e ledger de consumo |
| Exposição de mídia sensível | Não copiar vídeo no MVP |
| Mudança de API | Adapter e testes de contrato |
| Evidência incorreta | Validação literal e revisão humana |
| Acesso entre tenants | RLS, RPCs e testes cross-tenant |
| Escopo Google restrito | Evitar Drive no piloto quando possível |

---

# 19. Decisões registradas

As seguintes decisões compõem a baseline recomendada:

1. Microsoft Teams será implementado primeiro.
2. Google Meet será a segunda integração.
3. A arquitetura será transcript-first.
4. A gravação permanecerá no provedor durante o MVP.
5. Não haverá bot Axionn participando das reuniões no MVP.
6. A revisão humana será obrigatória.
7. Importação manual será validada antes da automática.
8. Upload e texto colado serão preservados como fallback.
9. Não haverá análise emocional ou avaliação individual.
10. O backend será a autoridade para conexão, importação e aplicação.
11. O modelo de conectores será comum aos provedores.
12. A implementação começará somente após o gate da Fase 0.

---

# 20. Próximo passo autorizado

O próximo passo, após aprovação deste plano, será detalhar a **Fase 0** em:

- épicos;
- histórias de usuário;
- tarefas técnicas;
- contratos de API;
- wireframes detalhados;
- modelo SQL proposto;
- matriz RBAC;
- roteiro das provas técnicas Teams e Meet;
- critérios de aceite executáveis.

Esse detalhamento não autoriza automaticamente migrations, deploys, criação de credenciais reais ou alteração de produção.

---

# 21. Histórico do documento

| Data | Versão | Alteração |
|---|---|---|
| 31/07/2026 | 1.0 | Criação do plano ponta a ponta após pesquisa de mercado, auditoria do Briefing atual e avaliação das APIs oficiais de Teams e Google Meet |

