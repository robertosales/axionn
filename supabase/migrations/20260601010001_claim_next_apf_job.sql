-- ============================================================
-- RPC: claim_next_apf_job
--
-- Seleciona e bloqueia atomicamente 1 job pendente da fila apf_jobs.
-- Usa SELECT FOR UPDATE SKIP LOCKED para garantir que 2 workers
-- concorrentes nunca processem o mesmo job.
--
-- Retorna: SETOF apf_jobs (0 ou 1 linha)
-- Chamada pelo worker process-apf-job via admin.rpc('claim_next_apf_job')
-- ============================================================

CREATE OR REPLACE FUNCTION claim_next_apf_job()
RETURNS SETOF apf_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job apf_jobs;
BEGIN
  SELECT *
    INTO v_job
    FROM apf_jobs
   WHERE status = 'pending'
     AND next_attempt_at <= now()
   ORDER BY next_attempt_at ASC
   LIMIT 1
     FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN;  -- fila vazia
  END IF;

  RETURN NEXT v_job;
END;
$$;

-- Apenas service_role pode executar esta função
REVOKE ALL ON FUNCTION claim_next_apf_job() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_next_apf_job() TO service_role;

COMMENT ON FUNCTION claim_next_apf_job IS
  'Retorna e bloqueia atomicamente o próximo job pendente de apf_jobs. '
  'SELECT FOR UPDATE SKIP LOCKED garante exclusividade entre workers concorrentes.';
