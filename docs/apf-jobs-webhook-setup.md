# Configurar Webhook: apf_jobs INSERT → process-apf-job

O webhook é o mecanismo **primário** para disparar o worker imediatamente quando um job é inserido. O safety net via pg_cron (a cada 1 min) é o fallback.

## Por que não está no SQL

Webhooks do Supabase são configurados via API interna do painel. Não há SQL equivalente que rode em migrations padrão.

## Passo a passo

1. Acesse o **Dashboard do Supabase** → projeto usesprintflow
2. Menu lateral: **Database** → **Webhooks**
3. Clique em **Create a new hook**
4. Preencha:

| Campo | Valor |
|---|---|
| Name | `apf-job-inserted` |
| Table | `apf_jobs` |
| Events | `INSERT` |
| Type | **Supabase Edge Functions** |
| Edge Function | `process-apf-job` |
| HTTP Method | `POST` |
| Timeout | `5000 ms` |

5. Em **HTTP Headers**, adicione:
   - `Content-Type: application/json`

6. Clique em **Confirm**

## Verificar se está funcionando

Após configurar, gere um APF pelo sistema. No Dashboard:
- **Database → Webhooks → apf-job-inserted → Logs**
- Deve aparecer uma chamada com status `200` para cada job inserido

## Safety net (backup automático)

A migration `20260601030000_apf_jobs_cron.sql` já configurou um pg_cron a cada 1 minuto que verifica se há jobs `pending` presos e dispara o worker. Mesmo se o webhook falhar, nenhum job fica perdido por mais de 1 minuto.

## Configuração das variáveis do cron

Para o safety net funcionar, configure em **Database → Settings → Configuration → Custom config**:

```
app.supabase_url = https://<seu-projeto>.supabase.co
app.service_role_key = <service_role_key>
```

Ou, alternativamente, substitua `current_setting('app.supabase_url')` pelo valor hardcoded na migration se preferir simplicidade.
