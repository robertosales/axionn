-- Compatibilidade de replay: garante companies, contracts e o helper de
-- timestamp antes da entidade projects. Instalações históricas já possuíam
-- estes objetos fora da cadeia versionada.

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text,
  email text,
  phone text,
  logo_url text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text DEFAULT 'active',
  starts_at date,
  ends_at date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  number text,
  object text,
  value_per_pfus numeric,
  currency text NOT NULL DEFAULT 'BRL',
  room_mode text NOT NULL DEFAULT 'sustentacao',
  org_id uuid
);

CREATE INDEX IF NOT EXISTS idx_contracts_company_id
  ON public.contracts(company_id);

CREATE INDEX IF NOT EXISTS idx_contracts_status
  ON public.contracts(status);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_admin_all ON public.companies;
DROP POLICY IF EXISTS companies_authenticated_select ON public.companies;
CREATE POLICY companies_authenticated_select
ON public.companies FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);
CREATE POLICY companies_admin_all
ON public.companies FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS contracts_admin_all ON public.contracts;
DROP POLICY IF EXISTS contracts_authenticated_select ON public.contracts;
CREATE POLICY contracts_authenticated_select
ON public.contracts FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);
CREATE POLICY contracts_admin_all
ON public.contracts FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());
