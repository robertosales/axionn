-- Fase 2b — user_contracts, helpers e RLS.
-- O enum admin_contrato é consolidado pela migration anterior.

CREATE TABLE IF NOT EXISTS public.user_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_contracts UNIQUE (user_id, contract_id)
);

CREATE INDEX IF NOT EXISTS idx_user_contracts_user
  ON public.user_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contracts_contract
  ON public.user_contracts(contract_id);
CREATE INDEX IF NOT EXISTS idx_user_contracts_role
  ON public.user_contracts(contract_id, role);

DROP TRIGGER IF EXISTS trg_user_contracts_updated_at
  ON public.user_contracts;
CREATE TRIGGER trg_user_contracts_updated_at
  BEFORE UPDATE ON public.user_contracts
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.user_contracts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin_master(
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_of_contract(
  _contract_id uuid,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_contracts
    WHERE user_id = _user_id
      AND contract_id = _contract_id
      AND role = 'admin_contrato'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_contract_access(
  _contract_id uuid,
  _user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_admin_master(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_contracts
      WHERE user_id = _user_id
        AND contract_id = _contract_id
    );
$$;

CREATE OR REPLACE FUNCTION public.get_my_contract_id(
  _user_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT contract_id
  FROM public.user_contracts
  WHERE user_id = _user_id
  ORDER BY created_at
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_contracts(
  _user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE(contract_id uuid, role public.app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT membership.contract_id, membership.role
  FROM public.user_contracts membership
  WHERE membership.user_id = _user_id
  ORDER BY membership.created_at;
$$;

DROP POLICY IF EXISTS uc_admin_master_all ON public.user_contracts;
DROP POLICY IF EXISTS uc_admin_contrato_manage ON public.user_contracts;
DROP POLICY IF EXISTS uc_member_view_own ON public.user_contracts;

CREATE POLICY uc_admin_master_all
ON public.user_contracts FOR ALL TO authenticated
USING (public.is_admin_master(auth.uid()))
WITH CHECK (public.is_admin_master(auth.uid()));

CREATE POLICY uc_admin_contrato_manage
ON public.user_contracts FOR ALL TO authenticated
USING (public.is_admin_of_contract(contract_id, auth.uid()))
WITH CHECK (public.is_admin_of_contract(contract_id, auth.uid()));

CREATE POLICY uc_member_view_own
ON public.user_contracts FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS contracts_select ON public.contracts;
DROP POLICY IF EXISTS contracts_insert ON public.contracts;
DROP POLICY IF EXISTS contracts_update ON public.contracts;
DROP POLICY IF EXISTS contracts_admin_master_all ON public.contracts;
DROP POLICY IF EXISTS contracts_admin_contrato_select ON public.contracts;
DROP POLICY IF EXISTS contracts_admin_contrato_update ON public.contracts;
DROP POLICY IF EXISTS contracts_member_select ON public.contracts;

CREATE POLICY contracts_admin_master_all
ON public.contracts FOR ALL TO authenticated
USING (public.is_admin_master(auth.uid()))
WITH CHECK (public.is_admin_master(auth.uid()));

CREATE POLICY contracts_admin_contrato_select
ON public.contracts FOR SELECT TO authenticated
USING (public.is_admin_of_contract(id, auth.uid()));

CREATE POLICY contracts_admin_contrato_update
ON public.contracts FOR UPDATE TO authenticated
USING (public.is_admin_of_contract(id, auth.uid()))
WITH CHECK (public.is_admin_of_contract(id, auth.uid()));

CREATE POLICY contracts_member_select
ON public.contracts FOR SELECT TO authenticated
USING (public.has_contract_access(id, auth.uid()));

-- Backfill apenas quando o contrato legado existir no ambiente.
INSERT INTO public.user_contracts (user_id, contract_id, role)
SELECT
  role.user_id,
  contract.id,
  CASE
    WHEN role.role = 'admin' THEN 'admin_contrato'::public.app_role
    ELSE 'member'::public.app_role
  END
FROM public.user_roles role
JOIN public.contracts contract
  ON contract.id = 'd59ab6dc-421f-41b4-b415-ae0bc072ebd4'::uuid
ON CONFLICT (user_id, contract_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role public.app_role;
  v_contract_id uuid := 'd59ab6dc-421f-41b4-b415-ae0bc072ebd4';
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, 'Usuário'),
    COALESCE(NEW.email, '')
  )
  ON CONFLICT (user_id) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    v_role := 'admin';
  ELSE
    v_role := 'member';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF EXISTS (
    SELECT 1
    FROM public.contracts
    WHERE id = v_contract_id
  ) THEN
    INSERT INTO public.user_contracts (user_id, contract_id, role)
    VALUES (
      NEW.id,
      v_contract_id,
      CASE
        WHEN v_role = 'admin' THEN 'admin_contrato'::public.app_role
        ELSE 'member'::public.app_role
      END
    )
    ON CONFLICT (user_id, contract_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin_master(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.is_admin_of_contract(uuid, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.has_contract_access(uuid, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.get_my_contract_id(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.get_my_contracts(uuid) FROM public, anon;

GRANT EXECUTE ON FUNCTION public.is_admin_master(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_of_contract(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_contract_access(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_contract_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_contracts(uuid) TO authenticated, service_role;

CREATE OR REPLACE VIEW public.vw_user_contract_roles
WITH (security_invoker = true)
AS
SELECT
  profile.display_name,
  profile.email,
  global_role.role AS role_global,
  membership.contract_id,
  contract.name AS contract_name,
  membership.role AS role_contrato
FROM public.profiles profile
JOIN public.user_roles global_role
  ON global_role.user_id = profile.user_id
LEFT JOIN public.user_contracts membership
  ON membership.user_id = profile.user_id
LEFT JOIN public.contracts contract
  ON contract.id = membership.contract_id
ORDER BY profile.display_name;
