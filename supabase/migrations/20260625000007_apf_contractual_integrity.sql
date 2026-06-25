-- ============================================================
-- APF contratual: integridade da baseline, modelo isolado e
-- correspondência exata obrigatória para referências explícitas.
-- ============================================================

ALTER TABLE public.apf_project_baselines
  ADD COLUMN IF NOT EXISTS source_checksum TEXT,
  ADD COLUMN IF NOT EXISTS validation_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS validation_report JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.normalize_apf_ref(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(regexp_replace(coalesce(p_text, ''), '[^a-zA-Z0-9]+', '', 'g'));
$$;

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
  v_pf_bruto NUMERIC(10,2);
  v_pct NUMERIC(8,2);
  v_pf_fs NUMERIC(10,2);
  v_sheet_pf_fs NUMERIC(10,2);
  v_inserted INT := 0;
  v_measurable INT := 0;
  v_non_measurable INT := 0;
  v_pf_bruto_total NUMERIC(14,2) := 0;
  v_pf_fs_total NUMERIC(14,2) := 0;
  v_expected_items INT;
  v_expected_measurable INT;
  v_expected_non_measurable INT;
  v_expected_pf_bruto NUMERIC(14,2);
  v_expected_pf_fs NUMERIC(14,2);
  v_validation_report JSONB;
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

  -- Nunca converte um modelo IFPUG genérico em modelo contratual.
  SELECT id
  INTO v_model_id
  FROM public.apf_counting_models
  WHERE contract_id = v_contract_id
    AND standard = 'pfs_dpf'
  ORDER BY is_active DESC, updated_at DESC
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
      'Modelo isolado e configurado a partir da planilha oficial de métricas do sistema.',
      'pfs_dpf',
      true
    )
    RETURNING id INTO v_model_id;
  ELSE
    UPDATE public.apf_counting_models
    SET is_active = true,
        updated_at = now()
    WHERE id = v_model_id;
  END IF;

  -- O catálogo do modelo contratual deve refletir apenas a baseline importada.
  UPDATE public.apf_function_types
  SET is_active = false
  WHERE model_id = v_model_id;

  IF jsonb_array_length(coalesce(p_function_types, '[]'::jsonb)) > 0 THEN
    FOR v_type IN
      SELECT * FROM jsonb_array_elements(coalesce(p_function_types, '[]'::jsonb))
    LOOP
      IF nullif(trim(v_type->>'sigla'), '') IS NULL
         OR coalesce((v_type->>'weight')::numeric, 0) <= 0 THEN
        RAISE EXCEPTION 'Tipo funcional inválido na baseline: %', v_type;
      END IF;

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
        (v_type->>'weight')::numeric,
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
      name = excluded.name,
      func_class = excluded.func_class,
      weight = excluded.weight,
      is_active = true,
      sort_order = excluded.sort_order;
  END IF;

  UPDATE public.apf_impact_factors
  SET is_active = false
  WHERE model_id = v_model_id;

  -- Política contratual padrão; a planilha pode sobrescrever percentuais.
  INSERT INTO public.apf_impact_factors(
    model_id, sigla, name, contribution_pct, action_on_baseline,
    origin, is_inm, is_active, sort_order
  ) VALUES
    (v_model_id, 'I', 'Inclusão', 100, 'Incluir', 'Regra contratual', false, true, 1),
    (v_model_id, 'A', 'Alteração', 60, 'Alterar', 'Regra contratual', false, true, 2),
    (v_model_id, 'A75', 'Alteração 75%', 75, 'Alterar', 'Regra contratual', false, true, 3),
    (v_model_id, 'A90', 'Regulatório / Institucional', 90, 'Alterar', 'Regra contratual', false, true, 4),
    (v_model_id, 'E', 'Exclusão', 40, 'Remover', 'Regra contratual', false, true, 5),
    (v_model_id, 'N/A', 'Não se Aplica', 0, 'Não Impacta', 'Regra contratual', true, true, 999)
  ON CONFLICT (model_id, sigla) DO UPDATE SET
    name = excluded.name,
    contribution_pct = excluded.contribution_pct,
    action_on_baseline = excluded.action_on_baseline,
    origin = excluded.origin,
    is_inm = excluded.is_inm,
    is_active = true,
    sort_order = excluded.sort_order;

  FOR v_factor IN
    SELECT * FROM jsonb_array_elements(coalesce(p_impact_factors, '[]'::jsonb))
  LOOP
    v_pct := coalesce((v_factor->>'contribution_pct')::numeric, 0);
    IF v_pct > 0 AND v_pct <= 1 THEN
      v_pct := v_pct * 100;
    END IF;

    IF nullif(trim(v_factor->>'sigla'), '') IS NULL
       OR v_pct < 0
       OR v_pct > 100 THEN
      RAISE EXCEPTION 'Fator de impacto inválido na baseline: %', v_factor;
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
      coalesce(nullif(v_factor->>'origin', ''), 'Planilha oficial'),
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

  -- Valida todo o conteúdo antes de ativar ou arquivar qualquer baseline.
  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_function_sigla := upper(coalesce(nullif(v_item->>'function_sigla', ''), 'N/A'));
    v_factor_sigla := upper(coalesce(nullif(v_item->>'factor_sigla', ''), 'N/A'));

    IF v_function_sigla <> 'N/A' AND NOT EXISTS (
      SELECT 1
      FROM public.apf_function_types
      WHERE model_id = v_model_id
        AND sigla = v_function_sigla
        AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Tipo % não pertence ao modelo contratual da baseline', v_function_sigla;
    END IF;

    IF v_factor_sigla <> 'N/A' AND NOT EXISTS (
      SELECT 1
      FROM public.apf_impact_factors
      WHERE model_id = v_model_id
        AND sigla = v_factor_sigla
        AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Fator % não pertence ao modelo contratual da baseline', v_factor_sigla;
    END IF;

    v_pf_bruto := coalesce((v_item->>'pf_bruto')::numeric, 0);
    v_pct := coalesce((v_item->>'contribution_pct')::numeric, 0);
    v_sheet_pf_fs := nullif(v_item->>'pf_fs', '')::numeric;

    IF v_pct > 0 AND v_pct <= 1 THEN
      v_pct := v_pct * 100;
    END IF;

    IF v_function_sigla = 'N/A' OR v_factor_sigla = 'N/A' THEN
      v_pf_bruto := 0;
      v_pct := 0;
      v_pf_fs := 0;
      v_non_measurable := v_non_measurable + 1;
    ELSE
      IF v_pf_bruto = 0 THEN
        SELECT weight
        INTO v_pf_bruto
        FROM public.apf_function_types
        WHERE model_id = v_model_id
          AND sigla = v_function_sigla
          AND is_active = true;
      END IF;

      IF v_pct = 0 THEN
        SELECT contribution_pct
        INTO v_pct
        FROM public.apf_impact_factors
        WHERE model_id = v_model_id
          AND sigla = v_factor_sigla
          AND is_active = true;
      END IF;

      v_pf_fs := round(v_pf_bruto * v_pct / 100.0, 2);
      v_measurable := v_measurable + 1;

      IF v_sheet_pf_fs IS NOT NULL AND abs(v_sheet_pf_fs - v_pf_fs) > 0.02 THEN
        RAISE EXCEPTION
          'PF Simples divergente no item %: planilha %, calculado %',
          coalesce(v_item->>'item_ref', v_item->>'description'),
          v_sheet_pf_fs,
          v_pf_fs;
      END IF;
    END IF;

    v_inserted := v_inserted + 1;
    v_pf_bruto_total := v_pf_bruto_total + v_pf_bruto;
    v_pf_fs_total := v_pf_fs_total + v_pf_fs;
  END LOOP;

  v_expected_items := nullif(p_source_summary->>'item_count', '')::int;
  v_expected_measurable := nullif(p_source_summary->>'measurable_count', '')::int;
  v_expected_non_measurable := nullif(p_source_summary->>'non_measurable_count', '')::int;
  v_expected_pf_bruto := nullif(p_source_summary->>'expected_pf_bruto', '')::numeric;
  v_expected_pf_fs := nullif(p_source_summary->>'expected_pf_fs', '')::numeric;

  IF v_expected_items IS NOT NULL AND v_expected_items <> v_inserted THEN
    RAISE EXCEPTION 'Quantidade de itens divergente: esperado %, importado %', v_expected_items, v_inserted;
  END IF;
  IF v_expected_measurable IS NOT NULL AND v_expected_measurable <> v_measurable THEN
    RAISE EXCEPTION 'Quantidade de itens mensuráveis divergente: esperado %, importado %', v_expected_measurable, v_measurable;
  END IF;
  IF v_expected_non_measurable IS NOT NULL AND v_expected_non_measurable <> v_non_measurable THEN
    RAISE EXCEPTION 'Quantidade de itens não mensuráveis divergente: esperado %, importado %', v_expected_non_measurable, v_non_measurable;
  END IF;
  IF v_expected_pf_bruto IS NOT NULL AND abs(v_expected_pf_bruto - v_pf_bruto_total) > 0.02 THEN
    RAISE EXCEPTION 'PF Bruto total divergente: esperado %, calculado %', v_expected_pf_bruto, v_pf_bruto_total;
  END IF;
  IF v_expected_pf_fs IS NOT NULL AND abs(v_expected_pf_fs - v_pf_fs_total) > 0.02 THEN
    RAISE EXCEPTION 'PF Simples total divergente: esperado %, calculado %', v_expected_pf_fs, v_pf_fs_total;
  END IF;

  v_validation_report := jsonb_build_object(
    'item_count', v_inserted,
    'measurable_count', v_measurable,
    'non_measurable_count', v_non_measurable,
    'total_pf_bruto', round(v_pf_bruto_total, 2),
    'total_pf_simples', round(v_pf_fs_total, 2),
    'validated_at', now()
  );

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
    'Reproduzir a medição oficial do contrato usando baseline homologada, evidências e precedentes validados.',
    'A HU é gatilho de impacto. A unidade de contagem é a função da baseline, respeitando a unicidade do processo elementar.',
    '1. Medição oficial. 2. Baseline homologada. 3. Contagens anteriores. 4. Precedentes. 5. Regras contratuais. 6. Evidências da sprint.',
    'Não maximizar PF. Não criar processos para histórico, preview, validações, mensagens, carregamentos ou etapas internas sem precedente.',
    'Identificar primeiro o processo central. Um processo separado deve ter objetivo próprio, ser completo, independente e possuir precedente.',
    'Em dúvida entre fragmentar e consolidar, consolidar e registrar a zona cinzenta.',
    'A classificação homologada pela equipe prevalece sobre teoria genérica.',
    'Tipos e fatores devem pertencer ao modelo contratual. Pesos e percentuais nunca são definidos pela IA.',
    'Referência explícita ausente na baseline bloqueia a contagem; não deve ser substituída silenciosamente por similaridade.'
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
    source_checksum,
    source_summary,
    validation_status,
    validation_report
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
    nullif(p_source_summary->>'source_checksum', ''),
    coalesce(p_source_summary, '{}'::jsonb) || v_validation_report,
    'validated',
    v_validation_report
  )
  RETURNING id INTO v_baseline_id;

  v_inserted := 0;
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

    IF v_function_sigla = 'N/A' OR v_factor_sigla = 'N/A' THEN
      v_function_sigla := 'N/A';
      v_factor_sigla := 'N/A';
      v_pf_bruto := 0;
      v_pct := 0;
      v_pf_fs := 0;
    ELSE
      IF v_pf_bruto = 0 THEN
        SELECT weight INTO v_pf_bruto
        FROM public.apf_function_types
        WHERE model_id = v_model_id
          AND sigla = v_function_sigla
          AND is_active = true;
      END IF;
      IF v_pct = 0 THEN
        SELECT contribution_pct INTO v_pct
        FROM public.apf_impact_factors
        WHERE model_id = v_model_id
          AND sigla = v_factor_sigla
          AND is_active = true;
      END IF;
      v_pf_fs := round(v_pf_bruto * v_pct / 100.0, 2);
    END IF;

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
      v_function_sigla <> 'N/A' AND v_factor_sigla <> 'N/A',
      nullif(v_item->>'notes', ''),
      v_inserted,
      nullif(v_item->>'source_row', '')::int,
      coalesce(v_item->'source_payload', '{}'::jsonb),
      public.normalize_apf_text(
        coalesce(v_item->>'item_ref', '') || ' ' || coalesce(v_item->>'description', '')
      )
    );

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'baseline_id', v_baseline_id,
    'model_id', v_model_id,
    'inserted_items', v_inserted,
    'measurable_items', v_measurable,
    'non_measurable_items', v_non_measurable,
    'total_pf_bruto', round(v_pf_bruto_total, 2),
    'total_pf_fs', round(v_pf_fs_total, 2),
    'validation_status', 'validated',
    'status', CASE WHEN p_activate THEN 'active' ELSE 'draft' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apf_import_baseline(
  UUID, TEXT, TEXT, TEXT, JSONB, JSONB, JSONB, JSONB, BOOLEAN
) TO authenticated;

-- O contexto deve ser obtido do modelo vinculado à baseline ativa,
-- e não de qualquer modelo ativo do contrato.
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

  SELECT id, model_id, version, label, status, source_file_name,
         source_summary, source_checksum, validation_status,
         validation_report, imported_at
  INTO v_baseline
  FROM public.apf_project_baselines
  WHERE project_id = p_project_id
    AND status = 'active'
  ORDER BY imported_at DESC NULLS LAST, created_at DESC
  LIMIT 1;

  IF v_baseline.id IS NULL THEN
    RAISE EXCEPTION 'O projeto não possui baseline APF ativa';
  END IF;

  SELECT id, name, standard, contract_id
  INTO v_model
  FROM public.apf_counting_models
  WHERE id = v_baseline.model_id;

  IF v_model.id IS NULL OR v_model.standard <> 'pfs_dpf' THEN
    RAISE EXCEPTION 'A baseline ativa não está vinculada a um modelo contratual PFS/DPF';
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

CREATE OR REPLACE FUNCTION public.get_apf_baseline_exact_items(
  p_project_id UUID,
  p_item_refs TEXT[]
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
  ), refs AS (
    SELECT public.normalize_apf_ref(value) AS value
    FROM unnest(coalesce(p_item_refs, '{}'::text[])) AS value
    WHERE nullif(public.normalize_apf_ref(value), '') IS NOT NULL
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
    1.0::numeric AS match_score
  FROM public.apf_baseline_items bi
  JOIN active_baseline ab ON ab.id = bi.baseline_id
  WHERE EXISTS (
    SELECT 1
    FROM refs
    WHERE refs.value = public.normalize_apf_ref(bi.item_ref)
  )
  ORDER BY bi.sort_order, bi.description;
$$;

GRANT EXECUTE ON FUNCTION public.get_apf_baseline_exact_items(UUID, TEXT[])
  TO authenticated;
