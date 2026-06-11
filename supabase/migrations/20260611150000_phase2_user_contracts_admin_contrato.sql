-- =============================================================================
-- Phase 2 — user_contracts + role admin_contrato
-- =============================================================================
-- O que esta migration faz:
--   1. Adiciona 'admin_contrato' ao enum app_role (se ainda nao existir)
--   2. Cria tabela user_contracts  (vinculo 1:1 usuario <-> contrato)
--   3. RLS em user_contracts       (usa is_admin() — padrao do projeto)
--   4. Politica RLS em contracts   (admin_contrato ve somente seu contrato)
--   5. Politica RLS em contract_slas e contract_room_teams para admin_contrato
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Enum app_role — adiciona admin_contrato via DO block (idempotente)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'admin_contrato'
      AND enumtypid = 'public.app_role'::regtype
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'admin_contrato';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Tabela user_contracts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_contracts (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contract_id uuid        NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_contracts_user_id_key UNIQUE (user_id)   -- 1 usuario : 1 contrato
);

CREATE INDEX IF NOT EXISTS idx_user_contracts_user_id     ON public.user_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contracts_contract_id ON public.user_contracts(contract_id);

COMMENT ON TABLE public.user_contracts IS
  'Vinculo 1:1 entre um usuario admin_contrato e o contrato que ele administra.';

-- trigger updated_at
CREATE OR REPLACE FUNCTION public.set_user_contracts_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_contracts_updated_at ON public.user_contracts;
CREATE TRIGGER trg_user_contracts_updated_at
  BEFORE UPDATE ON public.user_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_user_contracts_updated_at();

-- ---------------------------------------------------------------------------
-- 3. RLS em user_contracts  (is_admin() = padrao canonico do projeto)
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_contracts ENABLE ROW LEVEL SECURITY;

-- Admin ve e gerencia tudo
DROP POLICY IF EXISTS "user_contracts_admin_all" ON public.user_contracts;
CREATE POLICY "user_contracts_admin_all"
  ON public.user_contracts
  FOR ALL
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

-- usuario ve apenas o proprio vinculo
DROP POLICY IF EXISTS "user_contracts_self_select" ON public.user_contracts;
CREATE POLICY "user_contracts_self_select"
  ON public.user_contracts
  FOR SELECT
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Politica RLS em contracts — admin_contrato ve apenas SEU contrato
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "contracts_admin_contrato_select" ON public.contracts;
CREATE POLICY "contracts_admin_contrato_select"
  ON public.contracts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_contracts uc
      WHERE uc.user_id     = auth.uid()
        AND uc.contract_id = contracts.id
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Politica RLS em contract_slas — admin_contrato ve SLAs do seu contrato
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "contract_slas_admin_contrato_select" ON public.contract_slas;
CREATE POLICY "contract_slas_admin_contrato_select"
  ON public.contract_slas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_contracts uc
      WHERE uc.user_id     = auth.uid()
        AND uc.contract_id = contract_slas.contract_id
    )
  );

-- ---------------------------------------------------------------------------
-- 6. Politica RLS em contract_room_teams — admin_contrato ve times do seu contrato
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "contract_room_teams_admin_contrato_select" ON public.contract_room_teams;
CREATE POLICY "contract_room_teams_admin_contrato_select"
  ON public.contract_room_teams
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_contracts uc
      WHERE uc.user_id     = auth.uid()
        AND uc.contract_id = contract_room_teams.contract_id
    )
  );
