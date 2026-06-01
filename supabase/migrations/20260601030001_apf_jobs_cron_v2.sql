-- ============================================================
-- apf_jobs — Automação v2: sem dependência de custom settings
--
-- Esta migration substitui 20260601030000 (que usava
-- current_setting('app.supabase_url') e app.service_role_key,
-- requerendo configuração manual no Dashboard do Supabase).
--
-- No Lovable o banco é gerenciado pelo próprio Lovable —
-- não há acesso ao Dashboard do Supabase para setar custom config.
--
-- Solução:
--   - URL do projeto derivada de vault.secrets (SUPABASE_URL)
--     já presente em todo projeto Lovable
--   - Service role key lida de vault.secrets (SERVICE_ROLE_KEY)
--     já injetada automaticamente pelo Lovable
--   - Cleanup cron é puro SQL — sem dependência externa
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove os jobs da v1 se existirem
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN ('apf-jobs-cleanup', 'apf-jobs-safety-net');

-- ── Função auxiliar: lê a URL do projeto do Vault ────────────────────
CREATE OR REPLACE FUNCTION get_project_api_url()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
BEGIN
  -- Tenta ler do Vault (Lovable injeta SUPABASE_URL automaticamente)
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
   WHERE name = 'SUPABASE_URL'
   LIMIT 1;

  IF v_url IS NOT NULL AND v_url <> '' THEN
    RETURN rtrim(v_url, '/');
  END IF;

  -- Fallback: lê do issuer JWT configurado no banco
  SELECT replace(
    (SELECT current_setting('app.settings.jwt_secret', true)),
    '', ''
  ) INTO v_url;

  RAISE EXCEPTION
    'Não foi possível determinar a URL do projeto. '
    'Configure SUPABASE_URL no Vault do Lovable (Settings > Secrets).';
END;
$$;

-- ── Função auxiliar: lê a service role key do Vault ─────────────────
CREATE OR REPLACE FUNCTION get_service_role_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
   WHERE name IN ('SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY')
   ORDER BY name
   LIMIT 1;

  IF v_key IS NOT NULL AND v_key <> '' THEN
    RETURN v_key;
  END IF;

  RAISE EXCEPTION
    'Service role key não encontrada no Vault. '
    'Adicione SUPABASE_SERVICE_ROLE_KEY em Settings > Secrets no Lovable.';
END;
$$;

REVOKE ALL ON FUNCTION get_project_api_url()   FROM PUBLIC;
REVOKE ALL ON FUNCTION get_service_role_key()  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_project_api_url()  TO service_role;
GRANT EXECUTE ON FUNCTION get_service_role_key() TO service_role;

-- ── 1. Limpeza diária de jobs antigos (puro SQL, sem dependência) ─────
SELECT cron.schedule(
  'apf-jobs-cleanup',
  '0 3 * * *',
  $$
    DELETE FROM public.apf_jobs
    WHERE status IN ('done', 'dead')
      AND finished_at < now() - INTERVAL '7 days';
  $$
);

-- ── 2. Safety net: reprocessa pending presos a cada 1 minuto ──────────
-- Leitura do Vault acontece em runtime (não no momento do schedule).
SELECT cron.schedule(
  'apf-jobs-safety-net',
  '* * * * *',
  $$
    DO $$
    DECLARE
      v_url  text := get_project_api_url();
      v_key  text := get_service_role_key();
      v_has_pending boolean;
    BEGIN
      SELECT EXISTS (
        SELECT 1 FROM public.apf_jobs
        WHERE status = 'pending'
          AND next_attempt_at <= now()
        LIMIT 1
      ) INTO v_has_pending;

      IF v_has_pending THEN
        PERFORM net.http_post(
          url        := v_url || '/functions/v1/process-apf-job',
          headers    := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || v_key,
            'apikey',        v_key
          ),
          body       := '{}'
        );
      END IF;
    END;
    $$;
  $$
);

COMMENT ON FUNCTION get_project_api_url IS
  'Lê a URL do projeto do Vault (SUPABASE_URL). '
  'Usada pelo cron safety net sem dependência de custom settings.';

COMMENT ON FUNCTION get_service_role_key IS
  'Lê a service role key do Vault (SUPABASE_SERVICE_ROLE_KEY). '
  'Usada pelo cron safety net sem dependência de custom settings.';
