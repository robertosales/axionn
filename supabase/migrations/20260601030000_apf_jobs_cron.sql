-- ============================================================
-- apf_jobs — cron de limpeza e safety net
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- O pg_cron depende de configuração do servidor e pode estar indisponível no
-- banco efêmero do CI. A migration preserva as tabelas e funções mesmo quando
-- o agendamento precisa ser concluído posteriormente no ambiente hospedado.
DO $do$
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE WARNING 'apf_cron_deferred: cron.job unavailable';
    RETURN;
  END IF;

  -- Remove jobs anteriores pelo jobid. Isso evita a exceção produzida por
  -- cron.unschedule(text) quando o nome ainda não existe no catálogo local.
  PERFORM cron.unschedule(job.jobid)
    FROM cron.job job
   WHERE job.jobname IN ('apf-jobs-cleanup', 'apf-jobs-safety-net');

  BEGIN
    PERFORM cron.schedule(
      'apf-jobs-cleanup',
      '0 3 * * *',
      $command$
        DELETE FROM public.apf_jobs
        WHERE status IN ('done', 'dead')
          AND finished_at < now() - INTERVAL '7 days';
      $command$
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'apf_cleanup_cron_deferred: %', SQLERRM;
  END;

  BEGIN
    PERFORM cron.schedule(
      'apf-jobs-safety-net',
      '* * * * *',
      $command$
        SELECT net.http_post(
          url := public.get_project_api_url() || '/functions/v1/process-apf-job',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || public.get_service_role_key()
          ),
          body := '{}'::jsonb
        )
        WHERE EXISTS (
          SELECT 1
          FROM public.apf_jobs
          WHERE status = 'pending'
            AND next_attempt_at <= now()
          LIMIT 1
        );
      $command$
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'apf_safety_net_cron_deferred: %', SQLERRM;
  END;
END;
$do$;

COMMENT ON EXTENSION pg_cron IS
  'Agenda limpeza e safety net de apf_jobs quando o ambiente suporta pg_cron.';

COMMENT ON EXTENSION pg_net IS
  'Utilizado pelo safety net APF para acionar a Edge Function process-apf-job.';
