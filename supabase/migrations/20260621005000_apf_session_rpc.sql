-- ============================================================
-- MIGRATION: 005 — RPCs de Sessão de Contagem APF
-- Branch:    feat/multi-tenancy-apf-engine
-- Data:      2026-06-20
-- Descrição:
--   RPC 1: open_counting_session
--     Abre uma apf_counting_session para um projeto/sprint.
--     Resolve automaticamente o model_id a partir do contrato
--     do projeto. Retorna o session_id pronto para uso.
--
--   RPC 2: save_counting_items
--     Recebe o array JSON retornado pela IA, insere cada EF
--     em apf_counting_items calculando pf_fs, insere
--     gray_zones se presentes, e atualiza os totais da sessão.
-- ============================================================

-- ============================================================
-- RPC 1: open_counting_session
-- ============================================================
CREATE OR REPLACE FUNCTION public.open_counting_session(
  p_project_id   UUID,
  p_sprint_ref   TEXT DEFAULT NULL,
  p_release_ref  TEXT DEFAULT NULL,
  p_redmine_ref  TEXT DEFAULT NULL,
  p_baseline_id  UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_contract_id  UUID;
  v_model_id     UUID;
  v_session_id   UUID;
BEGIN
  -- 1. Resolver contract_id a partir do projeto
  SELECT p.contract_id
  INTO v_contract_id
  FROM public.projects p
  WHERE p.id = p_project_id;

  IF v_contract_id IS NULL THEN
    RAISE EXCEPTION 'Projeto % não encontrado ou sem contrato vinculado', p_project_id;
  END IF;

  -- 2. Resolver model_id ativo do contrato
  SELECT m.id
  INTO v_model_id
  FROM public.apf_counting_models m
  WHERE m.contract_id = v_contract_id
    AND m.is_active = true
  LIMIT 1;

  IF v_model_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum modelo APF ativo encontrado para o contrato % do projeto %',
      v_contract_id, p_project_id;
  END IF;

  -- 3. Criar a sessão
  INSERT INTO public.apf_counting_sessions (
    project_id,
    model_id,
    baseline_id,
    sprint_ref,
    release_ref,
    redmine_ref,
    analyst_id,
    status
  ) VALUES (
    p_project_id,
    v_model_id,
    p_baseline_id,
    p_sprint_ref,
    p_release_ref,
    p_redmine_ref,
    auth.uid(),
    'in_progress'
  )
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;

COMMENT ON FUNCTION public.open_counting_session(UUID, TEXT, TEXT, TEXT, UUID) IS
  'Abre uma sessão de contagem APF para o projeto/sprint informado.
   Resolve automaticamente o model_id a partir do contrato do projeto.
   Retorna o session_id (UUID) pronto para receber os itens via save_counting_items.';

GRANT EXECUTE ON FUNCTION public.open_counting_session(UUID, TEXT, TEXT, TEXT, UUID) TO authenticated;


-- ============================================================
-- RPC 2: save_counting_items
-- ============================================================
-- Estrutura esperada de p_items (array JSON da IA):
-- [
--   {
--     "ef_description":    "...",
--     "hu_ref":            "HU049",
--     "function_sigla":    "TRN",
--     "factor_sigla":      "I",
--     "category_sigla":    "ARN",
--     "complexity":        "Padrão",
--     "pf_bruto":          4.60,
--     "contribution_pct": 100.00,
--     "pf_fs":             4.60,         -- recalculado internamente
--     "justification":     "...",
--     "evidence_literal":  "...",
--     "precedent_ref":     null
--   },
--   ...
-- ]
-- Campo opcional no mesmo objeto raíz:
-- "gray_zones": [ { "hu_ref", "scenario", "interpretation_a",
--                   "interpretation_b", "pf_difference",
--                   "decision", "confidence_level" } ]
-- ============================================================
CREATE OR REPLACE FUNCTION public.save_counting_items(
  p_session_id  UUID,
  p_items       JSONB,
  p_ai_model    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item           JSONB;
  v_gray           JSONB;
  v_gz             JSONB;
  v_item_id        UUID;
  v_pf_bruto       NUMERIC(8,2);
  v_contrib        NUMERIC(6,2);
  v_pf_fs          NUMERIC(8,2);
  v_total_pf_bruto NUMERIC(10,2) := 0;
  v_total_pf_fs    NUMERIC(10,2) := 0;
  v_total_funcs    INT := 0;
  v_hu_set         TEXT[] := '{}';
  v_sort           INT := 0;
  v_inserted_items INT := 0;
  v_inserted_gz    INT := 0;
BEGIN
  -- Verificar que a sessão existe e está em progresso
  IF NOT EXISTS (
    SELECT 1 FROM public.apf_counting_sessions
    WHERE id = p_session_id AND status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'Sessão % não encontrada ou não está em progresso', p_session_id;
  END IF;

  -- Limpar itens anteriores da sessão (idempotente: permite re-salvar)
  DELETE FROM public.apf_counting_items  WHERE session_id = p_session_id;
  DELETE FROM public.apf_gray_zones      WHERE session_id = p_session_id;

  -- Iterar sobre cada EF do array
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Recalcular pf_fs internamente (não confiar no valor da IA)
    v_pf_bruto := COALESCE((v_item->>'pf_bruto')::NUMERIC, 0);
    v_contrib  := COALESCE((v_item->>'contribution_pct')::NUMERIC, 0);
    v_pf_fs    := ROUND(v_pf_bruto * v_contrib / 100.0, 2);

    INSERT INTO public.apf_counting_items (
      session_id,
      hu_ref,
      ef_description,
      function_sigla,
      factor_sigla,
      category_sigla,
      complexity,
      pf_bruto,
      contribution_pct,
      pf_fs,
      justification,
      evidence_literal,
      precedent_ref,
      sort_order
    ) VALUES (
      p_session_id,
      v_item->>'hu_ref',
      v_item->>'ef_description',
      v_item->>'function_sigla',
      v_item->>'factor_sigla',
      v_item->>'category_sigla',
      COALESCE(v_item->>'complexity', 'Padrão'),
      v_pf_bruto,
      v_contrib,
      v_pf_fs,
      v_item->>'justification',
      v_item->>'evidence_literal',
      v_item->>'precedent_ref',
      v_sort
    )
    RETURNING id INTO v_item_id;

    -- Acumular totais (apenas EFs mensuráveis)
    IF v_contrib > 0 THEN
      v_total_pf_bruto := v_total_pf_bruto + v_pf_bruto;
      v_total_pf_fs    := v_total_pf_fs    + v_pf_fs;
      v_total_funcs    := v_total_funcs    + 1;
    END IF;

    -- Acumular HUs únicas
    IF (v_item->>'hu_ref') IS NOT NULL
       AND NOT (v_item->>'hu_ref' = ANY(v_hu_set)) THEN
      v_hu_set := array_append(v_hu_set, v_item->>'hu_ref');
    END IF;

    -- Gravar gray_zones embutidas no item (campo opcional)
    v_gray := v_item->'gray_zones';
    IF v_gray IS NOT NULL AND jsonb_array_length(v_gray) > 0 THEN
      FOR v_gz IN SELECT * FROM jsonb_array_elements(v_gray)
      LOOP
        INSERT INTO public.apf_gray_zones (
          session_id,
          counting_item_id,
          hu_ref,
          scenario,
          interpretation_a,
          interpretation_b,
          pf_difference,
          decision,
          confidence_level
        ) VALUES (
          p_session_id,
          v_item_id,
          COALESCE(v_gz->>'hu_ref', v_item->>'hu_ref'),
          v_gz->>'scenario',
          v_gz->>'interpretation_a',
          v_gz->>'interpretation_b',
          (v_gz->>'pf_difference')::NUMERIC,
          v_gz->>'decision',
          v_gz->>'confidence_level'
        );
        v_inserted_gz := v_inserted_gz + 1;
      END LOOP;
    END IF;

    v_sort           := v_sort + 1;
    v_inserted_items := v_inserted_items + 1;
  END LOOP;

  -- Gravar gray_zones no nível raíz do payload (campo global opcional)
  v_gray := p_items->0->'gray_zones';
  -- (já tratado por item acima; bloco global seria para estrutura alternativa)

  -- Atualizar totais da sessão
  UPDATE public.apf_counting_sessions SET
    total_pf_bruto  = ROUND(v_total_pf_bruto, 2),
    total_pf_fs     = ROUND(v_total_pf_fs,    2),
    total_functions = v_total_funcs,
    total_hus       = array_length(v_hu_set, 1),
    ai_model_used   = p_ai_model,
    updated_at      = now()
  WHERE id = p_session_id;

  -- Retornar resumo
  RETURN jsonb_build_object(
    'session_id',       p_session_id,
    'inserted_items',   v_inserted_items,
    'inserted_gz',      v_inserted_gz,
    'total_pf_bruto',   ROUND(v_total_pf_bruto, 2),
    'total_pf_fs',      ROUND(v_total_pf_fs,    2),
    'total_functions',  v_total_funcs,
    'total_hus',        array_length(v_hu_set, 1)
  );
END;
$$;

COMMENT ON FUNCTION public.save_counting_items(UUID, JSONB, TEXT) IS
  'Recebe o array JSON retornado pela IA, insere em apf_counting_items
   recalculando pf_fs internamente, grava gray_zones e atualiza os totais
   da sessão. Idempotente: re-salvar limpa e reinseree os itens.
   Retorna JSONB com resumo: inserted_items, totais pf_bruto/pf_fs, hus.';

GRANT EXECUTE ON FUNCTION public.save_counting_items(UUID, JSONB, TEXT) TO authenticated;
