-- ============================================================
-- FASE 2A: função is_contract_member
-- Data: 2026-06-11
-- Ambiente: PRODUÇÃO — sistema em operação
--
-- OBJETIVO:
--   Criar função auxiliar que verifica se um usuário pertence
--   a um contrato específico. Será usada pelas policies RLS
--   na Fase 2B.
--
-- IMPACTO NO SISTEMA ATUAL:
--   ✅ ZERO impacto — apenas cria função, nenhuma policy alterada
--   ✅ Nenhuma tabela alterada
--   ✅ RLS atual (por team_id) 100% intacto
--
-- PRÓXIMO PASSO:
--   Fase 2B: adicionar policies RLS usando is_contract_member()
--   em modo permissivo (OR) para transição segura
-- ============================================================

-- ============================================================
-- STEP 1: is_contract_member
--   Verifica se o usuário pertence ao contrato via contract_members.
--   Admins globais sempre retornam TRUE.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_contract_member(
  _user_id    UUID,
  _contract_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Admin global sempre tem acesso
    public.has_role(_user_id, 'admin')
    OR
    -- Membro vinculado ao contrato
    EXISTS (
      SELECT 1
      FROM   public.contract_members cm
      WHERE  cm.user_id     = _user_id
        AND  cm.contract_id = _contract_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_contract_member(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.is_contract_member IS
  'Retorna TRUE se o usuário pertence ao contrato (via contract_members) '
  'ou se é admin global. Usada pelas policies RLS da Fase 2B.';

-- ============================================================
-- STEP 2: is_team_in_user_contracts
--   Verifica se um time pertence a algum contrato do usuário.
--   Atalho útil para policies em tabelas que só têm team_id.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_team_in_user_contracts(
  _user_id UUID,
  _team_id  UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin')
    OR
    EXISTS (
      SELECT 1
      FROM   public.teams         t
      JOIN   public.contract_members cm
             ON cm.contract_id = t.contract_id
      WHERE  t.id          = _team_id
        AND  cm.user_id    = _user_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_team_in_user_contracts(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.is_team_in_user_contracts IS
  'Retorna TRUE se o time pertence a algum contrato do usuário. '
  'Atalho para policies RLS em tabelas com team_id (sprints, epics, demandas...).';

-- ============================================================
-- VALIDAÇÃO PÓS-APPLY:
--
--   -- Deve retornar TRUE (roberto.sales é admin e membro do PF)
--   SELECT public.is_contract_member(
--     '3c472f37-eabb-4a95-a859-1a1cf89f5d37',
--     'd59ab6dc-421f-41b4-b415-ae0bc072ebd4'
--   );
--
--   -- Deve retornar FALSE (usuário PF tentando acessar DETRAN-GO)
--   SELECT public.is_contract_member(
--     '3c472f37-eabb-4a95-a859-1a1cf89f5d37',
--     'fd7424d2-dc34-43c6-bda0-adebec335d6c'
--   );
--   OBS: retorna TRUE pois roberto.sales é admin global.
--   Teste com um usuário member para validar o isolamento.
--
--   -- is_team_in_user_contracts: deve retornar TRUE
--   SELECT public.is_team_in_user_contracts(
--     '3c472f37-eabb-4a95-a859-1a1cf89f5d37',
--     (SELECT id FROM public.teams LIMIT 1)
--   );
-- ============================================================
