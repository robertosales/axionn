# Deploy e smoke test — integrações e health operacional

## Objetivo

Publicar as Edge Functions já instrumentadas com health operacional e validar o fluxo básico em ambiente Lovable, sem alterar dados sensíveis ou migrations.

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

1. Enviar um webhook controlado com header x-integration-id.
2. Confirmar resposta HTTP 200 e correlation_id.
3. Confirmar registro em integration_health_events com provider = 'git'.

### 2.2 Teams bot

1. Enviar uma atividade de mensagem para o bot com tenant sem integração configurada.
2. Confirmar resposta HTTP 200.
3. Confirmar health degradado com error_code = 'INTEGRATION_NOT_CONFIGURED'.

### 2.3 Redmine sync

1. Enviar uma sincronização controlada com x-integration-id.
2. Confirmar resposta HTTP 200 e correlation_id.
3. Confirmar last_sync_status e health com provider = 'redmine'.

### 2.4 Oracle sync

1. Acionar um job controlado ativo.
2. Confirmar resposta HTTP 200.
3. Confirmar health degradado com ORACLE_CONNECTOR_NOT_CONFIGURED e simulated = true.

### 2.5 APEX webhook

1. Enviar um webhook controlado com application_id conhecido.
2. Confirmar resposta HTTP 200 ou 409/401 conforme o cenário.
3. Confirmar health com provider = 'apex'.

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
