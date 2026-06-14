
-- 1) Função SECURITY DEFINER: dois usuários compartilham contrato?
CREATE OR REPLACE FUNCTION public.users_share_contract(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _a IS NOT NULL AND _b IS NOT NULL AND EXISTS (
    -- Mesmo contrato via contract_members
    SELECT 1
    FROM public.contract_members a
    JOIN public.contract_members b ON a.contract_id = b.contract_id
    WHERE a.user_id = _a AND b.user_id = _b
    UNION ALL
    -- Mesmo contrato via times alocados (contract_room_teams)
    SELECT 1
    FROM public.team_members tma
    JOIN public.contract_room_teams crta
      ON crta.team_id = tma.team_id AND crta.is_active
    JOIN public.contract_room_teams crtb
      ON crtb.contract_id = crta.contract_id AND crtb.is_active
    JOIN public.team_members tmb ON tmb.team_id = crtb.team_id
    WHERE tma.user_id = _a AND tmb.user_id = _b
    UNION ALL
    -- Cruzado: A em time × B membro direto do contrato
    SELECT 1
    FROM public.team_members tma
    JOIN public.contract_room_teams crta
      ON crta.team_id = tma.team_id AND crta.is_active
    JOIN public.contract_members cmb ON cmb.contract_id = crta.contract_id
    WHERE tma.user_id = _a AND cmb.user_id = _b
    UNION ALL
    -- Cruzado inverso: A membro direto × B em time
    SELECT 1
    FROM public.contract_members cma
    JOIN public.contract_room_teams crtb
      ON crtb.contract_id = cma.contract_id AND crtb.is_active
    JOIN public.team_members tmb ON tmb.team_id = crtb.team_id
    WHERE cma.user_id = _a AND tmb.user_id = _b
  );
$$;

GRANT EXECUTE ON FUNCTION public.users_share_contract(uuid, uuid) TO authenticated;

-- 2) Policies aditivas (não removem nada existente)

-- profiles: ver perfis de pares do mesmo contrato
DROP POLICY IF EXISTS profiles_select_same_contract ON public.profiles;
CREATE POLICY profiles_select_same_contract
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.users_share_contract(auth.uid(), user_id));

-- team_members: ver alocações de pares do mesmo contrato
DROP POLICY IF EXISTS tm_select_same_contract ON public.team_members;
CREATE POLICY tm_select_same_contract
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (public.users_share_contract(auth.uid(), user_id));

-- contract_members: ver membros dos contratos que compartilho
DROP POLICY IF EXISTS cm_select_same_contract ON public.contract_members;
CREATE POLICY cm_select_same_contract
  ON public.contract_members
  FOR SELECT
  TO authenticated
  USING (public.users_share_contract(auth.uid(), user_id));
