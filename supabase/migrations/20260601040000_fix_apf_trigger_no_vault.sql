-- ============================================================
-- Fix: fn_notify_apf_job_ready sem depender do Vault
--
-- O Vault (get_project_api_url / get_service_role_key) pode
-- não estar configurado. Esta migration reescreve a função
-- usando app.settings que o Supabase injeta automaticamente.
-- ============================================================

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
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  -- Usa app.settings injetados pelo Supabase (sem Vault)
  BEGIN
    v_url := current_setting('app.supabase_url',    true);
    v_key := current_setting('app.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    v_url := NULL;
    v_key := NULL;
  END;

  -- Fallback: tenta nomes alternativos
  IF v_url IS NULL OR v_url = '' THEN
    BEGIN
      v_url := current_setting('supabase.url', true);
    EXCEPTION WHEN OTHERS THEN
      v_url := NULL;
    END;
  END IF;

  IF v_key IS NULL OR v_key = '' THEN
    BEGIN
      v_key := current_setting('supabase.service_role_key', true);
    EXCEPTION WHEN OTHERS THEN
      v_key := NULL;
    END;
  END IF;

  IF v_url IS NULL OR v_url = '' OR v_key IS NULL OR v_key = '' THEN
    RAISE WARNING 'fn_notify_apf_job_ready: URL ou key não encontrados – job % ficará pending até o frontend chamar triggerApfWorker()', NEW.id;
    RETURN NEW;
  END IF;

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
  RAISE WARNING 'fn_notify_apf_job_ready HTTP error: %', SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION fn_notify_apf_job_ready IS
  'Trigger: dispara pg_net HTTP POST para process-apf-job quando job fica pending. '
  'Usa app.settings (sem Vault).';
