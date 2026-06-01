# Configurar a fila APF no Lovable

O sistema de fila assíncrona (`apf_jobs`) precisa de 2 configurações que não podem ser feitas via SQL: os Secrets no Lovable e o Webhook de banco.

---

## 1. Adicionar Secrets no Lovable

No painel do **Lovable**:

1. Acesse **Settings** (engrenagem) → **Secrets** (ou **Environment Variables**)
2. Adicione os dois secrets abaixo:

| Nome | Valor |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | A service role key do projeto (já usada pelas Edge Functions) |
| `SUPABASE_URL` | A URL do projeto, ex: `https://xyzxyz.supabase.co` |

> **Onde encontrar esses valores:** no Lovable, vá em **Settings → Supabase** ou abra qualquer Edge Function e veja os valores de `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` que já estão injetados automaticamente.

---

## 2. Configurar o Webhook de banco

O webhook é o mecanismo que dispara o worker (`process-apf-job`) **imediatamente** quando um job é inserido na fila. Sem ele, o job aguarda até 1 minuto (safety net do cron).

No painel do **Lovable**:

1. Acesse **Database** → **Webhooks** (ou **Supabase Dashboard → Database → Webhooks**)
2. Clique em **Create a new hook**
3. Preencha:

| Campo | Valor |
|---|---|
| Name | `apf-job-inserted` |
| Table | `apf_jobs` |
| Events | `INSERT` |
| Type | **Supabase Edge Functions** |
| Edge Function | `process-apf-job` |
| Method | `POST` |
| Timeout | `5000` ms |

4. Confirme.

---

## 3. Verificar se está funcionando

Apresentamos no SQL Editor do Lovable:

```sql
-- Ver jobs recentes
SELECT id, status, attempts, created_at, started_at, finished_at
FROM apf_jobs
ORDER BY created_at DESC
LIMIT 10;

-- Ver crons registrados
SELECT jobname, schedule, active
FROM cron.job;

-- Ver se há jobs presos
SELECT count(*)
FROM apf_jobs
WHERE status = 'pending'
  AND next_attempt_at < now() - INTERVAL '2 minutes';
```

---

## 4. Fallback automático (já está ativo)

Mesmo sem o webhook configurado, o cron `apf-jobs-safety-net` (a cada 1 minuto) processa qualquer job pendente preso. Nenhum job fica perdido.

---

## Resumo do fluxo

```
Frontend clica "Gerar APF"
  ↓
INSERT apf_jobs (status=pending)  <-- retorna job_id em <100ms
  ↓
Webhook dispara process-apf-job  (se configurado: <1s)
  OU
Cron safety net (fallback: até 60s)
  ↓
Worker chama apf-generate → IA processa (3-15s)
  ↓
apf_jobs.status = 'done'
  ↓
Realtime notifica frontend → exibe resultado
```
