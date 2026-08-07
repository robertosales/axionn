# Axionn Briefing — Detalhamento executável da Fase 0

**Documento-base:** `axionn-briefing-integracoes-reunioes-plano-ponta-a-ponta-2026-07-31.md`
**Data:** 31/07/2026
**Status:** pronto para execução da prova técnica; nenhuma mudança de produção autorizada
**Prioridade:** Microsoft Teams primeiro; Google Meet valida o contrato comum

## 1. Resultado esperado da Fase 0

Ao final da fase, o time deve conseguir recuperar, em ambientes de teste e com contas explicitamente autorizadas, uma reunião real de cada provedor, seus participantes e uma transcrição com timestamps. O resultado deve ser convertido para um fixture canônico, sem persistir credenciais ou mídia no repositório.

O gate somente é aprovado quando todos os critérios da seção 11 estiverem verdes. Até lá, não estão autorizados migrations, deploys, subscriptions/webhooks de produção, credenciais reais no banco ou sincronização automática.

## 2. Leitura arquitetural do estado atual

### 2.1 Componentes que serão preservados

| Capacidade | Implementação atual | Decisão |
|---|---|---|
| Briefing | `ai_briefings` e `create_ai_briefing` | Estender com vínculo de fonte; não substituir |
| Processamento | `process-ai-briefing` e `ai_briefing_runs` | Reusar após a normalização da transcrição |
| Evidência | `ai_suggestion_evidence` | Acrescentar origem canônica e offsets temporais em fase posterior |
| Revisão/aplicação | RPCs de revisão e aplicação | Manter revisão humana como invariante |
| Retenção/consumo | migrations `2026070916*` a `2026070923*` | Estender para artefatos e segmentos |
| Teams existente | `teams_integrations`, bot, cards e health | Reusar padrões operacionais, não credenciais nem modelo de domínio |
| Entitlements | `organization_entitlements` e catálogo SaaS | Acrescentar chaves, sem criar mecanismo paralelo |

### 2.2 Restrições identificadas

- `ai_briefings.source_type` aceita somente fontes manuais; a futura migration deverá acrescentar `meeting_transcript` sem quebrar os valores existentes.
- O conteúdo atual do briefing é texto contínuo; os segmentos temporais devem existir em tabela própria e gerar uma projeção textual determinística para a IA.
- A integração Teams existente é voltada a bot/notificações. O conector de reuniões precisa de consentimento, escopos, ciclo de token e health próprios.
- Adapter de provedor é código confiável de backend. O frontend nunca recebe client secret, refresh token ou permissão para chamar Graph/Meet diretamente.
- Os arquivos não versionados `src/features/briefing/types/meeting.ts` e `src/features/briefing/adapters/teams-adapter.ts` são apenas um experimento: o adapter consulta segredo pelo cliente Supabase, importa tipos por caminho inválido, usa tipos não declarados e possui erros sintáticos. Não deve ser promovido como baseline.

## 3. Arquitetura alvo e limites

```text
UI (caixa de entrada / revisão)
        |
        v
RPCs e Edge Functions autenticadas
        |
        +--> MeetingProviderAdapter (backend only)
        |       +--> Microsoft Graph
        |       +--> Google Meet API
        |       +--> Manual upload parser
        |
        +--> modelo canônico de reuniões
                |
                +--> projeção textual determinística
                +--> ai_briefings + briefing_source_links
                          |
                          v
                    process-ai-briefing
```

Invariantes:

1. `org_id` é derivado e validado no backend; nunca é confiado a partir do payload do browser.
2. Tokens ficam no Vault/serviço de segredos e são referenciados por identificador opaco.
3. A chave externa é escopada por conexão: `(connection_id, external_meeting_id)`.
4. Eventos entram primeiro em inbox idempotente e só depois alteram estado.
5. A máquina de estados é monotônica; regressão exige comando explícito de reprocessamento.
6. Vídeo não é copiado. URLs persistidas são referências do provedor, não bearer URLs duráveis.
7. Um briefing importado possui exatamente um vínculo primário com reunião/transcrição.
8. Toda sugestão aplicável mantém ao menos uma evidência validada.

## 4. Contrato canônico do conector

O contrato será implementado em Edge Functions/Deno, com tipos compartilhados em módulo backend. A UI consome DTOs sanitizados separados.

```ts
type MeetingProvider = "microsoft_teams" | "google_meet" | "manual";

interface MeetingProviderAdapter {
  readonly provider: MeetingProvider;
  beginAuthorization(input: AuthorizationRequest): Promise<AuthorizationRedirect>;
  completeAuthorization(input: AuthorizationCallback): Promise<ConnectionResult>;
  refresh(connection: SecretConnectionRef): Promise<TokenResult>;
  revoke(connection: SecretConnectionRef): Promise<void>;
  checkHealth(connection: SecretConnectionRef): Promise<ConnectionHealth>;
  listMeetings(input: ListMeetingsRequest): AsyncIterable<MeetingPage>;
  getMeeting(input: ProviderMeetingRef): Promise<CanonicalMeeting>;
  listParticipants(input: ProviderMeetingRef): Promise<CanonicalParticipant[]>;
  listArtifacts(input: ProviderMeetingRef): Promise<CanonicalArtifact[]>;
  getTranscript(input: ProviderArtifactRef): Promise<CanonicalTranscript>;
  classifyError(error: unknown): ProviderError;
}

interface CanonicalMeeting {
  provider: MeetingProvider;
  externalMeetingId: string;
  externalTenantId?: string;
  subject: string;
  organizer: CanonicalIdentity;
  startsAt: string;
  endsAt?: string;
  joinUrl?: string;
  recordingReferenceUrl?: string;
  status: "discovered" | "artifacts_pending" | "ready";
  sourceVersion: string;
}

interface CanonicalTranscriptSegment {
  externalSegmentId: string;
  participantExternalId?: string;
  speakerLabel: string;
  text: string;
  startMs: number;
  endMs: number;
  ordinal: number;
}

interface ProviderError {
  category: "auth" | "permission" | "rate_limit" | "not_found" |
    "artifact_pending" | "validation" | "provider";
  code: string;
  providerCode?: string;
  recoverable: boolean;
  retryAfterSeconds?: number;
  safeMessage: string;
}
```

Regras de normalização:

- timestamps são inteiros em milissegundos relativos ao início da reunião;
- datas absolutas são UTC ISO-8601;
- segmentos são ordenados por `(startMs, ordinal)` e não se sobrepõem artificialmente;
- texto preserva a fala literal, normalizando apenas quebras de linha e Unicode;
- `sourceVersion` identifica a versão do artefato e participa do hash;
- e-mail é opcional e nunca é usado como chave primária do participante;
- `recordingReferenceUrl` só é retornada após autorização e pode expirar.

## 5. Contratos de API propostos

Todos os endpoints exigem JWT Axionn, correlation ID e autorização organizacional no backend.

| Operação | Entrada essencial | Saída | Idempotência |
|---|---|---|---|
| `POST /meeting-connections/authorize` | provider, org | URL + state PKCE | state de uso único |
| `GET /meeting-connections/callback` | code, state | conexão sanitizada | state de uso único |
| `POST /meeting-connections/{id}/health` | connection id | status, scopes, erro seguro | correlation id |
| `DELETE /meeting-connections/{id}` | connection id | revogada | repetível |
| `POST /meeting-syncs` | connection id, intervalo | job id | client request id |
| `GET /external-meetings` | filtros e cursor | página sanitizada | leitura |
| `GET /external-meetings/{id}` | meeting id | preview + disponibilidade | leitura |
| `POST /external-meetings/{id}/imports` | team, project, sprint, tipo | processing job | meeting + source version |
| `POST /meeting-jobs/{id}/retry` | job id | nova tentativa | request id |
| `GET /meeting-jobs/{id}` | job id | etapa e progresso | leitura |

Erros usam envelope único:

```json
{
  "error": {
    "code": "MEETING_TRANSCRIPT_ACCESS_DISABLED",
    "message": "O tenant não permite acesso à transcrição.",
    "recoverable": false,
    "correlationId": "uuid"
  }
}
```

O browser nunca recebe erro bruto do provedor, token, secret reference ou payload integral de webhook.

## 6. Modelo SQL proposto (não executar nesta fase)

| Tabela | Campos essenciais | Restrições principais |
|---|---|---|
| `meeting_connections` | id, org_id, provider, mode, external_tenant_id, external_account_id, secret_ref, granted_scopes, status, sync_policy, retention_days, health_at, safe_error | unique org/provider/conta; sem token |
| `meeting_sync_cursors` | connection_id, cursor_type, cursor_value, window_start, window_end | unique conexão/tipo |
| `meeting_webhook_events` | connection_id, provider_event_id, event_type, payload_encrypted/ref, occurred_at, received_at, status, attempts, correlation_id | unique provider/conexão/evento |
| `external_meetings` | id, org_id, connection_id, external_meeting_id, tenant_key, subject, organizer data, starts_at, ends_at, state, source_version | unique conexão/external id; org denormalizada validada |
| `meeting_participants` | meeting_id, external_participant_id, display_name, email_encrypted, role, attended intervals | unique reunião/participante |
| `meeting_artifacts` | meeting_id, external_artifact_id, kind, status, language, provider_url/ref, source_version, available_at, expires_at, content_hash | unique reunião/artefato/versão |
| `meeting_transcript_segments` | artifact_id, external_segment_id, ordinal, participant_id, speaker_label, text, start_ms, end_ms, text_start, text_end, hash | unique artefato/ordinal; tempos e offsets válidos |
| `meeting_processing_jobs` | meeting_id, artifact_id, job_type, state, stage, attempts, max_attempts, retry_at, locked_at, correlation_id, safe_error | unique chave idempotente ativa |
| `briefing_source_links` | briefing_id, meeting_id, artifact_id, source_version, normalized_hash | briefing único; FKs restritas |

Extensões futuras:

- acrescentar `meeting_transcript` ao check de `ai_briefings.source_type`;
- acrescentar `artifact_id`, `segment_id`, `timestamp_start_ms`, `timestamp_end_ms`, `quote_hash` e `source_version` à evidência, mantendo os campos legados;
- projetar `source_content` como texto imutável derivado dos segmentos para manter compatibilidade com o processador atual;
- usar `ON DELETE RESTRICT` entre evidência e fonte enquanto houver briefing não anonimizado;
- políticas RLS repetem `org_id = organização ativa` e restringem reunião a admin ou membro da equipe associada;
- mutations críticas somente por RPC/Edge Function `security definer` endurecida e com `search_path` fixo.

## 7. Matriz RBAC e entitlements

### 7.1 Permissões

| Permissão | Owner/Admin | Gestor de equipe | Membro | Revisor | Backoffice |
|---|---:|---:|---:|---:|---:|
| `briefing.connections.view` | ✓ | — | — | — | somente suporte auditado |
| `briefing.connections.manage` | ✓ | — | — | — | — |
| `briefing.meetings.list` | ✓ | equipe | equipe | equipe | — |
| `briefing.meetings.import` | ✓ | equipe | equipe | equipe | — |
| `briefing.process` | ✓ | equipe | equipe | equipe | — |
| `briefing.review` | ✓ | equipe | — | equipe | — |
| `briefing.apply` | ✓ | equipe | — | equipe | — |
| `briefing.export` | ✓ | equipe | conforme política | equipe | — |
| `briefing.retention.manage` | ✓ | — | — | — | suporte autorizado |

“equipe” significa vínculo explícito em `team_members`; não basta pertencer à organização. Entitlement libera a capacidade comercial, mas não concede permissão. RBAC concede ação, mas não contorna entitlement.

### 7.2 Entitlements

- `briefing.integrations.enabled`
- `briefing.integrations.teams`
- `briefing.integrations.meet`
- `briefing.integrations.auto_sync`
- `briefing.recording_access`
- `briefing.cross_meeting_insights`
- `briefing.integrations.meetings_monthly`
- `briefing.integrations.minutes_monthly`
- `briefing.integrations.connections_max`
- `briefing.integrations.retention_days_max`

## 8. Backlog executável

### Épico E0.1 — Governança e segurança

- **US-01:** Como administrador, quero entender dados e permissões antes de consentir. Aceite: tela/roteiro lista escopos, finalidade, retenção, revogação e ausência de cópia do vídeo.
- **US-02:** Como DPO/segurança, quero uma decisão registrada de retenção e consentimento. Aceite: ADR aprovado com responsáveis e prazo.
- Tarefas: matriz de dados; threat model STRIDE; política de logs; classificação PII; runbook de revogação; checklist cross-tenant.

### Épico E0.2 — Prova Microsoft Teams

- **US-03:** Como pesquisador técnico, quero recuperar uma transcrição real do Teams com menor privilégio. Aceite: fixture anonimizado contém reunião, participantes, segmentos e timestamps.
- **US-04:** Como administrador Microsoft, quero distinguir consentimento delegado e application access policy. Aceite: matriz documenta ambos e o erro `GraphAccessToTranscriptsDisabled`.
- Tarefas: registrar app de teste; OAuth PKCE; obter reunião; listar transcripts; baixar conteúdo; validar recording reference; registrar paginação, throttling e latência.

### Épico E0.3 — Prova Google Meet

- **US-05:** Como pesquisador técnico, quero recuperar conference record e transcript entries sem escopo Drive quando possível. Aceite: fixture anonimizado equivalente ao Teams.
- **US-06:** Como administrador Google, quero conhecer expiração e limites dos artefatos. Aceite: janela de disponibilidade e estratégia de reconciliação registradas.
- Tarefas: app OAuth de teste; consent screen; listar conference records; participantes; transcripts/entries; testar link da gravação; documentar necessidade ou dispensa de `drive.meet.readonly`.

### Épico E0.4 — Contrato e fixtures

- **US-07:** Como desenvolvedor, quero o mesmo contrato para ambos os provedores. Aceite: fixtures passam no mesmo schema e preservam speaker/timestamp.
- Tarefas: schema Zod/JSON; fixtures sanitizados; validador de ordenação/offsets; catálogo de erros; ADR de idempotência; teste de golden file.

### Épico E0.5 — Produto e operação

- **US-08:** Como usuário, quero saber por que uma reunião não pode ser importada. Aceite: cada estado parcial possui mensagem segura e próxima ação.
- **US-09:** Como operação, quero medir viabilidade e custo. Aceite: planilha registra chamadas, minutos, latência, erros e custo estimado por reunião.
- Tarefas: wireframes; mapa de estados; SLO inicial; dashboard proposto; matriz go/no-go; estimativa de Fases 1–3 revisada.

## 9. Wireframes funcionais

### 9.1 Conexões

```text
[Briefing]  Visão geral | Reuniões | Briefings | Acompanhamento | Conexões

Microsoft Teams                         [Conectar / Reautorizar]
Status: Saudável     Última verificação: 10:42
Conta: adm***@empresa.com   Escopos: [ver detalhes]
Sincronização: Manual        Retenção: 90 dias
[Testar conexão] [Configurar] [Revogar]
```

### 9.2 Caixa de entrada

```text
Reuniões                      [Data] [Provedor] [Equipe] [Estado] [Buscar]
----------------------------------------------------------------------------
Planning Produto   Teams   Hoje 09:00   8 participantes   Transcrição pronta
Daily Plataforma   Meet    Hoje 08:30   6 participantes   Aguardando artefatos
Review Q3           Teams   Ontem        12 participantes  Sem transcrição
                                                   [Abrir preview]
```

### 9.3 Wizard de importação

```text
1 Reunião > 2 Contexto > 3 Confirmar

Equipe* [____]  Projeto [____]  Sprint [____]  Tipo* [Planning]
Fonte: transcrição oficial, pt-BR, 54 min, 1.246 segmentos
O vídeo permanecerá no provedor.
                                      [Voltar] [Gerar briefing]
```

### 9.4 Revisão

```text
Transcrição (speaker + 00:18:42) | Relatório e sugestões
[buscar] [abrir gravação]         | [aprovar] [editar] [rejeitar]
trecho destacado                  | evidência: speaker + timestamp
```

Mobile usa abas “Transcrição” e “Relatório”, drawer para evidência e barra fixa com ações; todos os alvos têm no mínimo 44px.

## 10. Roteiros das provas técnicas

### 10.1 Teams

1. Criar tenant/app exclusivamente de teste e registrar owner e data de expiração.
2. Configurar redirect URI local/staging, PKCE e menor conjunto de escopos.
3. Realizar uma reunião consentida com dois speakers, gravação e transcrição.
4. Obter reunião e transcrição via Graph usando conexão delegada do organizador.
5. Verificar paginação, idiomas, participantes, unidades de tempo e deep link.
6. Revogar consentimento e confirmar falha classificada como `auth`, sem vazamento de token.
7. Desabilitar/indisponibilizar transcrição e confirmar branch específica.
8. Repetir a mesma importação e provar igualdade do hash/idempotency key.
9. Anonimizar fixture; remover IDs, e-mails, URLs assinadas e conteúdo sensível.

### 10.2 Google Meet

1. Criar projeto/app exclusivamente de teste e consent screen interno.
2. Começar com `meetings.space.readonly`; só adicionar Drive se evidência demonstrar necessidade.
3. Realizar reunião consentida com dois speakers, gravação e transcrição.
4. Obter conference record, participants, participant sessions, transcript e entries.
5. Medir tempo entre término e disponibilidade de cada artefato.
6. Validar acesso/revogação e erro quando o usuário não é autorizado.
7. Verificar expiração dos transcript entries e necessidade de ingestão rápida.
8. Repetir normalização e comparar ao schema usado no Teams.
9. Anonimizar fixture com os mesmos controles do roteiro Teams.

Cada execução gera um relatório com: data, operador, conta de teste, escopos, endpoints, status HTTP, request/correlation ID, latência, paginação, limites, artefatos disponíveis, decisão e evidências sanitizadas.

## 11. Critérios executáveis e gate

| ID | Verificação | Evidência | Obrigatório |
|---|---|---|---:|
| G-01 | Uma transcrição real recuperada de cada provedor | relatórios + fixtures | ✓ |
| G-02 | Schema canônico valida os dois fixtures | teste automatizado verde | ✓ |
| G-03 | Todo segmento possui texto, ordinal e intervalo válido | teste de contrato | ✓ |
| G-04 | Speakers/participantes são preservados ou ausência é explícita | relatório | ✓ |
| G-05 | Deep link/timestamp funciona ou limitação está documentada | gravação de teste | ✓ |
| G-06 | Tenant/conta não autorizada não acessa artefato | teste negativo | ✓ |
| G-07 | Token revogado produz erro sanitizado e recuperável correto | teste negativo | ✓ |
| G-08 | Repetição produz mesma chave e não duplica importação | teste de idempotência | ✓ |
| G-09 | Nenhum segredo/PII consta em fixture, log ou git diff | scanner + revisão | ✓ |
| G-10 | Retenção, consentimento e owner operacional aprovados | ADR assinado | ✓ |
| G-11 | Custo/minuto e limites conhecidos com margem de erro declarada | relatório de custo | ✓ |
| G-12 | Transcript-first confirmado; vídeo não copiado | ADR | ✓ |

Comandos previstos quando os artefatos de teste existirem:

```text
npx vitest run src/features/briefing/contracts
npx eslint src/features/briefing
npm run build
supabase db lint
git diff --check
```

Decisão do gate:

- **GO:** G-01 a G-12 verdes; iniciar Fase 1 com migrations revisadas e feature flag desligada.
- **GO COM RESTRIÇÃO:** apenas limitação não crítica, com owner, prazo e fallback manual aceito.
- **NO-GO:** isolamento cross-tenant, consentimento, timestamps, transcrição ou custo sem resposta.

## 12. Sequência recomendada após o gate

1. ADRs e schema canônico aprovados.
2. Fase 1: migrations, RLS/pgTAP, entitlements e job inbox, todos atrás de flag.
3. Backend Teams MVP com conexão delegada e importação manual.
4. UI da caixa de entrada e revisão temporal.
5. Piloto Teams por organização allowlisted.
6. Google Meet implementado contra o mesmo contrato.
7. Somente após métricas do fluxo manual: webhooks, subscriptions e auto-sync.

## 13. Definition of Done da Fase 0

- dois relatórios de PoC revisados;
- dois fixtures sanitizados versionáveis;
- contrato canônico validado automaticamente;
- matriz de permissões por provedor;
- ADRs de segurança, retenção, idempotência e transcript-first;
- wireframes aprovados por produto e acessibilidade;
- estimativa de custo e capacidade;
- decisão GO/NO-GO registrada;
- nenhuma credencial, token, transcrição real ou mídia sensível adicionada ao repositório.
