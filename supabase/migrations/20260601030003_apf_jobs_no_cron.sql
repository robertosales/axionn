-- ============================================================
-- APF Jobs: processamento event-driven SEM pg_cron
--
-- O Lovable não habilita pg_cron. Esta migration substitui
-- a abordagem cron por triggers pg_net:
--
--  1. fn_notify_apf_job_ready:
--     Dispara HTTP POST para a Edge Function sempre que
--     um job entra no estado 'pending'.
--
--  2. fn_apf_jobs_cleanup:
--     Remove jobs com mais de 7 dias a cada INSERT
--     (safety-net leve, sem custo de cron).
-- ============================================================

-- Garante pg_net disponível (já habilitado no Lovable por padrão)
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- ------------------------------------------------------------
-- 1. Função que notifica a Edge Function via HTTP
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_notify_apf_job_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url  text;
  v_key  text;
BEGIN
  -- Só aciona quando o job fica 'pending'
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  -- Lê secrets do Vault (nomes do Lovable)
  BEGIN
    v_url := get_project_api_url();
    v_key := get_service_role_key();
  EXCEPTION WHEN OTHERS THEN
    -- Se Vault não configurado, apenas loga e segue
    RAISE WARNING 'fn_notify_apf_job_ready: Vault não configurado – %', SQLERRM;
    RETURN NEW;
  END;

  -- Dispara HTTP assíncrono (não bloqueia a transação)
  PERFORM extensions.http_post(
    url     := v_url || '/functions/v1/process-apf-job',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object('job_id', NEW.id)::text
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca bloqueia o INSERT/UPDATE por falha de HTTP
  RAISE WARNING 'fn_notify_apf_job_ready HTTP error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Trigger: INSERT ou UPDATE quando status muda para pending
DROP TRIGGER IF EXISTS trg_apf_job_notify ON apf_jobs;
CREATE TRIGGER trg_apf_job_notify
  AFTER INSERT OR UPDATE OF status
  ON apf_jobs
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_apf_job_ready();

-- ------------------------------------------------------------
-- 2. Safety-net: limpeza de jobs antigos a cada INSERT
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_apf_jobs_cleanup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove jobs terminados com mais de 7 dias
  DELETE FROM apf_jobs
   WHERE status IN ('completed', 'failed', 'cancelled')
     AND created_at < NOW() - INTERVAL '7 days';
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_apf_jobs_cleanup error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apf_jobs_cleanup ON apf_jobs;
CREATE TRIGGER trg_apf_jobs_cleanup
  AFTER INSERT
  ON apf_jobs
  FOR EACH STATEMENT
  EXECUTE FUNCTION fn_apf_jobs_cleanup();

-- Permissões
REVOKE ALL ON FUNCTION fn_notify_apf_job_ready() FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_apf_jobs_cleanup()     FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_notify_apf_job_ready() TO service_role;
GRANT EXECUTE ON FUNCTION fn_apf_jobs_cleanup()     TO service_role;

COMMENT ON FUNCTION fn_notify_apf_job_ready IS
  'Trigger: dispara pg_net HTTP POST para process-apf-job quando job fica pending.';
COMMENT ON FUNCTION fn_apf_jobs_cleanup IS
  'Trigger safety-net: remove jobs antigos (>7d) a cada INSERT em apf_jobs.';
