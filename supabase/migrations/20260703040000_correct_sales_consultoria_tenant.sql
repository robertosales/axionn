-- Corrige a organização legada nomeada como GlobalWeb.
-- A organização é renomeada in-place para preservar membros, papéis,
-- plano enterprise, limites e todas as referências existentes.

DO $$
DECLARE
  v_org_id UUID := 'd7f226d9-9f08-43a7-b565-482cca58f00d';
  v_company_id UUID := 'f2fe0568-2862-46d3-82ae-b08651bb39a7';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('axionn:correct-sales-consultoria-tenant'));

  IF NOT EXISTS (
    SELECT 1
    FROM public.companies
    WHERE id = v_company_id
      AND upper(trim(name)) = 'SALES CONSULTORIA'
      AND regexp_replace(coalesce(cnpj::text, ''), '[^0-9]', '', 'g') = '51553401000100'
  ) THEN
    RAISE EXCEPTION 'Empresa SALES CONSULTORIA/CNPJ 51.553.401/0001-00 não encontrada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id = v_org_id
      AND slug IN ('globalweb', 'sales-consultoria')
  ) THEN
    RAISE EXCEPTION 'Organização legada esperada não encontrada.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id <> v_org_id
      AND (slug = 'sales-consultoria' OR upper(trim(name)) = 'SALES CONSULTORIA')
  ) THEN
    RAISE EXCEPTION 'Já existe outra organização SALES CONSULTORIA.';
  END IF;

  UPDATE public.organizations
  SET name = 'SALES CONSULTORIA',
      slug = 'sales-consultoria',
      updated_at = now()
  WHERE id = v_org_id;

  UPDATE public.contracts
  SET org_id = v_org_id
  WHERE company_id = v_company_id
    AND org_id IS DISTINCT FROM v_org_id;

  IF EXISTS (
    SELECT 1
    FROM public.contracts
    WHERE company_id = v_company_id
      AND org_id IS DISTINCT FROM v_org_id
  ) THEN
    RAISE EXCEPTION 'Ainda existem contratos da SALES CONSULTORIA fora da organização correta.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id = v_org_id
      AND name = 'SALES CONSULTORIA'
      AND slug = 'sales-consultoria'
      AND plan = 'enterprise'
      AND status = 'active'
      AND max_projects = 100
      AND max_users = 50
      AND max_countings_per_month = 500
  ) THEN
    RAISE EXCEPTION 'A configuração enterprise esperada não foi preservada.';
  END IF;
END;
$$;
