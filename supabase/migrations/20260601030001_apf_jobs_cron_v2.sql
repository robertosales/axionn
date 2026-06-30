-- ============================================================
-- apf_jobs — Automação v2 sem custom settings
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.get_project_api_url()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_url text;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RAISE EXCEPTION 'vault_unavailable';
  END IF;

  SELECT secret.decrypted_secret
    INTO v_url
    FROM vault.decrypted_secrets secret
   WHERE secret.name = 'SUPABASE_URL'
   LIMIT 1;

  IF v_url IS NULL OR trim(v_url) = '' THEN
    RAISE EXCEPTION 'supabase_url_not_configured';
  END IF;

  RETURN rtrim(v_url, '/');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_service_role_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault, pg_temp
AS $$
DECLARE
  v_key text;
BEGIN
  IF to_regclass('vault.decrypted_secrets') IS NULL THEN
    RAISE EXCEPTION 'vault_unavailable';
  END IF;

  SELECT secret.decrypted_secret
    INTO v_key
    FROM vault.decrypted_secrets secret
   WHERE secret.name IN ('SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY')
   ORDER BY secret.name
   LIMIT 1;

  IF v_key IS NULL OR trim(v_key) = '' THEN
    RAISE EXCEPTION 'service_role_key_not_configured';
  END IF;

  RETURN v_key;
END;
$$;

REVOKE ALL ON FUNCTION public.get_project_api_url()
  FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_service_role_key()
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_project_api_url() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_service_role_key() TO service_role;

DO $do$
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE WARNING 'apf_cron_v2_deferred: cron.job unavailable';
    RETURN;
  END IF;

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
    RAISE WARNING 'apf_cleanup_cron_v2_deferred: %', SQLERRM;
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
            'Authorization', 'Bearer ' || public.get_service_role_key(),
            'apikey', public.get_service_role_key()
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
    RAISE WARNING 'apf_safety_net_cron_v2_deferred: %', SQLERRM;
  END;
END;
$do$;

COMMENT ON FUNCTION public.get_project_api_url() IS
  'Lê SUPABASE_URL do Vault para chamadas internas do backend.';

COMMENT ON FUNCTION public.get_service_role_key() IS
  'Lê a service role key do Vault; execução exclusiva do service_role.';
