-- ============================================================
-- AI Providers dinâmicos (cadastrados pelo admin)
-- ============================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.ai_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider_type text NOT NULL,
  model text,
  is_recommended boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  has_key boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_providers_type_check CHECK (
    provider_type IN ('lovable','openai','gemini','anthropic','perplexity')
  )
);

CREATE INDEX IF NOT EXISTS ai_providers_active_idx ON public.ai_providers(is_active);

ALTER TABLE public.ai_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read active ai_providers" ON public.ai_providers;
CREATE POLICY "Authenticated can read active ai_providers"
ON public.ai_providers FOR SELECT
TO authenticated
USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins insert ai_providers" ON public.ai_providers;
CREATE POLICY "Admins insert ai_providers"
ON public.ai_providers FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins update ai_providers" ON public.ai_providers;
CREATE POLICY "Admins update ai_providers"
ON public.ai_providers FOR UPDATE
TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins delete ai_providers" ON public.ai_providers;
CREATE POLICY "Admins delete ai_providers"
ON public.ai_providers FOR DELETE
TO authenticated
USING (public.is_admin());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.ai_providers_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS ai_providers_touch ON public.ai_providers;
CREATE TRIGGER ai_providers_touch
BEFORE UPDATE ON public.ai_providers
FOR EACH ROW EXECUTE FUNCTION public.ai_providers_touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Funções Vault (por id)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_ai_provider_key_v2(
  p_id  uuid,
  p_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_secret_name text := 'ai_provider_key_' || p_id::text;
  v_existing_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem configurar API keys';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ai_providers WHERE id = p_id) THEN
    RAISE EXCEPTION 'Provedor de IA não encontrado: %', p_id;
  END IF;

  IF p_key IS NULL OR length(trim(p_key)) < 10 THEN
    RAISE EXCEPTION 'API key inválida ou muito curta';
  END IF;

  SELECT id INTO v_existing_id FROM vault.secrets WHERE name = v_secret_name LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    PERFORM vault.update_secret(v_existing_id, p_key);
  ELSE
    PERFORM vault.create_secret(p_key, v_secret_name, 'AI provider key (ai_providers row ' || p_id::text || ')');
  END IF;

  UPDATE public.ai_providers SET has_key = true, updated_at = now() WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_ai_provider_key_v2(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_ai_provider_key_v2(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_ai_provider_key_by_id(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'ai_provider_key_' || p_id::text
  LIMIT 1;
  RETURN v_key;
END;
$$;

REVOKE ALL ON FUNCTION public.get_ai_provider_key_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_provider_key_by_id(uuid) TO service_role;

-- Remoção opcional do segredo ao excluir o provedor
CREATE OR REPLACE FUNCTION public.delete_ai_provider_key(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE v_secret_name text := 'ai_provider_key_' || p_id::text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Apenas administradores podem remover API keys';
  END IF;
  DELETE FROM vault.secrets WHERE name = v_secret_name;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_ai_provider_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_ai_provider_key(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- Seed: Lovable AI recomendado (key opcional — usa LOVABLE_API_KEY do ambiente)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.ai_providers (name, provider_type, model, is_recommended, is_active, has_key)
SELECT 'Lovable AI (Gemini/GPT) — recomendado', 'lovable', 'google/gemini-2.5-flash', true, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_providers WHERE provider_type = 'lovable'
);

COMMIT;