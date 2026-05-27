-- RPC para Inativação de Usuário com Migração Automática de Vínculos
CREATE OR REPLACE FUNCTION public.fn_inactivate_user_with_migration(
  p_old_user_id UUID,
  p_new_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_profile_id UUID;
  v_new_profile_id UUID;
  v_old_developer_id UUID;
  v_new_developer_id UUID;
  v_affected_counts JSONB := '{}'::jsonb;
  v_temp_count INTEGER;
BEGIN
  -- 1. Obter os IDs de Profile (v_old_user_id e v_new_user_id são os user_id da auth.users)
  SELECT id INTO v_old_profile_id FROM public.profiles WHERE user_id = p_old_user_id;
  SELECT id INTO v_new_profile_id FROM public.profiles WHERE user_id = p_new_user_id;

  IF v_old_profile_id IS NULL THEN
    RAISE EXCEPTION 'Usuário de origem não encontrado.';
  END IF;

  IF v_new_profile_id IS NULL THEN
    RAISE EXCEPTION 'Usuário de destino não encontrado.';
  END IF;

  -- 2. Migrar vínculos que usam profile_id (ID da tabela profiles)

  -- demandas
  UPDATE public.demandas SET responsavel_requisitos = v_new_profile_id WHERE responsavel_requisitos = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts = v_affected_counts || jsonb_build_object('demandas_requisitos', v_temp_count);

  UPDATE public.demandas SET responsavel_dev = v_new_profile_id WHERE responsavel_dev = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts = v_affected_counts || jsonb_build_object('demandas_dev', v_temp_count);

  UPDATE public.demandas SET responsavel_teste = v_new_profile_id WHERE responsavel_teste = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts = v_affected_counts || jsonb_build_object('demandas_teste', v_temp_count);

  UPDATE public.demandas SET responsavel_arquiteto = v_new_profile_id WHERE responsavel_arquiteto = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts = v_affected_counts || jsonb_build_object('demandas_arquiteto', v_temp_count);

  UPDATE public.demandas SET aceite_responsavel = v_new_profile_id WHERE aceite_responsavel = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts = v_affected_counts || jsonb_build_object('demandas_aceite', v_temp_count);

  UPDATE public.demandas SET demandante = v_new_profile_id WHERE demandante = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts = v_affected_counts || jsonb_build_object('demandas_demandante', v_temp_count);

  -- demanda_responsaveis (tabela associativa)
  -- Evitar duplicidade se o novo usuário já for responsável
  DELETE FROM public.demanda_responsaveis dr1
  WHERE user_id = v_old_profile_id
    AND EXISTS (
      SELECT 1 FROM public.demanda_responsaveis dr2
      WHERE dr2.demanda_id = dr1.demanda_id
        AND dr2.user_id = v_new_profile_id
        AND dr2.papel = dr1.papel
    );

  UPDATE public.demanda_responsaveis SET user_id = v_new_profile_id WHERE user_id = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts = v_affected_counts || jsonb_build_object('demanda_responsaveis', v_temp_count);

  -- RDM
  UPDATE public.rdms SET criado_por = v_new_profile_id WHERE criado_por = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts = v_affected_counts || jsonb_build_object('rdms_criado_por', v_temp_count);

  UPDATE public.rdm_checklist_items SET responsavel_id = v_new_profile_id WHERE responsavel_id = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts = v_affected_counts || jsonb_build_object('rdm_checklist_items', v_temp_count);

  UPDATE public.rdm_deployment_tasks SET responsavel_id = v_new_profile_id WHERE responsavel_id = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts = v_affected_counts || jsonb_build_object('rdm_deployment_tasks', v_temp_count);

  UPDATE public.rdm_gonogo SET profile_id = v_new_profile_id WHERE profile_id = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts = v_affected_counts || jsonb_build_object('rdm_gonogo', v_temp_count);

  UPDATE public.rdm_participantes SET profile_id = v_new_profile_id WHERE profile_id = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts = v_affected_counts || jsonb_build_object('rdm_participantes', v_temp_count);

  -- 3. Migrar vínculos que usam auth.user_id (p_old_user_id e p_new_user_id)

  -- APF
  UPDATE public.apf_generations SET generated_by = p_new_user_id WHERE generated_by = p_old_user_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts = v_affected_counts || jsonb_build_object('apf_generations', v_temp_count);

  UPDATE public.apf_templates SET created_by = p_new_user_id WHERE created_by = p_old_user_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts = v_affected_counts || jsonb_build_object('apf_templates', v_temp_count);

  -- 4. Migrar vínculos na tabela developers (assignee_id em activities e user_stories)
  -- Nota: developers.user_id aponta para auth.users(id)
  SELECT id INTO v_old_developer_id FROM public.developers WHERE user_id = p_old_user_id;
  SELECT id INTO v_new_developer_id FROM public.developers WHERE user_id = p_new_user_id;

  IF v_old_developer_id IS NOT NULL AND v_new_developer_id IS NOT NULL THEN
    UPDATE public.user_stories SET assignee_id = v_new_developer_id WHERE assignee_id = v_old_developer_id;
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_affected_counts = v_affected_counts || jsonb_build_object('user_stories_assignee', v_temp_count);

    UPDATE public.activities SET assignee_id = v_new_developer_id WHERE assignee_id = v_old_developer_id;
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_affected_counts = v_affected_counts || jsonb_build_object('activities_assignee', v_temp_count);

    -- Votos Planning
    UPDATE public.user_stories SET voted_by = p_new_user_id WHERE voted_by = p_old_user_id;
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_affected_counts = v_affected_counts || jsonb_build_object('user_stories_voted_by', v_temp_count);
  END IF;

  -- 5. Inativar o perfil
  UPDATE public.profiles SET is_active = false WHERE user_id = p_old_user_id;

  -- 6. Remover de todos os times para evitar que apareça em listas ativas
  DELETE FROM public.team_members WHERE user_id = p_old_user_id;

  RETURN json_build_object(
    'success', true,
    'affected_counts', v_affected_counts
  );
END;
$$ ;
