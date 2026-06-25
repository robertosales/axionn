-- ============================================================
-- MIGRATION: 004 — RPC build_apf_prompt
-- Branch:    feat/multi-tenancy-apf-engine
-- Data:      2026-06-20
-- Descrição: Função RPC que monta o prompt completo da IA APF
--            buscando dinamicamente do banco:
--              • Regras do modelo (apf_counting_rules)
--              • Tipos de função com pesos (apf_function_types)
--              • Fatores de impacto com % (apf_impact_factors)
--              • Categorias funcionais (apf_categories)
--              • Template de saída (apf_output_templates)
--            Recebe contract_id e retorna JSONB com:
--              { system_prompt, user_prompt_template, model_meta }
-- ============================================================

CREATE OR REPLACE FUNCTION public.build_apf_prompt(
  p_contract_id UUID,
  p_hu_text     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_model        RECORD;
  v_rules        RECORD;
  v_func_types   JSONB;
  v_factors      JSONB;
  v_categories   JSONB;
  v_template     JSONB;
  v_func_table   TEXT;
  v_factor_table TEXT;
  v_cat_list     TEXT;
  v_system       TEXT;
  v_user_tpl     TEXT;
  v_result       JSONB;
BEGIN
  -- --------------------------------------------------------
  -- 1. Buscar o modelo ativo do contrato
  -- --------------------------------------------------------
  SELECT m.id, m.name, m.standard
  INTO v_model
  FROM public.apf_counting_models m
  WHERE m.contract_id = p_contract_id
    AND m.is_active = true
  LIMIT 1;

  IF v_model IS NULL THEN
    RAISE EXCEPTION 'Nenhum modelo APF ativo encontrado para o contrato %', p_contract_id;
  END IF;

  -- --------------------------------------------------------
  -- 2. Regras da IA
  -- --------------------------------------------------------
  SELECT *
  INTO v_rules
  FROM public.apf_counting_rules
  WHERE model_id = v_model.id
  LIMIT 1;

  -- --------------------------------------------------------
  -- 3. Tipos de função (apenas ativos, ordenados)
  -- --------------------------------------------------------
  SELECT jsonb_agg(
    jsonb_build_object(
      'sigla',  ft.sigla,
      'name',   ft.name,
      'class',  ft.func_class,
      'weight', ft.weight
    ) ORDER BY ft.sort_order, ft.sigla
  )
  INTO v_func_types
  FROM public.apf_function_types ft
  WHERE ft.model_id = v_model.id
    AND ft.is_active = true;

  -- --------------------------------------------------------
  -- 4. Fatores de impacto (ativos, ordenados)
  -- --------------------------------------------------------
  SELECT jsonb_agg(
    jsonb_build_object(
      'sigla',              f.sigla,
      'name',               f.name,
      'contribution_pct',   f.contribution_pct,
      'action_on_baseline', f.action_on_baseline,
      'is_inm',             f.is_inm,
      'notes',              f.notes
    ) ORDER BY f.sort_order, f.sigla
  )
  INTO v_factors
  FROM public.apf_impact_factors f
  WHERE f.model_id = v_model.id
    AND f.is_active = true;

  -- --------------------------------------------------------
  -- 5. Categorias funcionais (ativas)
  -- --------------------------------------------------------
  SELECT jsonb_agg(
    jsonb_build_object(
      'sigla',       c.sigla,
      'name',        c.name,
      'description', c.description
    ) ORDER BY c.sigla
  )
  INTO v_categories
  FROM public.apf_categories c
  WHERE c.model_id = v_model.id
    AND c.is_active = true;

  -- --------------------------------------------------------
  -- 6. Template de saída
  -- --------------------------------------------------------
  SELECT ot.sections
  INTO v_template
  FROM public.apf_output_templates ot
  WHERE ot.model_id = v_model.id
  LIMIT 1;

  -- --------------------------------------------------------
  -- 7. Formatar tabelas Markdown (sem format() com %.2f)
  -- --------------------------------------------------------

  -- Tipos de função
  SELECT string_agg(
    '| ' || (ft->>'sigla') ||
    ' | ' || (ft->>'name') ||
    ' | ' || (ft->>'class') ||
    ' | ' || ROUND((ft->>'weight')::NUMERIC, 2)::TEXT || ' PF |',
    E'\n'
  )
  INTO v_func_table
  FROM jsonb_array_elements(v_func_types) ft;

  -- Fatores de impacto
  SELECT string_agg(
    '| ' || (f->>'sigla') ||
    ' | ' || (f->>'name') ||
    ' | ' || (f->>'contribution_pct') || '%' ||
    ' | ' || (f->>'action_on_baseline') ||
    CASE WHEN (f->>'is_inm')::BOOLEAN THEN ' | *INM* |' ELSE ' | |' END,
    E'\n'
  )
  INTO v_factor_table
  FROM jsonb_array_elements(v_factors) f;

  -- Categorias
  SELECT string_agg(
    '- **' || (c->>'sigla') || '**: ' || (c->>'name') ||
    CASE WHEN (c->>'description') IS NOT NULL
         THEN ' — ' || (c->>'description')
         ELSE ''
    END,
    E'\n'
  )
  INTO v_cat_list
  FROM jsonb_array_elements(v_categories) c;

  -- --------------------------------------------------------
  -- 8. Montar o SYSTEM PROMPT via concatenação
  -- --------------------------------------------------------
  v_system :=
    COALESCE(v_rules.rule_mission, '') || E'\n\n' ||
    '## PRINCÍPIO FUNDAMENTAL' || E'\n' ||
    COALESCE(v_rules.rule_fundamental_principle, '') || E'\n\n' ||
    '## HIERARQUIA DE DECISÃO' || E'\n' ||
    COALESCE(v_rules.rule_decision_hierarchy, '') || E'\n\n' ||
    '## REGRAS CRÍTICAS' || E'\n' ||
    COALESCE(v_rules.rule_critical_guidelines, '') || E'\n\n' ||
    '## PROCESSO ELEMENTAR E UNICIDADE' || E'\n' ||
    COALESCE(v_rules.rule_elementary_process, '') || E'\n\n' ||
    '## GRANULARIDADE' || E'\n' ||
    COALESCE(v_rules.rule_granularity, '') || E'\n\n' ||
    '## HISTÓRICO DO TIME E PRECEDÊNCIA' || E'\n' ||
    COALESCE(v_rules.rule_precedence_override, '') || E'\n\n' ||
    '## CONSISTÊNCIA CONTRATUAL' || E'\n' ||
    COALESCE(v_rules.rule_contractual_consistency, '') || E'\n\n' ||
    '## FECHAMENTO DO PROCESSO ELEMENTAR' || E'\n' ||
    COALESCE(v_rules.rule_closure, '') || E'\n\n' ||
    '---' || E'\n' ||
    '## REFERÊNCIA: TIPOS DE FUNÇÃO DO CONTRATO' || E'\n' ||
    '| Sigla | Nome | Classe | Peso |' || E'\n' ||
    '|-------|------|--------|------|' || E'\n' ||
    COALESCE(v_func_table, '') || E'\n\n' ||
    '---' || E'\n' ||
    '## REFERÊNCIA: FATORES DE IMPACTO' || E'\n' ||
    '| Sigla | Nome | Contribuição | Ação Baseline | INM |' || E'\n' ||
    '|-------|------|--------------|--------------|-----|' || E'\n' ||
    COALESCE(v_factor_table, '') || E'\n\n' ||
    '---' || E'\n' ||
    '## REFERÊNCIA: CATEGORIAS FUNCIONAIS' || E'\n' ||
    COALESCE(v_cat_list, '') || E'\n\n' ||
    '---' || E'\n' ||
    '## FORMATO DE SAÍDA' || E'\n' ||
    'Para CADA Elemento Funcional identificado, retorne um objeto JSON com os campos:' || E'\n' ||
    E'{\n' ||
    E'  "ef_description": "<descrição completa da EF>",\n' ||
    E'  "hu_ref": "<HU de origem, ex: HU049>",\n' ||
    E'  "function_sigla": "<TRN|ARQ|...>",\n' ||
    E'  "factor_sigla": "<I|A|A75|...>",\n' ||
    E'  "category_sigla": "<ARN|ADS|ATD|AGR|NM>",\n' ||
    E'  "complexity": "Padrão",\n' ||
    E'  "pf_bruto": <peso do tipo>,\n' ||
    E'  "contribution_pct": <pct do fator>,\n' ||
    E'  "pf_fs": <pf_bruto * contribution_pct / 100>,\n' ||
    E'  "justification": "<justificativa citando a regra aplicada>",\n' ||
    E'  "evidence_literal": "<trecho literal do requisito>",\n' ||
    E'  "precedent_ref": "<referência ao precedente ou null>"\n' ||
    E'}\n\n' ||
    'Se houver zonas cinzentas, retorne também o campo "gray_zones" com o array de ambiguidades.';

  -- --------------------------------------------------------
  -- 9. User prompt template
  -- --------------------------------------------------------
  v_user_tpl := CASE
    WHEN p_hu_text IS NOT NULL THEN
      'Realize a contagem APF para as seguintes Histórias de Usuário:' ||
      E'\n\n' || p_hu_text ||
      E'\n\nRetorne o resultado em JSON conforme especificado.'
    ELSE
      'Realize a contagem APF para as Histórias de Usuário fornecidas. Retorne o resultado em JSON conforme especificado no system prompt.'
  END;

  -- --------------------------------------------------------
  -- 10. Resultado final
  -- --------------------------------------------------------
  v_result := jsonb_build_object(
    'model_meta', jsonb_build_object(
      'model_id',                  v_model.id,
      'model_name',                v_model.name,
      'standard',                  v_model.standard,
      'contract_id',               p_contract_id,
      'function_types',            v_func_types,
      'impact_factors',            v_factors,
      'categories',                v_categories,
      'output_template_sections',  v_template
    ),
    'system_prompt',        v_system,
    'user_prompt_template', v_user_tpl
  );

  RETURN v_result;

END;
$$;

COMMENT ON FUNCTION public.build_apf_prompt(UUID, TEXT) IS
  'Monta o prompt dinâmico da IA APF a partir dos dados do modelo vinculado ao contrato.
   Retorna JSONB com: system_prompt, user_prompt_template, model_meta.
   Uso: SELECT build_apf_prompt(''<contract_id>'', ''<texto das HUs>'');';

GRANT EXECUTE ON FUNCTION public.build_apf_prompt(UUID, TEXT) TO authenticated;
