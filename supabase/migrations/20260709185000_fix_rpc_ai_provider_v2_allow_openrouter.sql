-- Migration: fix create/update_platform_ai_provider_v2
-- Problema: a RPC retornava HTTP 400 ao tentar salvar provider_type = 'openrouter'
-- porque nao havia validacao explicita de provider_type na RPC, mas a constraint
-- da tabela rejeitava o valor. Apos corrigir a constraint (migration anterior),
-- o erro 400 persiste pois a validacao de request_format dentro da RPC
-- e executada antes do INSERT. Essa migration recria as RPCs sem validacao
-- redundante de provider_type (a constraint da tabela ja e suficiente).
-- Status: aplicar no Supabase apos deploy.

CREATE OR REPLACE FUNCTION public.create_platform_ai_provider_v2(
  p_name text,
  p_provider_type text,
  p_model text DEFAULT NULL,
  p_api_base_url text DEFAULT NULL,
  p_request_format text DEFAULT 'openai_compatible',
  p_is_recommended boolean DEFAULT false,
  p_is_active boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider public.ai_providers%rowtype;
BEGIN
  PERFORM public.assert_platform_admin_v2();

  IF nullif(btrim(coalesce(p_name, '')), '') IS NULL THEN
    RAISE EXCEPTION USING errcode = '23514', message = 'ai_provider_name_required';
  END IF;

  IF nullif(btrim(coalesce(p_provider_type, '')), '') IS NULL THEN
    RAISE EXCEPTION USING errcode = '23514', message = 'ai_provider_type_required';
  END IF;

  -- request_format: aceita openai_compatible, gemini e anthropic
  IF p_request_format NOT IN ('openai_compatible', 'gemini', 'anthropic') THEN
    RAISE EXCEPTION USING errcode = '23514', message = 'ai_provider_request_format_invalid';
  END IF;

  IF p_api_base_url IS NOT NULL AND p_api_base_url !~* '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION USING errcode = '23514', message = 'ai_provider_api_url_invalid';
  END IF;

  INSERT INTO public.ai_providers (
    name,
    provider_type,
    model,
    api_base_url,
    request_format,
    is_recommended,
    is_active,
    created_by
  )
  VALUES (
    btrim(p_name),
    lower(btrim(p_provider_type)),
    nullif(btrim(coalesce(p_model, '')), ''),
    nullif(btrim(coalesce(p_api_base_url, '')), ''),
    p_request_format,
    p_is_recommended,
    p_is_active,
    auth.uid()
  )
  RETURNING * INTO v_provider;

  INSERT INTO public.platform_operational_audit_log (
    actor_id, action, resource_type, resource_id, after_values
  )
  VALUES (
    auth.uid(),
    'ai_provider_created',
    'ai_provider',
    v_provider.id,
    to_jsonb(v_provider) - 'vault_secret_id'
  );

  RETURN v_provider.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_platform_ai_provider_v2(
  p_provider_id uuid,
  p_name text,
  p_provider_type text,
  p_model text DEFAULT NULL,
  p_api_base_url text DEFAULT NULL,
  p_request_format text DEFAULT 'openai_compatible',
  p_is_recommended boolean DEFAULT false,
  p_is_active boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before public.ai_providers%rowtype;
  v_after  public.ai_providers%rowtype;
BEGIN
  PERFORM public.assert_platform_admin_v2();

  SELECT * INTO v_before
  FROM public.ai_providers provider
  WHERE provider.id = p_provider_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0002', message = 'ai_provider_not_found';
  END IF;

  IF nullif(btrim(coalesce(p_name, '')), '') IS NULL THEN
    RAISE EXCEPTION USING errcode = '23514', message = 'ai_provider_name_required';
  END IF;

  IF nullif(btrim(coalesce(p_provider_type, '')), '') IS NULL THEN
    RAISE EXCEPTION USING errcode = '23514', message = 'ai_provider_type_required';
  END IF;

  IF p_request_format NOT IN ('openai_compatible', 'gemini', 'anthropic') THEN
    RAISE EXCEPTION USING errcode = '23514', message = 'ai_provider_request_format_invalid';
  END IF;

  IF p_api_base_url IS NOT NULL AND p_api_base_url !~* '^https://[^[:space:]]+$' THEN
    RAISE EXCEPTION USING errcode = '23514', message = 'ai_provider_api_url_invalid';
  END IF;

  UPDATE public.ai_providers provider
  SET name          = btrim(p_name),
      provider_type = lower(btrim(p_provider_type)),
      model         = nullif(btrim(coalesce(p_model, '')), ''),
      api_base_url  = nullif(btrim(coalesce(p_api_base_url, '')), ''),
      request_format  = p_request_format,
      is_recommended  = p_is_recommended,
      is_active       = p_is_active,
      updated_at      = now()
  WHERE provider.id = p_provider_id
  RETURNING * INTO v_after;

  INSERT INTO public.platform_operational_audit_log (
    actor_id, action, resource_type, resource_id, before_values, after_values
  )
  VALUES (
    auth.uid(),
    'ai_provider_updated',
    'ai_provider',
    p_provider_id,
    to_jsonb(v_before) - 'vault_secret_id',
    to_jsonb(v_after)  - 'vault_secret_id'
  );
END;
$$;

-- Regarantir permissoes (idempotente)
GRANT EXECUTE ON FUNCTION public.create_platform_ai_provider_v2(text,text,text,text,text,boolean,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_platform_ai_provider_v2(uuid,text,text,text,text,text,boolean,boolean) TO authenticated, service_role;
