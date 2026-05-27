-- RPC para Inativação de Usuário com Migração de Vínculos
-- Esta função garante que o histórico seja preservado e as responsabilidades transferidas atomicamente.

CREATE OR REPLACE FUNCTION fn_inactivate_user_with_migration(
  p_target_profile_id   UUID,
  p_successor_profile_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_user_id UUID;
    v_successor_user_id UUID;
BEGIN
    -- 1. Obter os user_id da tabela auth.users (necessário para migração em developers)
    SELECT user_id INTO v_target_user_id FROM public.profiles WHERE id = p_target_profile_id;
    SELECT user_id INTO v_successor_user_id FROM public.profiles WHERE id = p_successor_profile_id;

    -- 2. Migração na tabela 'demandas' (Sustentação)
    UPDATE public.demandas
    SET
        responsavel_requisitos = CASE WHEN responsavel_requisitos = p_target_profile_id THEN p_successor_profile_id ELSE responsavel_requisitos END,
        responsavel_dev        = CASE WHEN responsavel_dev = p_target_profile_id THEN p_successor_profile_id ELSE responsavel_dev END,
        responsavel_teste      = CASE WHEN responsavel_teste = p_target_profile_id THEN p_successor_profile_id ELSE responsavel_teste END,
        responsavel_arquiteto  = CASE WHEN responsavel_arquiteto = p_target_profile_id THEN p_successor_profile_id ELSE responsavel_arquiteto END,
        aceite_responsavel     = CASE WHEN aceite_responsavel = p_target_profile_id THEN p_successor_profile_id ELSE aceite_responsavel END,
        demandante             = CASE WHEN demandante = p_target_profile_id THEN p_successor_profile_id ELSE demandante END
    WHERE
        responsavel_requisitos = p_target_profile_id OR
        responsavel_dev        = p_target_profile_id OR
        responsavel_teste      = p_target_profile_id OR
        responsavel_arquiteto  = p_target_profile_id OR
        aceite_responsavel     = p_target_profile_id OR
        demandante             = p_target_profile_id;

    -- 3. Migração na tabela 'demanda_responsaveis' (Vínculos muitos-para-muitos)
    -- Evitar duplicidade: se o sucessor já tiver o mesmo papel na demanda, removemos o registro do alvo em vez de dar update.
    DELETE FROM public.demanda_responsaveis dr_target
    WHERE dr_target.user_id = v_target_user_id
      AND EXISTS (
          SELECT 1 FROM public.demanda_responsaveis dr_successor
          WHERE dr_successor.demanda_id = dr_target.demanda_id
            AND dr_successor.papel = dr_target.papel
            AND dr_successor.user_id = v_successor_user_id
      );

    UPDATE public.demanda_responsaveis
    SET user_id = v_successor_user_id
    WHERE user_id = v_target_user_id;

    -- 4. Migração na tabela 'rdms' e 'rdm_participantes'
    UPDATE public.rdms
    SET criado_por = p_successor_profile_id
    WHERE criado_por = p_target_profile_id;

    DELETE FROM public.rdm_participantes rp_target
    WHERE rp_target.profile_id = p_target_profile_id
      AND EXISTS (
          SELECT 1 FROM public.rdm_participantes rp_successor
          WHERE rp_successor.rdm_id = rp_target.rdm_id
            AND rp_successor.papel = rp_target.papel
            AND rp_successor.profile_id = p_successor_profile_id
      );

    UPDATE public.rdm_participantes
    SET profile_id = p_successor_profile_id
    WHERE profile_id = p_target_profile_id;

    -- 5. Migração na Sala Ágil (Developers -> Activities/UserStories)
    -- Mapeamos os 'developers' do usuário alvo para os 'developers' do sucessor nos mesmos times.
    UPDATE public.activities act
    SET assignee_id = (
        SELECT dev_succ.id
        FROM public.developers dev_target
        JOIN public.developers dev_succ ON dev_succ.team_id = dev_target.team_id
        WHERE dev_target.id = act.assignee_id
          AND dev_target.user_id = v_target_user_id
          AND dev_succ.user_id = v_successor_user_id
        LIMIT 1
    )
    WHERE assignee_id IN (SELECT id FROM public.developers WHERE user_id = v_target_user_id);

    UPDATE public.user_stories us
    SET assignee_id = (
        SELECT dev_succ.id
        FROM public.developers dev_target
        JOIN public.developers dev_succ ON dev_succ.team_id = dev_target.team_id
        WHERE dev_target.id = us.assignee_id
          AND dev_target.user_id = v_target_user_id
          AND dev_succ.user_id = v_successor_user_id
        LIMIT 1
    )
    WHERE assignee_id IN (SELECT id FROM public.developers WHERE user_id = v_target_user_id);

    -- 6. Inativação do Perfil
    UPDATE public.profiles
    SET is_active = false
    WHERE id = p_target_profile_id;

    -- 7. Audit Log (Opcional dentro da RPC, mas recomendado para Risco Zero)
    -- Assume que a tabela de audit log existe (como visto em UserRolesManager)
    INSERT INTO public.user_management_audit_log (actor_id, target_id, action, payload)
    VALUES (
        auth.uid(),
        v_target_user_id,
        'inactivate_user_with_migration',
        jsonb_build_object(
            'successor_profile_id', p_successor_profile_id,
            'successor_user_id', v_successor_user_id
        )
    );

END;
$$;

-- Permissões
REVOKE ALL ON FUNCTION fn_inactivate_user_with_migration(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fn_inactivate_user_with_migration(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION fn_inactivate_user_with_migration IS 'Inativa um usuário e transfere atomicamente todas as suas responsabilidades para um sucessor.';
