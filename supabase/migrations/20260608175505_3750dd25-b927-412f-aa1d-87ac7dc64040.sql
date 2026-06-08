-- ============================================================
-- Regra de duplicidade por RHM: passa a considerar RHM + Projeto
-- Antes: UNIQUE(team_id, rhm) bloqueava mesmo RHM em projetos diferentes.
-- Agora: UNIQUE(team_id, rhm, projeto_chave) onde projeto_chave usa
--        project_id quando existir, ou o nome normalizado do projeto.
-- ============================================================

-- 1) Remove a restrição antiga que bloqueava por (team_id, rhm)
ALTER TABLE public.demandas
  DROP CONSTRAINT IF EXISTS demandas_team_id_rhm_key;

-- 2) Cria índice único equivalente, agora incluindo o projeto.
--    COALESCE garante chave estável mesmo para registros antigos sem project_id.
CREATE UNIQUE INDEX IF NOT EXISTS demandas_team_rhm_projeto_uniq_idx
  ON public.demandas (
    team_id,
    btrim(rhm),
    COALESCE(project_id::text, lower(btrim(projeto)))
  );

COMMENT ON INDEX public.demandas_team_rhm_projeto_uniq_idx IS
  'Garante unicidade do RHM por projeto dentro do mesmo time. '
  'Mesmo RHM em projetos diferentes é permitido.';

-- 3) Atualiza o upsert_demandas_batch para casar por RHM + projeto
CREATE OR REPLACE FUNCTION public.upsert_demandas_batch(
  p_team_id UUID,
  p_rows    JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_importados  INT := 0;
  v_atualizados INT := 0;
  v_erros       INT := 0;
  v_row         JSONB;
  v_affected    INT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = p_team_id AND user_id = auth.uid()
  ) AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'access_denied: user does not belong to team %', p_team_id
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    BEGIN
      UPDATE demandas SET
        projeto                    = v_row->>'projeto',
        situacao                   = v_row->>'situacao',
        tipo                       = v_row->>'tipo',
        sla                        = v_row->>'sla',
        descricao                  = v_row->>'descricao',
        tipo_defeito               = v_row->>'tipo_defeito',
        originada_diagnostico      = CASE
                                       WHEN v_row->>'originada_diagnostico' IS NULL THEN NULL
                                       ELSE (v_row->>'originada_diagnostico')::boolean
                                     END,
        data_previsao_encerramento = CASE
                                       WHEN v_row->>'data_previsao_encerramento' = '' OR v_row->>'data_previsao_encerramento' IS NULL THEN NULL
                                       ELSE (v_row->>'data_previsao_encerramento')::date
                                     END,
        prazo_inicio_atendimento   = CASE
                                       WHEN v_row->>'prazo_inicio_atendimento' = '' OR v_row->>'prazo_inicio_atendimento' IS NULL THEN NULL
                                       ELSE (v_row->>'prazo_inicio_atendimento')::date
                                     END,
        prazo_solucao              = CASE
                                       WHEN v_row->>'prazo_solucao' = '' OR v_row->>'prazo_solucao' IS NULL THEN NULL
                                       ELSE (v_row->>'prazo_solucao')::date
                                     END,
        updated_at                 = now()
      WHERE team_id = p_team_id
        AND btrim(rhm) = btrim(v_row->>'rhm')
        AND lower(btrim(projeto)) = lower(btrim(v_row->>'projeto'));

      GET DIAGNOSTICS v_affected = ROW_COUNT;

      IF v_affected > 0 THEN
        v_atualizados := v_atualizados + 1;
      ELSE
        INSERT INTO demandas (
          team_id, rhm, projeto, situacao, tipo, sla,
          descricao, tipo_defeito, originada_diagnostico,
          data_previsao_encerramento, prazo_inicio_atendimento, prazo_solucao
        ) VALUES (
          p_team_id,
          v_row->>'rhm',
          v_row->>'projeto',
          v_row->>'situacao',
          v_row->>'tipo',
          v_row->>'sla',
          v_row->>'descricao',
          v_row->>'tipo_defeito',
          CASE
            WHEN v_row->>'originada_diagnostico' IS NULL THEN NULL
            ELSE (v_row->>'originada_diagnostico')::boolean
          END,
          CASE
            WHEN v_row->>'data_previsao_encerramento' = '' OR v_row->>'data_previsao_encerramento' IS NULL THEN NULL
            ELSE (v_row->>'data_previsao_encerramento')::date
          END,
          CASE
            WHEN v_row->>'prazo_inicio_atendimento' = '' OR v_row->>'prazo_inicio_atendimento' IS NULL THEN NULL
            ELSE (v_row->>'prazo_inicio_atendimento')::date
          END,
          CASE
            WHEN v_row->>'prazo_solucao' = '' OR v_row->>'prazo_solucao' IS NULL THEN NULL
            ELSE (v_row->>'prazo_solucao')::date
          END
        );
        v_importados := v_importados + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'importados',  v_importados,
    'atualizados', v_atualizados,
    'erros',       v_erros
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_demandas_batch(UUID, JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.upsert_demandas_batch(UUID, JSONB) TO authenticated;