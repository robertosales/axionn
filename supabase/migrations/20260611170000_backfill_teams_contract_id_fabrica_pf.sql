-- ============================================================
-- Backfill teams.contract_id → CONTRATO DE FABRICA PF
-- Executa somente quando existem times legados sem contrato.
-- Bancos novos, sem dados legados, seguem o replay normalmente.
-- ============================================================

DO $$
DECLARE
  v_contract_id constant uuid := 'd59ab6dc-421f-41b4-b415-ae0bc072ebd4';
  v_contract_status text;
  v_pending_teams integer;
  v_updated_teams integer;
BEGIN
  SELECT count(*)
    INTO v_pending_teams
    FROM public.teams
   WHERE contract_id IS NULL;

  IF v_pending_teams = 0 THEN
    RAISE NOTICE 'Backfill Fábrica PF ignorado: nenhum time legado sem contrato.';
    RETURN;
  END IF;

  SELECT contract.status
    INTO v_contract_status
    FROM public.contracts contract
   WHERE contract.id = v_contract_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'ABORT: existem % times sem contrato, mas o contrato Fábrica PF % não foi encontrado.',
      v_pending_teams,
      v_contract_id;
  END IF;

  IF v_contract_status <> 'active' THEN
    RAISE EXCEPTION
      'ABORT: contrato Fábrica PF % está com status %. Esperado: active.',
      v_contract_id,
      v_contract_status;
  END IF;

  UPDATE public.teams
     SET contract_id = v_contract_id,
         updated_at = now()
   WHERE contract_id IS NULL;

  GET DIAGNOSTICS v_updated_teams = ROW_COUNT;

  RAISE NOTICE
    'Backfill Fábrica PF concluído: % times vinculados ao contrato %.',
    v_updated_teams,
    v_contract_id;
END;
$$;
