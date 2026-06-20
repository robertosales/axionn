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

-- ------------------------------------------------------------
-- RPC: build_apf_prompt
-- Parâmetros:
--   p_contract_id  UUID  — id do contrato
--   p_hu_text      TEXT  — texto das HUs da sprint (opcional)
--                          se NULL retorna só o system_prompt
-- Retorna: JSONB
-- ------------------------------------------------------------
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
      'sigla',      ft.sigla,
      'name',       ft.name,
      'class',      ft.func_class,
      'weight',     ft.weight
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
  -- 6. Template de saída (seções do documento de evidência)
  -- --------------------------------------------------------
  SELECT ot.sections
  INTO v_template
  FROM public.apf_output_templates ot
  WHERE ot.model_id = v_model.id
  LIMIT 1;

  -- --------------------------------------------------------
  -- 7. Montar o SYSTEM PROMPT
  -- --------------------------------------------------------
  v_system := format(
$PROMPT$
%s

## PRINCÍPIO FUNDAMENTAL
%s

## HIERARQUIA DE DECISÃO
%s

## REGRAS CRÍTICAS
%s

## PROCESSO ELEMENTAR E UNICIDADE
%s

## GRANULARIDADE
%s

## HISTÓRICO DO TIME E PRECEDÊNCIA
%s

## CONSISTÊNCIA CONTRATUAL
%s

## FECHAMENTO DO PROCESSO ELEMENTAR
%s

---
## REFERÊNCIA: TIPOS DE FUNÇÃO DO CONTRATO
Os pesos a seguir são os valores contratuais configurados. NÃO use outros valores.

%s

---
## REFERÊNCIA: FATORES DE IMPACTO
Aplique exatamente a contribuição (%) indicada para cada fator.

%s

---
## REFERÊNCIA: CATEGORIAS FUNCIONAIS
%s

---
## FORMATO DE SAÍDA
Para CADA Elemento Funcional identificado, retorne um objeto JSON com os campos:
{
  "ef_description": "<descrição completa da EF>",
  "hu_ref": "<HU de origem, ex: HU049>",
  "function_sigla": "<TRN|ARQ|...>",
  "factor_sigla": "<I|A|A75|...>",
  "category_sigla": "<ARN|ADS|ATD|AGR|NM>",
  "complexity": "Padrão",
  "pf_bruto": <peso do tipo>,
  "contribution_pct": <% do fator>,
  "pf_fs": <pf_bruto * contribution_pct / 100>,
  "justification": "<justificativa objetiva citando a regra aplicada>",
  "evidence_literal": "<trecho literal do requisito que fundamenta a contagem>",
  "precedent_ref": "<referência ao precedente se aplicável, ou null>"
}

Se houver zonas cinzentas (ambiguidade de interpretação), retorne também:
{
  "gray_zones": [
    {
      "hu_ref": "<HU>",
      "scenario": "<descrição do cenário ambíguo>",
      "interpretation_a": "<opção A>",
      "interpretation_b": "<opção B>",
      "pf_difference": <diferença de PF entre A e B>,
      "decision": "<decisão adotada>",
      "confidence_level": "<alto|médio|baixo>"
    }
  ]
}
$PROMPT$,
    COALESCE(v_rules.rule_mission,                ''),
    COALESCE(v_rules.rule_fundamental_principle,  ''),
    COALESCE(v_rules.rule_decision_hierarchy,     ''),
    COALESCE(v_rules.rule_critical_guidelines,    ''),
    COALESCE(v_rules.rule_elementary_process,     ''),
    COALESCE(v_rules.rule_granularity,            ''),
    COALESCE(v_rules.rule_precedence_override,    ''),
    COALESCE(v_rules.rule_contractual_consistency,''),
    COALESCE(v_rules.rule_closure,                ''),
    -- Tipos de função formatados como tabela Markdown
    (
      SELECT string_agg(
        format('| %s | %s | %s | %.2f PF |',
          ft->>'sigla', ft->>'name', ft->>'class', (ft->>'weight')::NUMERIC),
        E'\n'
      )
      FROM jsonb_array_elements(v_func_types) ft
    ),
    -- Fatores formatados como tabela Markdown
    (
      SELECT string_agg(
        format('| %s | %s | %s%% | %s |%s',
          f->>'sigla',
          f->>'name',
          f->>'contribution_pct',
          f->>'action_on_baseline',
          CASE WHEN (f->>'is_inm')::BOOLEAN THEN ' *INM*' ELSE '' END
        ),
        E'\n'
      )
      FROM jsonb_array_elements(v_factors) f
    ),
    -- Categorias formatadas
    (
      SELECT string_agg(
        format('- **%s**: %s — %s',
          c->>'sigla', c->>'name', COALESCE(c->>'description', '')),
        E'\n'
      )
      FROM jsonb_array_elements(v_categories) c
    )
  );

  -- --------------------------------------------------------
  -- 8. Montar o USER PROMPT TEMPLATE
  -- --------------------------------------------------------
  v_user_tpl := CASE
    WHEN p_hu_text IS NOT NULL THEN
      format(
        E'Realize a contagem APF para as seguintes Histórias de Usuário:\n\n%s\n\nRetorne o resultado em JSON conforme especificado.',
        p_hu_text
      )
    ELSE
      'Realize a contagem APF para as Histórias de Usuário fornecidas. Retorne o resultado em JSON conforme especificado no system prompt.'
  END;

  -- --------------------------------------------------------
  -- 9. Montar resultado final
  -- --------------------------------------------------------
  v_result := jsonb_build_object(
    'model_meta', jsonb_build_object(
      'model_id',       v_model.id,
      'model_name',     v_model.name,
      'standard',       v_model.standard,
      'contract_id',    p_contract_id,
      'function_types', v_func_types,
      'impact_factors', v_factors,
      'categories',     v_categories,
      'output_template_sections', v_template
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

-- Permissão: apenas usuários autenticados
GRANT EXECUTE ON FUNCTION public.build_apf_prompt(UUID, TEXT) TO authenticated;

-- ============================================================
-- TESTE RÁPIDO (comente antes de commitar em prod)
-- SELECT jsonb_pretty(
--   build_apf_prompt('d59ab6dc-421f-41b4-b415-ae0bc072ebd4')
-- );
-- ============================================================
