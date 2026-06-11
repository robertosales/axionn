-- ============================================================
-- MIGRATION: Fase 2b — user_contracts + RLS + backfill
-- Data: 2026-06-10
--
-- PRE-REQUISITO: rodar antes no SQL Editor (isolado):
--   ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin_contrato';
--
-- MOTIVO DO SPLIT: PostgreSQL não permite usar um novo valor de enum
-- na mesma transação em que ele foi criado (erro 55P04).
-- ============================================================


-- ============================================================
-- 1. TABELA user_contracts
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_contracts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  role        public.app_role NOT NULL DEFAULT 'member',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_contracts UNIQUE (user_id, contract_id)
);

COMMENT ON TABLE public.user_contracts IS
  'Vínculo usuário ↔ contrato com papel. '
  'admin_contrato = gerencia o contrato. member = acessa o contrato.';

CREATE INDEX IF NOT EXISTS idx_user_contracts_user     ON public.user_contracts (user_id);
CREATE INDEX IF NOT EXISTS idx_user_contracts_contract ON public.user_contracts (contract_id);
CREATE INDEX IF NOT EXISTS idx_user_contracts_role     ON public.user_contracts (contract_id, role);

CREATE TRIGGER trg_user_contracts_updated_at
  BEFORE UPDATE ON public.user_contracts
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.user_contracts ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 2. FUNÇÕES HELPER
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin_master(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _user_id AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_of_contract(
  _contract_id UUID,
  _user_id     UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_contracts
     WHERE user_id     = _user_id
       AND contract_id = _contract_id
       AND role        = 'admin_contrato'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_contract_access(
  _contract_id UUID,
  _user_id     UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_admin_master(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_contracts
       WHERE user_id     = _user_id
         AND contract_id = _contract_id
    );
$$;

CREATE OR REPLACE FUNCTION public.get_my_contract_id(
  _user_id UUID DEFAULT auth.uid()
)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT contract_id FROM public.user_contracts
   WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_my_contracts(
  _user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE(contract_id UUID, role public.app_role)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT contract_id, role FROM public.user_contracts WHERE user_id = _user_id;
$$;


-- ============================================================
-- 3. RLS — user_contracts
-- ============================================================

DROP POLICY IF EXISTS "uc_admin_master_all"      ON public.user_contracts;
DROP POLICY IF EXISTS "uc_admin_contrato_manage" ON public.user_contracts;
DROP POLICY IF EXISTS "uc_member_view_own"       ON public.user_contracts;

CREATE POLICY "uc_admin_master_all"
  ON public.user_contracts FOR ALL
  USING (public.is_admin_master(auth.uid()));

CREATE POLICY "uc_admin_contrato_manage"
  ON public.user_contracts FOR ALL
  USING (public.is_admin_of_contract(contract_id, auth.uid()));

CREATE POLICY "uc_member_view_own"
  ON public.user_contracts FOR SELECT
  USING (user_id = auth.uid());


-- ============================================================
-- 4. RLS — contracts (substitui policies abertas)
-- ============================================================

DROP POLICY IF EXISTS "contracts_select"               ON public.contracts;
DROP POLICY IF EXISTS "contracts_insert"               ON public.contracts;
DROP POLICY IF EXISTS "contracts_update"               ON public.contracts;
DROP POLICY IF EXISTS "contracts_admin_master_all"     ON public.contracts;
DROP POLICY IF EXISTS "contracts_admin_contrato_select" ON public.contracts;
DROP POLICY IF EXISTS "contracts_admin_contrato_update" ON public.contracts;
DROP POLICY IF EXISTS "contracts_member_select"        ON public.contracts;

CREATE POLICY "contracts_admin_master_all"
  ON public.contracts FOR ALL
  USING (public.is_admin_master(auth.uid()));

CREATE POLICY "contracts_admin_contrato_select"
  ON public.contracts FOR SELECT
  USING (public.is_admin_of_contract(id, auth.uid()));

CREATE POLICY "contracts_admin_contrato_update"
  ON public.contracts FOR UPDATE
  USING (public.is_admin_of_contract(id, auth.uid()));

CREATE POLICY "contracts_member_select"
  ON public.contracts FOR SELECT
  USING (public.has_contract_access(id, auth.uid()));


-- ============================================================
-- 5. BACKFILL — usuários existentes → CONTRATO DE FABRICA PF
-- ============================================================

INSERT INTO public.user_contracts (user_id, contract_id, role)
SELECT
  ur.user_id,
  'd59ab6dc-421f-41b4-b415-ae0bc072ebd4'::uuid,
  CASE
    WHEN ur.role = 'admin' THEN 'admin_contrato'::public.app_role
    ELSE                        'member'::public.app_role
  END
FROM public.user_roles ur
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_contracts uc
   WHERE uc.user_id     = ur.user_id
     AND uc.contract_id = 'd59ab6dc-421f-41b4-b415-ae0bc072ebd4'::uuid
)
ON CONFLICT (user_id, contract_id) DO NOTHING;


-- ============================================================
-- 6. ATUALIZAR handle_new_user
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role        public.app_role;
  v_contract_id UUID := 'd59ab6dc-421f-41b4-b415-ae0bc072ebd4';
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (user_id) DO NOTHING;

  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    v_role := 'admin';
  ELSE
    v_role := 'member';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_contracts (user_id, contract_id, role)
  VALUES (
    NEW.id,
    v_contract_id,
    CASE WHEN v_role = 'admin' THEN 'admin_contrato'::public.app_role
         ELSE                       'member'::public.app_role
    END
  )
  ON CONFLICT (user_id, contract_id) DO NOTHING;

  RETURN NEW;
END;
$$;


-- ============================================================
-- 7. GRANTS
-- ============================================================

GRANT EXECUTE ON FUNCTION public.is_admin_master(UUID)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_of_contract(UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_contract_access(UUID,UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_contract_id(UUID)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_contracts(UUID)          TO authenticated;


-- ============================================================
-- 8. VIEW diagnóstico
-- ============================================================

CREATE OR REPLACE VIEW public.vw_user_contract_roles AS
SELECT
  p.display_name,
  p.email,
  ur.role          AS role_global,
  uc.contract_id,
  c.name           AS contract_name,
  uc.role          AS role_contrato
FROM      public.profiles       p
JOIN      public.user_roles     ur ON ur.user_id = p.user_id
LEFT JOIN public.user_contracts uc ON uc.user_id = p.user_id
LEFT JOIN public.contracts       c ON  c.id      = uc.contract_id
ORDER BY  p.display_name;


-- ============================================================
-- FIM DA FASE 2b
-- Verificar: SELECT * FROM public.vw_user_contract_roles;
-- ============================================================
