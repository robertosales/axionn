-- ============================================================
-- apf_jobs — Automação: cron de limpeza + safety net
--
-- Dependência: extensão pg_cron habilitada no Supabase
-- (Dashboard > Database > Extensions > pg_cron)
--
-- Jobs criados:
--
--   1. apf-jobs-cleanup (diário às 03:00 UTC)
--      Remove jobs done/dead com mais de 7 dias.
--      Mantém a tabela enxuta sem crescimento indefinido.
--
--   2. apf-jobs-safety-net (a cada 60s)
--      Processa jobs pending que ficaram presos
--      (ex: webhook falhou, worker travou).
--      Usa pg_net para chamar a Edge Function.
--
-- Nota: O webhook primário (INSERT → process-apf-job) deve ser
-- configurado no Dashboard do Supabase — não é possível via SQL.
-- Ver: docs/apf-jobs-webhook-setup.md
-- ============================================================

-- Garante que pg_cron está disponível
-- (no Supabase já vem habilitado em projetos pagos)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── 1. Limpeza diária de jobs antigos ─────────────────────────────────
SELECT cron.unschedule('apf-jobs-cleanup');

SELECT cron.schedule(
  'apf-jobs-cleanup',
  '0 3 * * *',   -- 03:00 UTC todos os dias
  $$
    DELETE FROM public.apf_jobs
    WHERE status IN ('done', 'dead')
      AND finished_at < now() - INTERVAL '7 days';
  $$
);

COMMENT ON EXTENSION pg_cron IS
  'apf-jobs-cleanup: deleta apf_jobs done/dead com mais de 7 dias. '
  'Roda diáriamente às 03:00 UTC.';

-- ── 2. Safety net: reprocessa pending presos a cada 60s ─────────────────
SELECT cron.unschedule('apf-jobs-safety-net');

SELECT cron.schedule(
  'apf-jobs-safety-net',
  '* * * * *',   -- a cada minuto (pg_cron mínimo = 1 min)
  $$
    SELECT net.http_post(
      url        := current_setting('app.supabase_url') || '/functions/v1/process-apf-job',
      headers    := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body       := '{}'
    )
    WHERE EXISTS (
      SELECT 1 FROM public.apf_jobs
      WHERE status = 'pending'
        AND next_attempt_at <= now()
      LIMIT 1
    );
  $$
);

COMMENT ON EXTENSION pg_net IS
  'apf-jobs-safety-net: dispara process-apf-job a cada 1 min '
  'quando há jobs pending presos (webhook falhou). '
  'Requer app.supabase_url e app.service_role_key configurados '
  'em Database > Settings > Configuration > Custom config.';
