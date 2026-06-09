
CREATE OR REPLACE FUNCTION public.upsert_demandas_batch(p_team_id uuid, p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_flow CONSTANT TEXT[] := ARRAY[
    'fila_atendimento','planejamento_elaboracao','planejamento_ag_aprovacao',
    'planejamento_aprovada','em_execucao','hom_ag_homologacao','hom_homologada',
    'fila_producao','ag_aceite_final'
  ];
  v_especiais CONSTANT TEXT[] := ARRAY['bloqueada','rejeitada','cancelada','fila_concluida'];
  v_terminais CONSTANT TEXT[] := ARRAY['ag_aceite_final','cancelada'];

  v_importados  INT := 0;
  v_atualizados INT := 0;
  v_erros       INT := 0;
  v_row         JSONB;
  v_falhas      JSONB := '[]'::jsonb;

  v_demanda_id   uuid;
  v_situacao_now TEXT;
  v_situacao_new TEXT;
  v_idx_from     INT;
  v_idx_to       INT;
  i              INT;
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
      v_situacao_new := v_row->>'situacao';

      SELECT id, situacao
        INTO v_demanda_id, v_situacao_now
      FROM demandas
      WHERE team_id = p_team_id
        AND btrim(rhm) = btrim(v_row->>'rhm')
        AND lower(btrim(projeto)) = lower(btrim(v_row->>'projeto'))
      LIMIT 1;

      IF v_demanda_id IS NOT NULL THEN
        IF v_situacao_now IS NOT DISTINCT FROM v_situacao_new THEN
          -- Idempotente: mesma situação → só atualiza campos auxiliares
          UPDATE demandas SET
            projeto                    = v_row->>'projeto',
            tipo                       = v_row->>'tipo',
            sla                        = v_row->>'sla',
            descricao                  = v_row->>'descricao',
            tipo_defeito               = v_row->>'tipo_defeito',
            originada_diagnostico      = CASE WHEN v_row->>'originada_diagnostico' IS NULL THEN NULL
                                              ELSE (v_row->>'originada_diagnostico')::boolean END,
            data_previsao_encerramento = NULLIF(v_row->>'data_previsao_encerramento','')::date,
            prazo_inicio_atendimento   = NULLIF(v_row->>'prazo_inicio_atendimento','')::date,
            prazo_solucao              = NULLIF(v_row->>'prazo_solucao','')::date,
            updated_at                 = now()
          WHERE id = v_demanda_id;
          v_atualizados := v_atualizados + 1;

        ELSIF v_situacao_now = ANY(v_terminais) THEN
          -- Já está em terminal e planilha pede outra situação → ignora mudança de status
          UPDATE demandas SET
            tipo                       = v_row->>'tipo',
            sla                        = v_row->>'sla',
            descricao                  = v_row->>'descricao',
            tipo_defeito               = v_row->>'tipo_defeito',
            data_previsao_encerramento = NULLIF(v_row->>'data_previsao_encerramento','')::date,
            prazo_inicio_atendimento   = NULLIF(v_row->>'prazo_inicio_atendimento','')::date,
            prazo_solucao              = NULLIF(v_row->>'prazo_solucao','')::date,
            updated_at                 = now()
          WHERE id = v_demanda_id;
          v_atualizados := v_atualizados + 1;

        ELSE
          v_idx_from := array_position(v_flow, v_situacao_now);
          v_idx_to   := array_position(v_flow, v_situacao_new);

          -- Salto adiante no fluxo principal → cria passos intermediários
          IF v_idx_from IS NOT NULL
             AND v_idx_to   IS NOT NULL
             AND v_idx_to   > v_idx_from + 1
             AND NOT (v_situacao_new = ANY(v_especiais))
             AND NOT (v_situacao_now = ANY(v_especiais)) THEN

            FOR i IN (v_idx_from + 1)..(v_idx_to - 1) LOOP
              UPDATE demandas SET
                situacao   = v_flow[i],
                updated_at = now()
              WHERE id = v_demanda_id;
              UPDATE demanda_transitions
                 SET justificativa = COALESCE(justificativa, 'Importação automática (planilha)')
               WHERE demanda_id = v_demanda_id
                 AND id = (SELECT id FROM demanda_transitions
                            WHERE demanda_id = v_demanda_id
                            ORDER BY created_at DESC LIMIT 1);
            END LOOP;
          END IF;

          UPDATE demandas SET
            projeto                    = v_row->>'projeto',
            situacao                   = v_situacao_new,
            tipo                       = v_row->>'tipo',
            sla                        = v_row->>'sla',
            descricao                  = v_row->>'descricao',
            tipo_defeito               = v_row->>'tipo_defeito',
            originada_diagnostico      = CASE WHEN v_row->>'originada_diagnostico' IS NULL THEN NULL
                                              ELSE (v_row->>'originada_diagnostico')::boolean END,
            data_previsao_encerramento = NULLIF(v_row->>'data_previsao_encerramento','')::date,
            prazo_inicio_atendimento   = NULLIF(v_row->>'prazo_inicio_atendimento','')::date,
            prazo_solucao              = NULLIF(v_row->>'prazo_solucao','')::date,
            updated_at                 = now()
          WHERE id = v_demanda_id;

          UPDATE demanda_transitions
             SET justificativa = COALESCE(justificativa, 'Importação automática (planilha)')
           WHERE demanda_id = v_demanda_id
             AND id = (SELECT id FROM demanda_transitions
                        WHERE demanda_id = v_demanda_id
                        ORDER BY created_at DESC LIMIT 1);

          v_atualizados := v_atualizados + 1;
        END IF;

      ELSE
        INSERT INTO demandas (
          team_id, rhm, projeto, situacao, tipo, sla,
          descricao, tipo_defeito, originada_diagnostico,
          data_previsao_encerramento, prazo_inicio_atendimento, prazo_solucao
        ) VALUES (
          p_team_id,
          v_row->>'rhm',
          v_row->>'projeto',
          v_situacao_new,
          v_row->>'tipo',
          v_row->>'sla',
          v_row->>'descricao',
          v_row->>'tipo_defeito',
          CASE WHEN v_row->>'originada_diagnostico' IS NULL THEN NULL
               ELSE (v_row->>'originada_diagnostico')::boolean END,
          NULLIF(v_row->>'data_previsao_encerramento','')::date,
          NULLIF(v_row->>'prazo_inicio_atendimento','')::date,
          NULLIF(v_row->>'prazo_solucao','')::date
        );
        v_importados := v_importados + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_erros := v_erros + 1;
      v_falhas := v_falhas || jsonb_build_object(
        'rhm',     COALESCE(v_row->>'rhm', ''),
        'projeto', COALESCE(v_row->>'projeto', ''),
        'motivo',  SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'importados', v_importados,
    'atualizados', v_atualizados,
    'erros', v_erros,
    'falhas', v_falhas
  );
END;
$function$;


-- Merge 25925
DO $$
DECLARE
  v_keep uuid := '3100f84d-d056-4dbd-8855-2697c4ea7841';
  v_drop uuid := '6c851aa1-b736-4e7d-b444-f037677c6b15';
BEGIN
  IF EXISTS (SELECT 1 FROM demandas WHERE id = v_drop)
     AND EXISTS (SELECT 1 FROM demandas WHERE id = v_keep) THEN

    UPDATE demanda_transitions SET demanda_id = v_keep WHERE demanda_id = v_drop;
    UPDATE demanda_hours       SET demanda_id = v_keep WHERE demanda_id = v_drop;
    UPDATE demanda_evidencias  SET demanda_id = v_keep WHERE demanda_id = v_drop;
    UPDATE demanda_eventos     SET demanda_id = v_keep WHERE demanda_id = v_drop;

    INSERT INTO demanda_responsaveis (demanda_id, user_id, papel, created_at)
    SELECT v_keep, user_id, papel, created_at
      FROM demanda_responsaveis dr
     WHERE dr.demanda_id = v_drop
       AND NOT EXISTS (
         SELECT 1 FROM demanda_responsaveis r2
          WHERE r2.demanda_id = v_keep AND r2.user_id = dr.user_id
       );
    DELETE FROM demanda_responsaveis WHERE demanda_id = v_drop;

    DELETE FROM demandas WHERE id = v_drop;
  END IF;
END $$;
