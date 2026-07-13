# Deploy e smoke test — integrações e health operacional

## Objetivo

Registrar o rollout real realizado no Lovable Cloud, consolidar os resultados observados e preservar a sequência de validação para a equipe.

## Resumo do que foi feito pelo Lovable

### 1. Deploy inicial das 5 Edge Functions

- git-webhook-handler
- teams-bot
- redmine-sync
- oracle-sync
- apex-webhook

Todas foram publicadas com sucesso.

### 2. Smoke test inicial — resultados observados

- git-webhook-handler: retornou 404 controlado quando a integração não existia.
- teams-bot: retornou 500 por crash com erro `Cannot read properties of undefined (reading 'id')`.
- redmine-sync: retornou 500 com `throw new Error('Integration not found')`, que estava sendo engolido no catch.
- oracle-sync: retornou 500 com `throw new Error('Job not found')` e um bug de hoisting em `issuesFailed`.
- apex-webhook: retornou 404 controlado.

### 3. Correções aplicadas

#### teams-bot

- Guarda contra payload malformado: valida `activity.type` no início.
- Para `type=message` sem `from/conversation`, passou a retornar `200` com `error_code = INVALID_MESSAGE_ACTIVITY` em vez de crashar.

#### redmine-sync

- `Integration not found` agora retorna `409 INTEGRATION_NOT_FOUND` com `correlation_id`, em vez de `500`.
- Bug corrigido no bloco de conclusão: o update de `last_sync_status` e o `recordRedmineHealth` estavam referenciando `issuesFailed/issuesProcessed/...` antes da declaração das variáveis. O fluxo foi reorganizado para executar após o processamento completar e popular os contadores.

#### oracle-sync

- `Job not found` agora retorna `409 JOB_NOT_FOUND` com `correlation_id`, em vez de `500`.

### 4. Deploy dos ajustes + smoke test final

- teams-bot: `200` com `{ success: true, correlation_id }`
- redmine-sync: `409 INTEGRATION_NOT_FOUND` com `correlation_id`
- oracle-sync: `409 JOB_NOT_FOUND` com `correlation_id`

O contrato passou a cumprir o esperado: cenários de not found/inactive retornam código controlado e o `500` genérico não vaza mais.

### 5. Limitação observada

Nenhuma integração de `git`, `teams`, `redmine`, `oracle` ou `apex` estava cadastrada no banco. Por isso, os caminhos `healthy` com registro em `integration_health_events` não puderam ser exercitados.

Para validar esse fluxo, é preciso cadastrar ao menos uma integração ativa por provider, ou criar seeds de teste específicos.

### 6. Correção de segurança aplicada em paralelo

Também foi corrigido um finding `error-level` do scanner: as policies `SELECT` de `ai_briefing_runs`, `ai_briefing_suggestions`, `ai_suggestion_evidence` e `ai_suggestion_applications` faziam apenas `EXISTS` no briefing sem revalidar `org/team`, permitindo leitura cross-organização. Elas foram recriadas via migration chamando `public.can_access_ai_briefing(briefing.org_id, briefing.team_id)`, alinhando ao padrão de `ai_briefings_member_select`.

## Funções alvo

- git-webhook-handler
- teams-bot
- redmine-sync
- oracle-sync
- apex-webhook

## Pré-requisitos

- Supabase CLI instalado e autenticado.
- Projeto remoto correto apontado pelo arquivo de configuração local.
- Credenciais de ambiente do projeto remoto disponíveis para deploy.
- Acesso ao SQL Editor do Lovable para validar registros de health.

## Passo 1 — Deploy das funções

Executar, na raiz do projeto:

```powershell
npx supabase functions deploy git-webhook-handler
npx supabase functions deploy teams-bot
npx supabase functions deploy redmine-sync
npx supabase functions deploy oracle-sync
npx supabase functions deploy apex-webhook
```

> Não executar contra um projeto diferente do Lovable Cloud vinculado à aplicação.

## Passo 2 — Smoke test por função

### 2.1 Git webhook

1. Enviar um webhook controlado com header `x-integration-id`.
2. Confirmar resposta HTTP `200` e `correlation_id`.
3. Confirmar registro em `integration_health_events` com `provider = 'git'`.

### 2.2 Teams bot

1. Enviar uma atividade de mensagem para o bot com tenant sem integração configurada.
2. Confirmar resposta HTTP `200`.
3. Confirmar health degradado com `error_code = 'INTEGRATION_NOT_CONFIGURED'`.

### 2.3 Redmine sync

1. Enviar uma sincronização controlada com `x-integration-id`.
2. Confirmar resposta HTTP `200` e `correlation_id`.
3. Confirmar `last_sync_status` e health com `provider = 'redmine'`.

### 2.4 Oracle sync

1. Acionar um job controlado ativo.
2. Confirmar resposta HTTP `200`.
3. Confirmar health degradado com `ORACLE_CONNECTOR_NOT_CONFIGURED` e `simulated = true`.

### 2.5 APEX webhook

1. Enviar um webhook controlado com `application_id` conhecido.
2. Confirmar resposta HTTP `200` ou `409/401` conforme o cenário.
3. Confirmar health com `provider = 'apex'`.

## Passo 3 — Consultas de validação SQL

```sql
select provider, integration_id, status, check_type, latency_ms,
       error_code, error_message, details, checked_at, correlation_id
from public.integration_health_events
where provider in ('git','teams','redmine','oracle','apex')
order by checked_at desc
limit 50;
```

## Critério de sucesso

- Todas as funções retornam resposta válida.
- Os eventos de health são registrados sem expor segredos.
- Os cenários inativos e placeholders continuam operando de forma degradada e transparente.
