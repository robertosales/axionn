-- ============================================================
-- Corrige os nomes dos secrets no Vault
--
-- A migration 20260601030001 buscava:
--   SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
--
-- No Lovable os nomes reais são:
--   APP_SUPABASE_URL   (URL do projeto)
--   APP_SUPABASE_KEY   (service role key)
--
-- Esta migration substitui as duas funções com os nomes corretos.
-- ============================================================

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
  -- Lovable injeta como APP_SUPABASE_URL
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
   WHERE name IN ('APP_SUPABASE_URL', 'SUPABASE_URL')
   ORDER BY
     CASE name
       WHEN 'APP_SUPABASE_URL' THEN 1
       WHEN 'SUPABASE_URL'     THEN 2
       ELSE 3
     END
   LIMIT 1;

  IF v_url IS NOT NULL AND trim(v_url) <> '' THEN
    RETURN rtrim(trim(v_url), '/');
  END IF;

  RAISE EXCEPTION
    'Secret APP_SUPABASE_URL não encontrado no Vault. '
    'Verifique Settings > Secrets no painel do Lovable.';
END;
$$;

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
  -- Lovable injeta como APP_SUPABASE_KEY
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
   WHERE name IN ('APP_SUPABASE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY')
   ORDER BY
     CASE name
       WHEN 'APP_SUPABASE_KEY'          THEN 1
       WHEN 'SUPABASE_SERVICE_ROLE_KEY' THEN 2
       WHEN 'SERVICE_ROLE_KEY'          THEN 3
       ELSE 4
     END
   LIMIT 1;

  IF v_key IS NOT NULL AND trim(v_key) <> '' THEN
    RETURN trim(v_key);
  END IF;

  RAISE EXCEPTION
    'Secret APP_SUPABASE_KEY não encontrado no Vault. '
    'Verifique Settings > Secrets no painel do Lovable.';
END;
$$;

REVOKE ALL ON FUNCTION get_project_api_url()  FROM PUBLIC;
REVOKE ALL ON FUNCTION get_service_role_key() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_project_api_url()  TO service_role;
GRANT EXECUTE ON FUNCTION get_service_role_key() TO service_role;

COMMENT ON FUNCTION get_project_api_url IS
  'Lê URL do projeto do Vault. '
  'Prioridade: APP_SUPABASE_URL (Lovable) > SUPABASE_URL.';

COMMENT ON FUNCTION get_service_role_key IS
  'Lê service role key do Vault. '
  'Prioridade: APP_SUPABASE_KEY (Lovable) > SUPABASE_SERVICE_ROLE_KEY.';
