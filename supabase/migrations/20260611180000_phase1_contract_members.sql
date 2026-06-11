-- ============================================================
-- FASE 1: contract_members
-- Data: 2026-06-11
-- Ambiente: PRODUÇÃO — sistema em operação
--
-- OBJETIVO:
--   Criar vínculo direto usuário ↔ contrato, independente de time.
--   Hoje o vínculo é indireto: user → team_members → teams.contract_id
--   Com essa tabela: user → contract_members → contracts
--
-- IMPACTO NO SISTEMA ATUAL:
--   ✅ Zero breaking change
--   ✅ Nenhuma tabela existente alterada
--   ✅ RLS atual (por team_id) permanece intacto
--   ✅ Backfill automático: 47 usuários únicos (CONTRATO PF) validado
--
-- PRÓXIMAS FASES:
--   Fase 2: RLS por contrato (usando esta tabela)
--   Fase 3: fn_get_user_contracts no login do frontend
--   Fase 4: role admin por contrato
-- ============================================================

-- ============================================================
-- STEP 1: Tabela contract_members
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contract_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID        NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'member'
                CHECK (role IN ('admin', 'member')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_contract_members UNIQUE (contract_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_contract_members_user_id
  ON public.contract_members (user_id);

CREATE INDEX IF NOT EXISTS idx_contract_members_contract_id
  ON public.contract_members (contract_id);

COMMENT ON TABLE public.contract_members IS
  'Vínculo direto usuário ↔ contrato. '
  'Criado na Fase 1 (2026-06-11) para suportar múltiplos contratos (PF, DETRAN-GO...). '
  'Backfill via team_members → teams.contract_id. 47 usuários únicos validado.';

-- ============================================================
-- STEP 2: Trigger updated_at
-- ============================================================
CREATE TRIGGER update_contract_members_updated_at
  BEFORE UPDATE ON public.contract_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- STEP 3: RLS
-- ============================================================
ALTER TABLE public.contract_members ENABLE ROW LEVEL SECURITY;

-- Admin vê e gerencia tudo
CREATE POLICY cm_admin_all ON public.contract_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Membro vê apenas seus próprios vínculos
CREATE POLICY cm_member_select ON public.contract_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- STEP 4: GRANTS
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.contract_members TO authenticated;

-- ============================================================
-- STEP 5: Backfill — popula a partir de team_members
--   Lógica: usuário → times que pertence → contract_id do time
--   ON CONFLICT: idempotente, pode rodar múltiplas vezes
-- ============================================================
INSERT INTO public.contract_members (contract_id, user_id, role)
SELECT DISTINCT
  t.contract_id,
  tm.user_id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = tm.user_id AND ur.role = 'admin'
    ) THEN 'admin'
    ELSE 'member'
  END AS role
FROM   public.team_members tm
JOIN   public.teams t ON t.id = tm.team_id
WHERE  t.contract_id IS NOT NULL
ON CONFLICT (contract_id, user_id) DO NOTHING;

-- ============================================================
-- STEP 6: RPC fn_get_user_contracts
--   Retorna todos os contratos de um usuário.
--   Usado pelo frontend no momento do login para:
--     - 1 contrato  → entra direto
--     - N contratos → tela de seleção
--     - 0 contratos → acesso negado
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_get_user_contracts(
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  contract_id   UUID,
  contract_name TEXT,
  room_mode     TEXT,
  status        TEXT,
  role          TEXT,
  total_teams   BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id                 AS contract_id,
    c.name               AS contract_name,
    c.room_mode          AS room_mode,
    c.status             AS status,
    cm.role              AS role,
    COUNT(DISTINCT t.id) AS total_teams
  FROM   public.contract_members cm
  JOIN   public.contracts c ON c.id = cm.contract_id
  LEFT   JOIN public.teams t ON t.contract_id = c.id
  WHERE  cm.user_id = p_user_id
    AND  c.status   = 'ativo'
  GROUP  BY c.id, c.name, c.room_mode, c.status, cm.role
  ORDER  BY c.name;
$$;

GRANT EXECUTE ON FUNCTION public.fn_get_user_contracts(UUID) TO authenticated;

COMMENT ON FUNCTION public.fn_get_user_contracts IS
  'Retorna contratos ativos do usuário com role e total de times. '
  'Frontend usa no login: 1 contrato = entra direto, N = tela seleção, 0 = acesso negado. '
  'Fix 2026-06-11: modalidade → room_mode (coluna real da tabela contracts).';

-- ============================================================
-- VALIDAÇÃO PÓS-APPLY (executado e validado em 2026-06-11):
--
--   SELECT c.name, COUNT(*) AS membros
--   FROM public.contract_members cm
--   JOIN public.contracts c ON c.id = cm.contract_id
--   GROUP BY c.name;
--   Resultado: CONTRATO DE FABRICA PF | 47
--
--   SELECT * FROM public.fn_get_user_contracts(
--     '3c472f37-eabb-4a95-a859-1a1cf89f5d37'
--   );
--   Esperado: 1 linha, contract_name = 'CONTRATO DE FABRICA PF'
-- ============================================================
