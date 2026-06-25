-- Drop old open_counting_session (project-based) and create contract-based version.
DROP FUNCTION IF EXISTS public.open_counting_session(UUID, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.open_counting_session(
  p_contract_id  UUID,
  p_project_id   UUID DEFAULT NULL,
  p_sprint_ref   TEXT DEFAULT NULL,
  p_release_ref  TEXT DEFAULT NULL,
  p_redmine_ref  TEXT DEFAULT NULL,
  p_baseline_id  UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_id UUID := p_contract_id;
  v_model_id    UUID;
  v_session_id  UUID;
BEGIN
  -- Fallback: derive contract from project if not informed
  IF v_contract_id IS NULL AND p_project_id IS NOT NULL THEN
    SELECT p.contract_id INTO v_contract_id
    FROM public.projects p
    WHERE p.id = p_project_id;
  END IF;

  IF v_contract_id IS NULL THEN
    RAISE EXCEPTION 'Contrato não informado e não foi possível resolver a partir do projeto %', p_project_id;
  END IF;

  SELECT m.id INTO v_model_id
  FROM public.apf_counting_models m
  WHERE m.contract_id = v_contract_id
    AND m.is_active = true
  ORDER BY m.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_model_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum modelo APF ativo encontrado para o contrato %', v_contract_id;
  END IF;

  INSERT INTO public.apf_counting_sessions (
    project_id, model_id, baseline_id,
    sprint_ref, release_ref, redmine_ref,
    analyst_id, status
  ) VALUES (
    p_project_id, v_model_id, p_baseline_id,
    p_sprint_ref, p_release_ref, p_redmine_ref,
    auth.uid(), 'in_progress'
  )
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_counting_session(UUID, UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;