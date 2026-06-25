-- ============================================================
-- APF contratual baseline-first: importação, contexto e busca.
-- ============================================================

CREATE OR REPLACE FUNCTION public.apf_import_baseline(
  p_project_id UUID,
  p_version TEXT,
  p_label TEXT DEFAULT NULL,
  p_source_name TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_function_types JSONB DEFAULT '[]'::jsonb,
  p_impact_factors JSONB DEFAULT '[]'::jsonb,
  p_source_summary JSONB DEFAULT '{}'::jsonb,
  p_activate BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_id UUID;
  v_team_id UUID;
  v_model_id UUID;
  v_baseline_id UUID;
  v_item JSONB;
  v_type JSONB;
  v_factor JSONB;
  v_function_sigla TEXT;
  v_factor_sigla TEXT;
  v_pf_bruto NUMERIC(8,2);
  v_pct NUMERIC(6,2);
  v_pf_fs NUMERIC(8,2);
  v_inserted INT := 0;
  v_pf_bruto_total NUMERIC(12,2) := 0;
  v_pf_fs_total NUMERIC(12,2) := 0;
BEGIN
  IF p_project_id IS NULL OR nullif(trim(p_version), '') IS NULL THEN
    RAISE EXCEPTION 'project_id e version são obrigatórios';
  END IF;

  IF jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'A baseline precisa conter ao menos um item';
  END IF;

  SELECT contract_id, team_id
  INTO v_contract_id, v_team_id
  FROM public.projects
  WHERE id = p_project_id;

  IF v_contract_id IS NULL THEN
    RAISE EXCEPTION 'Projeto % não encontrado ou sem contrato vinculado', p_project_id;
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT (
       public.is_team_member(auth.uid(), v_team_id)
       OR public.has_role(auth.uid(), 'admin')
     ) THEN
    RAISE EXCEPTION 'Usuário sem permissão para importar baseline neste projeto'
      USING ERRCODE = '42501';
  END IF;

  SELECT id
  INTO v_model_id
  FROM public.apf_counting_models
  WHERE contract_id = v_contract_id
    AND is_active = true
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_model_id IS NULL THEN
    INSERT INTO public.apf_counting_models(
      contract_id,
      name,
      description,
      standard,
      is_active
    ) VALUES (
      v_contract_id,
      'PFS/DPF — Baseline Contratual',
      'Modelo configurado a partir da planilha oficial de métricas do sistema.',
      'pfs_dpf',
      true
    )
    RETURNING id INTO v_model_id;
  ELSE
    UPDATE public.apf_counting_models
    SET standard = 'pfs_dpf',
        is_active = true,
        updated_at = now()
    WHERE id = v_model_id;
  END IF;

  IF jsonb_array_length(coalesce(p_function_types, '[]'::jsonb)) > 0 THEN
    UPDATE public.apf_function_types
    SET is_active = false
    WHERE model_id = v_model_id;

    FOR v_type IN
      SELECT * FROM jsonb_array_elements(coalesce(p_function_types, '[]'::jsonb))
    LOOP
      INSERT INTO public.apf_function_types(
        model_id,
        sigla,
        name,
        func_class,
        weight,
        is_active,
        sort_order
      ) VALUES (
        v_model_id,
        upper(v_type->>'sigla'),
        coalesce(nullif(v_type->>'name', ''), upper(v_type->>'sigla')),
        coalesce(
          nullif(v_type->>'func_class', '')::public.apf_function_class,
          'transactional'::public.apf_function_class
        ),
        coalesce((v_type->>'weight')::numeric, 0),
        true,
        coalesce((v_type->>'sort_order')::int, 0)
      )
      ON CONFLICT (model_id, sigla) DO UPDATE SET
        name = excluded.name,
        func_class = excluded.func_class,
        weight = excluded.weight,
        is_active = true,
        sort_order = excluded.sort_order;
    END LOOP;
  ELSE
    INSERT INTO public.apf_function_types(
      model_id, sigla, name, func_class, weight, is_active, sort_order
    ) VALUES
      (v_model_id, 'TRN', 'Transação (Processo Elementar)', 'transactional', 4.60, true, 1),
      (v_model_id, 'ARQ', 'Arquivo', 'data', 7.00, true, 2)
    ON CONFLICT (model_id, sigla) DO UPDATE SET
      weight = excluded.weight,
      is_active = true,
      sort_order = excluded.sort_order;
  END IF;

  FOR v_factor IN
    SELECT * FROM jsonb_array_elements(coalesce(p_impact_factors, '[]'::jsonb))
  LOOP
    v_pct := coalesce((v_factor->>'contribution_pct')::numeric, 0);
    IF v_pct > 0 AND v_pct <= 1 THEN
      v_pct := v_pct * 100;
    END IF;

    INSERT INTO public.apf_impact_factors(
      model_id,
      sigla,
      name,
      contribution_pct,
      action_on_baseline,
      origin,
      is_inm,
      is_active,
      sort_order,
      notes
    ) VALUES (
      v_model_id,
      upper(v_factor->>'sigla'),
      coalesce(nullif(v_factor->>'name', ''), upper(v_factor->>'sigla')),
      v_pct,
      coalesce(nullif(v_factor->>'action_on_baseline', ''), 'Não Impacta'),
      nullif(v_factor->>'origin', ''),
      coalesce((v_factor->>'is_inm')::boolean, false),
      true,
      coalesce((v_factor->>'sort_order')::int, 0),
      nullif(v_factor->>'notes', '')
    )
    ON CONFLICT (model_id, sigla) DO UPDATE SET
      name = excluded.name,
      contribution_pct = excluded.contribution_pct,
      action_on_baseline = excluded.action_on_baseline,
      origin = excluded.origin,
      is_inm = excluded.is_inm,
      is_active = true,
      sort_order = excluded.sort_order,
      notes = excluded.notes;
  END LOOP;

  INSERT INTO public.apf_impact_factors(
    model_id,
    sigla,
    name,
    contribution_pct,
    action_on_baseline,
    origin,
    is_inm,
    is_active,
    sort_order
  ) VALUES
    (v_model_id, 'I', 'Inclusão', 100, 'Incluir/Alterar', 'Guia de Métricas DPF', false, true, 1),
    (v_model_id, 'A', 'Alteração', 60, 'Incluir/Alterar', 'Guia de Métricas DPF', false, true, 2),
    (v_model_id, 'E', 'Exclusão', 40, 'Remover', 'Guia de Métricas DPF', false, true, 3),
    (v_model_id, 'N/A', 'Não se Aplica', 0, 'Não Impacta', 'N/A', true, true, 999)
  ON CONFLICT (model_id, sigla) DO UPDATE SET
    contribution_pct = excluded.contribution_pct,
    action_on_baseline = excluded.action_on_baseline,
    is_inm = excluded.is_inm,
    is_active = true;

  INSERT INTO public.apf_counting_rules(
    model_id,
    rule_mission,
    rule_fundamental_principle,
    rule_decision_hierarchy,
    rule_critical_guidelines,
    rule_elementary_process,
    rule_granularity,
    rule_precedence_override,
    rule_contractual_consistency,
    rule_closure
  ) VALUES (
    v_model_id,
    'Reproduzir a medição oficial do contrato usando a baseline homologada e os precedentes validados pela equipe de métricas.',
    'A HU é gatilho. A unidade de contagem é o elemento funcional reconhecido na baseline ou uma nova função claramente independente.',
    '1. Correspondência exata na baseline. 2. Precedentes validados. 3. Regras contratuais. 4. Interpretação técnica justificada.',
    'Não maximizar PF. Não criar processos para validações, histórico, preview, mensagens, carregamentos ou etapas internas sem precedente.',
    'Um processo elementar deve possuir objetivo próprio, ser completo para o usuário e independente do fluxo principal.',
    'Em dúvida entre fragmentar e consolidar, consolidar. Só separar com precedente explícito.',
    'A classificação homologada pela equipe prevalece sobre teoria genérica.',
    'Tipos e fatores devem existir no modelo do contrato. Pesos e percentuais nunca são definidos pela IA.',
    'Registrar zona cinzenta quando não houver evidência suficiente. Não inventar elementos ausentes da baseline.'
  )
  ON CONFLICT (model_id) DO UPDATE SET
    rule_mission = excluded.rule_mission,
    rule_fundamental_principle = excluded.rule_fundamental_principle,
    rule_decision_hierarchy = excluded.rule_decision_hierarchy,
    rule_critical_guidelines = excluded.rule_critical_guidelines,
    rule_elementary_process = excluded.rule_elementary_process,
    rule_granularity = excluded.rule_granularity,
    rule_precedence_override = excluded.rule_precedence_override,
    rule_contractual_consistency = excluded.rule_contractual_consistency,
    rule_closure = excluded.rule_closure,
    updated_at = now();

  IF p_activate THEN
    UPDATE public.apf_project_baselines
    SET status = 'archived',
        updated_at = now()
    WHERE project_id = p_project_id
      AND status = 'active';
  END IF;

  INSERT INTO public.apf_project_baselines(
    project_id,
    model_id,
    version,
    label,
    status,
    imported_at,
    imported_by,
    source_file_name,
    source_summary
  ) VALUES (
    p_project_id,
    v_model_id,
    trim(p_version),
    nullif(trim(coalesce(p_label, '')), ''),
    CASE
      WHEN p_activate THEN 'active'::public.apf_baseline_status
      ELSE 'draft'::public.apf_baseline_status
    END,
    now(),
    auth.uid(),
    p_source_name,
    coalesce(p_source_summary, '{}'::jsonb)
  )
  RETURNING id INTO v_baseline_id;

  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_function_sigla := upper(coalesce(nullif(v_item->>'function_sigla', ''), 'N/A'));
    v_factor_sigla := upper(coalesce(nullif(v_item->>'factor_sigla', ''), 'N/A'));
    v_pf_bruto := coalesce((v_item->>'pf_bruto')::numeric, 0);
    v_pct := coalesce((v_item->>'contribution_pct')::numeric, 0);

    IF v_pct > 0 AND v_pct <= 1 THEN
      v_pct := v_pct * 100;
    END IF;

    IF v_pct = 0 AND v_factor_sigla <> 'N/A' THEN
      SELECT contribution_pct
      INTO v_pct
      FROM public.apf_impact_factors
      WHERE model_id = v_model_id
        AND sigla = v_factor_sigla
        AND is_active = true
      LIMIT 1;
      v_pct := coalesce(v_pct, 0);
    END IF;

    IF v_pf_bruto = 0 AND v_function_sigla <> 'N/A' THEN
      SELECT weight
      INTO v_pf_bruto
      FROM public.apf_function_types
      WHERE model_id = v_model_id
        AND sigla = v_function_sigla
        AND is_active = true
      LIMIT 1;
      v_pf_bruto := coalesce(v_pf_bruto, 0);
    END IF;

    v_pf_fs := round(v_pf_bruto * v_pct / 100.0, 2);

    INSERT INTO public.apf_baseline_items(
      baseline_id,
      item_ref,
      description,
      module,
      function_sigla,
      factor_sigla,
      category_sigla,
      complexity,
      pf_bruto,
      contribution_pct,
      pf_fs,
      is_measurable,
      notes,
      sort_order,
      source_row,
      source_payload,
      normalized_key
    ) VALUES (
      v_baseline_id,
      coalesce(nullif(v_item->>'item_ref', ''), left(v_item->>'description', 180)),
      v_item->>'description',
      nullif(v_item->>'module', ''),
      v_function_sigla,
      v_factor_sigla,
      nullif(v_item->>'category_sigla', ''),
      coalesce(nullif(v_item->>'complexity', ''), 'Padrão'),
      v_pf_bruto,
      v_pct,
      v_pf_fs,
      coalesce((v_item->>'is_measurable')::boolean, v_function_sigla <> 'N/A'),
      nullif(v_item->>'notes', ''),
      v_inserted,
      nullif(v_item->>'source_row', '')::int,
      coalesce(v_item->'source_payload', '{}'::jsonb),
      public.normalize_apf_text(
        coalesce(v_item->>'item_ref', '') || ' ' || coalesce(v_item->>'description', '')
      )
    );

    v_inserted := v_inserted + 1;
    v_pf_bruto_total := v_pf_bruto_total + v_pf_bruto;
    v_pf_fs_total := v_pf_fs_total + v_pf_fs;
  END LOOP;

  RETURN jsonb_build_object(
    'baseline_id', v_baseline_id,
    'model_id', v_model_id,
    'inserted_items', v_inserted,
    'total_pf_bruto', round(v_pf_bruto_total, 2),
    'total_pf_fs', round(v_pf_fs_total, 2),
    'status', CASE WHEN p_activate THEN 'active' ELSE 'draft' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apf_import_baseline(
  UUID, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, JSONB, BOOLEAN
) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_active_apf_context(p_project_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project RECORD;
  v_model RECORD;
  v_baseline RECORD;
  v_types JSONB;
  v_factors JSONB;
BEGIN
  SELECT id, name, contract_id, team_id
  INTO v_project
  FROM public.projects
  WHERE id = p_project_id;

  IF v_project.id IS NULL OR v_project.contract_id IS NULL THEN
    RAISE EXCEPTION 'Projeto não encontrado ou sem contrato vinculado';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT (
       public.is_team_member(auth.uid(), v_project.team_id)
       OR public.has_role(auth.uid(), 'admin')
     ) THEN
    RAISE EXCEPTION 'Usuário sem acesso ao projeto' USING ERRCODE = '42501';
  END IF;

  SELECT id, name, standard, contract_id
  INTO v_model
  FROM public.apf_counting_models
  WHERE contract_id = v_project.contract_id
    AND is_active = true
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_model.id IS NULL THEN
    RAISE EXCEPTION 'O contrato do projeto não possui modelo APF ativo';
  END IF;

  SELECT id, version, label, status, source_file_name, source_summary, imported_at
  INTO v_baseline
  FROM public.apf_project_baselines
  WHERE project_id = p_project_id
    AND model_id = v_model.id
    AND status = 'active'
  ORDER BY imported_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF v_baseline.id IS NULL THEN
    RAISE EXCEPTION 'O projeto não possui baseline APF ativa';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'sigla', sigla,
    'name', name,
    'func_class', func_class,
    'weight', weight,
    'sort_order', sort_order
  ) ORDER BY sort_order, sigla), '[]'::jsonb)
  INTO v_types
  FROM public.apf_function_types
  WHERE model_id = v_model.id
    AND is_active = true;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'sigla', sigla,
    'name', name,
    'contribution_pct', contribution_pct,
    'action_on_baseline', action_on_baseline,
    'is_inm', is_inm,
    'sort_order', sort_order
  ) ORDER BY sort_order, sigla), '[]'::jsonb)
  INTO v_factors
  FROM public.apf_impact_factors
  WHERE model_id = v_model.id
    AND is_active = true;

  RETURN jsonb_build_object(
    'project', to_jsonb(v_project),
    'model', to_jsonb(v_model),
    'baseline', to_jsonb(v_baseline),
    'function_types', v_types,
    'impact_factors', v_factors,
    'baseline_item_count', (
      SELECT count(*)
      FROM public.apf_baseline_items
      WHERE baseline_id = v_baseline.id
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_apf_context(UUID) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_apf_baseline_candidates(
  p_project_id UUID,
  p_story_text TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE(
  id UUID,
  item_ref TEXT,
  description TEXT,
  module TEXT,
  function_sigla TEXT,
  factor_sigla TEXT,
  category_sigla TEXT,
  complexity TEXT,
  pf_bruto NUMERIC,
  contribution_pct NUMERIC,
  pf_fs NUMERIC,
  is_measurable BOOLEAN,
  notes TEXT,
  match_score NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH active_baseline AS (
    SELECT b.id
    FROM public.apf_project_baselines b
    JOIN public.projects p ON p.id = b.project_id
    WHERE b.project_id = p_project_id
      AND b.status = 'active'
      AND (
        auth.uid() IS NULL
        OR public.is_team_member(auth.uid(), p.team_id)
        OR public.has_role(auth.uid(), 'admin')
      )
    ORDER BY b.imported_at DESC NULLS LAST, b.created_at DESC
    LIMIT 1
  ), normalized_query AS (
    SELECT public.normalize_apf_text(p_story_text) AS value
  )
  SELECT
    bi.id,
    bi.item_ref,
    bi.description,
    bi.module,
    bi.function_sigla,
    bi.factor_sigla,
    bi.category_sigla,
    bi.complexity,
    bi.pf_bruto,
    bi.contribution_pct,
    bi.pf_fs,
    bi.is_measurable,
    bi.notes,
    round((CASE
      WHEN length(public.normalize_apf_text(bi.item_ref)) >= 4
       AND nq.value LIKE '%' || public.normalize_apf_text(bi.item_ref) || '%'
        THEN 1.0
      WHEN nq.value = public.normalize_apf_text(bi.description)
        THEN 1.0
      ELSE greatest(
        similarity(
          nq.value,
          coalesce(bi.normalized_key, public.normalize_apf_text(bi.description))
        ),
        word_similarity(
          coalesce(bi.normalized_key, public.normalize_apf_text(bi.description)),
          nq.value
        )
      )
    END)::numeric, 4) AS match_score
  FROM public.apf_baseline_items bi
  JOIN active_baseline ab ON ab.id = bi.baseline_id
  CROSS JOIN normalized_query nq
  ORDER BY match_score DESC, bi.sort_order, bi.description
  LIMIT greatest(1, least(coalesce(p_limit, 10), 30));
$$;

GRANT EXECUTE ON FUNCTION public.get_apf_baseline_candidates(UUID, TEXT, INT)
  TO authenticated;
