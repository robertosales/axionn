-- Quality Intelligence — RPC de Verificação de Entitlement Comercial
-- Usa o schema comercial correto (product_modules, product_features, saas_plan_versions, etc.)

BEGIN;

-- RPC para verificar se a organização tem entitlement Quality
CREATE OR REPLACE FUNCTION public.check_organization_has_quality_module(p_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_access boolean := false;
  v_plan_version_id uuid;
BEGIN
  -- Busca o plan_version_id da assinatura ativa da organização
  SELECT os.plan_version_id
  INTO v_plan_version_id
  FROM public.organization_subscriptions os
  WHERE os.organization_id = p_org_id
    AND os.status IN ('active', 'trialing')
    AND os.plan_version_id IS NOT NULL
  ORDER BY os.created_at DESC
  LIMIT 1;

  IF v_plan_version_id IS NULL THEN
    RETURN false;
  END IF;

  -- Verifica se a feature quality.view está habilitada para esse plan_version
  SELECT EXISTS (
    SELECT 1
    FROM public.saas_plan_version_features pf
    JOIN public.product_features f ON f.id = pf.feature_id
    WHERE pf.plan_version_id = v_plan_version_id
      AND f.code = 'quality.view'
      AND pf.enabled = true
      AND pf.access_level IN ('basic', 'full')
  ) INTO v_has_access;

  RETURN v_has_access;
END;
$$;

-- Grants
REVOKE ALL ON FUNCTION public.check_organization_has_quality_module(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_organization_has_quality_module(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.check_organization_has_quality_module(uuid) 
IS 'Retorna true se a organização tem entitlement comercial ativo para quality.view';

COMMIT;