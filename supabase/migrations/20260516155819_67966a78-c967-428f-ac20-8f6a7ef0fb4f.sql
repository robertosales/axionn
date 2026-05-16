-- Fix: permitir que admins acessem RPCs do Dashboard Admin com qualquer team_id.
-- O helper _assert_team_access antes exigia que o chamador fosse membro de TODOS os times,
-- o que quebrava as RPCs get_sprint_history / get_capacity_planner / get_admin_kpis para
-- usuários admin (que normalmente não são membros de todos os times do sistema).

CREATE OR REPLACE FUNCTION _assert_team_access(p_team_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_allowed_ids  UUID[];
  v_unauthorized UUID[];
BEGIN
  -- Usuário não autenticado
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Admins têm acesso a todos os times (Dashboard Admin)
  IF public.has_role(v_uid, 'admin'::public.app_role) THEN
    RETURN;
  END IF;

  -- Lista vazia: nada a validar
  IF p_team_ids IS NULL OR array_length(p_team_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Times que o usuário realmente pode acessar
  SELECT ARRAY_AGG(tm.team_id)
  INTO   v_allowed_ids
  FROM   public.team_members tm
  WHERE  tm.user_id = v_uid
    AND  tm.team_id = ANY(p_team_ids);

  -- Times solicitados que não estão na lista permitida
  SELECT ARRAY_AGG(t)
  INTO   v_unauthorized
  FROM   UNNEST(p_team_ids) AS t
  WHERE  t <> ALL(COALESCE(v_allowed_ids, ARRAY[]::UUID[]));

  IF v_unauthorized IS NOT NULL AND array_length(v_unauthorized, 1) > 0 THEN
    RAISE EXCEPTION 'Acesso negado aos times: %', v_unauthorized
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION _assert_team_access(UUID[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION _assert_team_access(UUID[]) TO authenticated;