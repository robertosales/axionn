-- RPC canônica para inativação de usuário com migração automática de vínculos.
-- A migration anterior criou a mesma assinatura com RETURNS VOID; PostgreSQL
-- exige DROP explícito antes da mudança para JSON.

DROP FUNCTION IF EXISTS public.fn_inactivate_user_with_migration(uuid, uuid);

CREATE FUNCTION public.fn_inactivate_user_with_migration(
  p_old_user_id uuid,
  p_new_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_profile_id uuid;
  v_new_profile_id uuid;
  v_old_developer_id uuid;
  v_new_developer_id uuid;
  v_affected_counts jsonb := '{}'::jsonb;
  v_temp_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  IF p_old_user_id = p_new_user_id THEN
    RAISE EXCEPTION 'successor_must_be_different';
  END IF;

  SELECT id
    INTO v_old_profile_id
    FROM public.profiles
   WHERE user_id = p_old_user_id;

  SELECT id
    INTO v_new_profile_id
    FROM public.profiles
   WHERE user_id = p_new_user_id
     AND coalesce(is_active, true) = true;

  IF v_old_profile_id IS NULL THEN
    RAISE EXCEPTION 'source_user_not_found';
  END IF;

  IF v_new_profile_id IS NULL THEN
    RAISE EXCEPTION 'active_successor_not_found';
  END IF;

  UPDATE public.demandas
     SET responsavel_requisitos = v_new_profile_id
   WHERE responsavel_requisitos = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts := v_affected_counts || jsonb_build_object('demandas_requisitos', v_temp_count);

  UPDATE public.demandas
     SET responsavel_dev = v_new_profile_id
   WHERE responsavel_dev = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts := v_affected_counts || jsonb_build_object('demandas_dev', v_temp_count);

  UPDATE public.demandas
     SET responsavel_teste = v_new_profile_id
   WHERE responsavel_teste = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts := v_affected_counts || jsonb_build_object('demandas_teste', v_temp_count);

  UPDATE public.demandas
     SET responsavel_arquiteto = v_new_profile_id
   WHERE responsavel_arquiteto = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts := v_affected_counts || jsonb_build_object('demandas_arquiteto', v_temp_count);

  UPDATE public.demandas
     SET aceite_responsavel = v_new_profile_id
   WHERE aceite_responsavel = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts := v_affected_counts || jsonb_build_object('demandas_aceite', v_temp_count);

  UPDATE public.demandas
     SET demandante = v_new_profile_id
   WHERE demandante = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts := v_affected_counts || jsonb_build_object('demandas_demandante', v_temp_count);

  -- demanda_responsaveis.user_id referencia profiles.user_id/auth.users.id.
  DELETE FROM public.demanda_responsaveis source_relation
   WHERE source_relation.user_id = p_old_user_id
     AND EXISTS (
       SELECT 1
         FROM public.demanda_responsaveis successor_relation
        WHERE successor_relation.demanda_id = source_relation.demanda_id
          AND successor_relation.user_id = p_new_user_id
          AND successor_relation.papel = source_relation.papel
     );

  UPDATE public.demanda_responsaveis
     SET user_id = p_new_user_id
   WHERE user_id = p_old_user_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts := v_affected_counts || jsonb_build_object('demanda_responsaveis', v_temp_count);

  UPDATE public.rdms
     SET criado_por = v_new_profile_id
   WHERE criado_por = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts := v_affected_counts || jsonb_build_object('rdms_criado_por', v_temp_count);

  UPDATE public.rdm_checklist_items
     SET responsavel_id = v_new_profile_id
   WHERE responsavel_id = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts := v_affected_counts || jsonb_build_object('rdm_checklist_items', v_temp_count);

  UPDATE public.rdm_deployment_tasks
     SET responsavel_id = v_new_profile_id
   WHERE responsavel_id = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts := v_affected_counts || jsonb_build_object('rdm_deployment_tasks', v_temp_count);

  UPDATE public.rdm_gonogo
     SET profile_id = v_new_profile_id
   WHERE profile_id = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts := v_affected_counts || jsonb_build_object('rdm_gonogo', v_temp_count);

  DELETE FROM public.rdm_participantes source_participant
   WHERE source_participant.profile_id = v_old_profile_id
     AND EXISTS (
       SELECT 1
         FROM public.rdm_participantes successor_participant
        WHERE successor_participant.rdm_id = source_participant.rdm_id
          AND successor_participant.profile_id = v_new_profile_id
          AND successor_participant.papel = source_participant.papel
     );

  UPDATE public.rdm_participantes
     SET profile_id = v_new_profile_id
   WHERE profile_id = v_old_profile_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts := v_affected_counts || jsonb_build_object('rdm_participantes', v_temp_count);

  UPDATE public.apf_generations
     SET generated_by = p_new_user_id
   WHERE generated_by = p_old_user_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts := v_affected_counts || jsonb_build_object('apf_generations', v_temp_count);

  UPDATE public.apf_templates
     SET created_by = p_new_user_id
   WHERE created_by = p_old_user_id;
  GET DIAGNOSTICS v_temp_count = ROW_COUNT;
  v_affected_counts := v_affected_counts || jsonb_build_object('apf_templates', v_temp_count);

  SELECT id
    INTO v_old_developer_id
    FROM public.developers
   WHERE user_id = p_old_user_id
   ORDER BY created_at
   LIMIT 1;

  SELECT id
    INTO v_new_developer_id
    FROM public.developers
   WHERE user_id = p_new_user_id
   ORDER BY created_at
   LIMIT 1;

  IF v_old_developer_id IS NOT NULL AND v_new_developer_id IS NOT NULL THEN
    UPDATE public.user_stories
       SET assignee_id = v_new_developer_id
     WHERE assignee_id = v_old_developer_id;
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_affected_counts := v_affected_counts || jsonb_build_object('user_stories_assignee', v_temp_count);

    UPDATE public.activities
       SET assignee_id = v_new_developer_id
     WHERE assignee_id = v_old_developer_id;
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_affected_counts := v_affected_counts || jsonb_build_object('activities_assignee', v_temp_count);
  END IF;

  UPDATE public.profiles
     SET is_active = false
   WHERE user_id = p_old_user_id;

  DELETE FROM public.team_members
   WHERE user_id = p_old_user_id;

  IF to_regclass('public.user_management_audit_log') IS NOT NULL THEN
    INSERT INTO public.user_management_audit_log (
      actor_id,
      target_id,
      action,
      payload
    )
    VALUES (
      auth.uid(),
      p_old_user_id,
      'inactivate_user_with_migration',
      jsonb_build_object(
        'successor_user_id', p_new_user_id,
        'affected_counts', v_affected_counts
      )
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'affected_counts', v_affected_counts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_inactivate_user_with_migration(uuid, uuid)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_inactivate_user_with_migration(uuid, uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.fn_inactivate_user_with_migration(uuid, uuid) IS
  'Inativa um usuário e transfere vínculos para outro auth user; execução restrita a administradores.';
