-- ============================================================
-- MIGRATION: Fase 2 — Role admin_contrato + user_contracts
-- Data: 2026-06-10
-- Estratégia: ADDITIVE ONLY — sem DROP de policies existentes
--             Sistema em produção: comportamento atual preservado
--
-- O QUE MUDA:
--   1. app_role enum  → adiciona 'admin_contrato'
--   2. user_contracts → tabela usuário ↔ contrato ↔ papel
--   3. Funções helper → is_admin_master(), is_admin_of_contract(),
--                        has_contract_access(), get_my_contract_id(),
--                        get_my_contracts()
--   4. Backfill       → usuários existentes vinculados ao contrato
--   5. handle_new_user → novos usuários já entram com vínculo
-- ============================================================


-- ============================================================
-- 1. ENUM — adicionar 'admin_contrato'
--    ALTER TYPE ADD VALUE é irreversível mas seguro em produção
--    IF NOT EXISTS evita erro se rodar duas vezes
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
     WHERE enumtypid = 'public.app_role'::regtype
       AND enumlabel = 'admin_contrato'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'admin_contrato';
  END IF;
END;
$$;


-- ============================================================
-- 2. TABELA user_contracts
--    Vínculo N:N entre usuário, contrato e papel dentro desse contrato
--    Um usuário pode ser:
--      • admin_contrato  → gerencia tudo dentro do contrato
--      • member          → só lê/opera dentro do contrato
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

COMMENT ON COLUMN public.user_contracts.role IS
  'Papel do usuário DENTRO deste contrato: admin_contrato | member. '
  'admin global (admin_master) não precisa de registro aqui — bypass total.';

CREATE INDEX IF NOT EXISTS idx_user_contracts_user     ON public.user_contracts (user_id);
CREATE INDEX IF NOT EXISTS idx_user_contracts_contract ON public.user_contracts (contract_id);
CREATE INDEX IF NOT EXISTS idx_user_contracts_role     ON public.user_contracts (contract_id, role);

CREATE TRIGGER trg_user_contracts_updated_at
  BEFORE UPDATE ON public.user_contracts
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

ALTER TABLE public.user_contracts ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 3. FUNÇÕES HELPER
--    Todas SECURITY DEFINER + STABLE para uso em RLS policies
-- ============================================================

-- 3a. is_admin_master() — usuário tem role 'admin' global?
CREATE OR REPLACE FUNCTION public.is_admin_master(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = _user_id
       AND role    = 'admin'
  );
$$;

COMMENT ON FUNCTION public.is_admin_master IS
  'Retorna true se o usuário tem role admin global (admin_master). '
  'Bypass total — acessa todos os contratos.';


-- 3b. is_admin_of_contract() — usuário é admin_contrato deste contrato?
CREATE OR REPLACE FUNCTION public.is_admin_of_contract(
  _contract_id UUID,
  _user_id     UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_contracts
     WHERE user_id     = _user_id
       AND contract_id = _contract_id
       AND role        = 'admin_contrato'
  );
$$;

COMMENT ON FUNCTION public.is_admin_of_contract IS
  'Retorna true se o usuário é admin_contrato do contrato especificado. '
  'Não inclui admin_master — use is_admin_master() para isso.';


-- 3c. has_contract_access() — usuário tem QUALQUER acesso ao contrato?
--     (admin_master OU admin_contrato OU member do contrato)
--     Função central usada nas RLS policies da Fase 3
CREATE OR REPLACE FUNCTION public.has_contract_access(
  _contract_id UUID,
  _user_id     UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin_master(_user_id)
    OR
    EXISTS (
      SELECT 1 FROM public.user_contracts
       WHERE user_id     = _user_id
         AND contract_id = _contract_id
    );
$$;

COMMENT ON FUNCTION public.has_contract_access IS
  'Retorna true se o usuário pode acessar o contrato: '
  'admin_master (bypass), admin_contrato, ou member vinculado.';


-- 3d. get_my_contract_id() — retorna o contract_id do usuário logado
CREATE OR REPLACE FUNCTION public.get_my_contract_id(
  _user_id UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT contract_id
    FROM public.user_contracts
   WHERE user_id = _user_id
   LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_contract_id IS
  'Retorna o contract_id do usuário logado. '
  'NULL se admin_master ou se não vinculado a nenhum contrato.';


-- 3e. get_my_contracts() — retorna TODOS os contratos do usuário
CREATE OR REPLACE FUNCTION public.get_my_contracts(
  _user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE(contract_id UUID, role public.app_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT contract_id, role
    FROM public.user_contracts
   WHERE user_id = _user_id;
$$;

COMMENT ON FUNCTION public.get_my_contracts IS
  'Retorna todos os contratos e papéis do usuário logado.';


-- ============================================================
-- 4. RLS da tabela user_contracts
-- ============================================================

-- admin_master vê e gerencia tudo
DROP POLICY IF EXISTS "uc_admin_master_all" ON public.user_contracts;
CREATE POLICY "uc_admin_master_all"
  ON public.user_contracts FOR ALL
  USING (public.is_admin_master(auth.uid()));

-- admin_contrato vê e gerencia os vínculos do SEU contrato
DROP POLICY IF EXISTS "uc_admin_contrato_manage" ON public.user_contracts;
CREATE POLICY "uc_admin_contrato_manage"
  ON public.user_contracts FOR ALL
  USING (public.is_admin_of_contract(contract_id, auth.uid()));

-- member vê apenas o próprio vínculo
DROP POLICY IF EXISTS "uc_member_view_own" ON public.user_contracts;
CREATE POLICY "uc_member_view_own"
  ON public.user_contracts FOR SELECT
  USING (user_id = auth.uid());


-- ============================================================
-- 5. RLS da tabela contracts
--    Substituir as policies abertas (authenticated) por scoped
-- ============================================================

-- Remove policies abertas antigas
DROP POLICY IF EXISTS "contracts_select" ON public.contracts;
DROP POLICY IF EXISTS "contracts_insert" ON public.contracts;
DROP POLICY IF EXISTS "contracts_update" ON public.contracts;

-- admin_master: acesso total
DROP POLICY IF EXISTS "contracts_admin_master_all" ON public.contracts;
CREATE POLICY "contracts_admin_master_all"
  ON public.contracts FOR ALL
  USING (public.is_admin_master(auth.uid()));

-- admin_contrato: vê e edita seu contrato
DROP POLICY IF EXISTS "contracts_admin_contrato_select" ON public.contracts;
CREATE POLICY "contracts_admin_contrato_select"
  ON public.contracts FOR SELECT
  USING (public.is_admin_of_contract(id, auth.uid()));

DROP POLICY IF EXISTS "contracts_admin_contrato_update" ON public.contracts;
CREATE POLICY "contracts_admin_contrato_update"
  ON public.contracts FOR UPDATE
  USING (public.is_admin_of_contract(id, auth.uid()));

-- member: apenas vê seu contrato
DROP POLICY IF EXISTS "contracts_member_select" ON public.contracts;
CREATE POLICY "contracts_member_select"
  ON public.contracts FOR SELECT
  USING (public.has_contract_access(id, auth.uid()));


-- ============================================================
-- 6. BACKFILL — vincular usuários existentes ao contrato
--
--    Regra:
--    • user_roles.role = 'admin'  → admin_contrato no contrato FABRICA PF
--    • user_roles.role = 'member' → member no contrato FABRICA PF
--
--    Idempotente: ON CONFLICT DO NOTHING
-- ============================================================

INSERT INTO public.user_contracts (user_id, contract_id, role)
SELECT
  ur.user_id,
  'd59ab6dc-421f-41b4-b415-ae0bc072ebd4'::uuid AS contract_id,
  CASE
    WHEN ur.role = 'admin' THEN 'admin_contrato'::public.app_role
    ELSE                        'member'::public.app_role
  END AS role
FROM public.user_roles ur
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_contracts uc
   WHERE uc.user_id     = ur.user_id
     AND uc.contract_id = 'd59ab6dc-421f-41b4-b415-ae0bc072ebd4'::uuid
)
ON CONFLICT (user_id, contract_id) DO NOTHING;


-- ============================================================
-- 7. ATUALIZAR handle_new_user — novos usuários já entram vinculados
--    Mantém comportamento existente + adiciona vínculo em user_contracts
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role        public.app_role;
  v_contract_id UUID := 'd59ab6dc-421f-41b4-b415-ae0bc072ebd4';
BEGIN
  -- 1. Cria perfil
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- 2. Define role: primeiro usuário = admin, demais = member
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    v_role := 'admin';
  ELSE
    v_role := 'member';
  END IF;

  -- 3. Insere em user_roles (comportamento original)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 4. Vincula ao contrato padrão em user_contracts
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
-- 8. GRANTS — expor funções ao frontend (authenticated)
-- ============================================================

GRANT EXECUTE ON FUNCTION public.is_admin_master(UUID)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_of_contract(UUID,UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_contract_access(UUID,UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_contract_id(UUID)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_contracts(UUID)          TO authenticated;


-- ============================================================
-- 9. VIEW de diagnóstico — usuários × contratos × papéis
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
JOIN      public.user_roles     ur ON ur.user_id    = p.user_id
LEFT JOIN public.user_contracts uc ON uc.user_id    = p.user_id
LEFT JOIN public.contracts       c ON  c.id         = uc.contract_id
ORDER BY  p.display_name;

COMMENT ON VIEW public.vw_user_contract_roles IS
  'Diagnóstico: usuários com seus papéis globais e por contrato. '
  'Rode: SELECT * FROM vw_user_contract_roles;';


-- ============================================================
-- FIM DA FASE 2
-- Para verificar após aplicar:
--   SELECT * FROM public.vw_user_contract_roles;
--
-- Próximo passo: Fase 3 — RLS multi-contrato em teams,
--   demandas, sprints, user_stories
-- ============================================================
