-- ============================================================
-- APF contratual — motor de processo elementar.
--
-- Princípio implementado:
--   * a HU é gatilho de impacto;
--   * a EF da baseline é a unidade funcional avaliada;
--   * transações só geram PF quando representam processo elementar
--     único, completo e independente;
--   * histórico, preview, validações, consultas e ações auxiliares
--     não são separados sem baseline ou precedente oficial.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apf_elementary_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.apf_counting_sessions(id) ON DELETE CASCADE,
  process_key TEXT NOT NULL,
  process_name TEXT NOT NULL,
  objective TEXT,
  process_role TEXT NOT NULL DEFAULT 'central',
  is_complete BOOLEAN NOT NULL DEFAULT true,
  is_independent BOOLEAN NOT NULL DEFAULT true,
  precedent_ref TEXT,
  confidence NUMERIC(5,4),
  decision TEXT NOT NULL DEFAULT 'counted',
  decision_reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_apf_elementary_process_session_key UNIQUE(session_id, process_key),
  CONSTRAINT ck_apf_elementary_process_role
    CHECK (process_role IN ('central', 'independent', 'auxiliary')),
  CONSTRAINT ck_apf_elementary_process_decision
    CHECK (decision IN ('counted', 'absorbed', 'review_required', 'not_countable'))
);

ALTER TABLE public.apf_counting_items
  ADD COLUMN IF NOT EXISTS elementary_process_id UUID
    REFERENCES public.apf_elementary_processes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS elementary_process_key TEXT,
  ADD COLUMN IF NOT EXISTS elementary_process_name TEXT,
  ADD COLUMN IF NOT EXISTS process_role TEXT NOT NULL DEFAULT 'central',
  ADD COLUMN IF NOT EXISTS process_is_complete BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS process_is_independent BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS counting_decision TEXT NOT NULL DEFAULT 'counted',
  ADD COLUMN IF NOT EXISTS process_reasoning TEXT,
  ADD COLUMN IF NOT EXISTS separation_precedent_ref TEXT,
  ADD COLUMN IF NOT EXISTS absorbed_by_item_id UUID
    REFERENCES public.apf_counting_items(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_apf_counting_item_process_role'
  ) THEN
    ALTER TABLE public.apf_counting_items
      ADD CONSTRAINT ck_apf_counting_item_process_role
      CHECK (process_role IN ('central', 'independent', 'auxiliary'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_apf_counting_item_decision'
  ) THEN
    ALTER TABLE public.apf_counting_items
      ADD CONSTRAINT ck_apf_counting_item_decision
      CHECK (counting_decision IN ('counted', 'absorbed', 'review_required', 'not_countable'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_apf_elementary_process_session
  ON public.apf_elementary_processes(session_id, decision, process_key);
CREATE INDEX IF NOT EXISTS idx_apf_counting_items_process
  ON public.apf_counting_items(session_id, elementary_process_key, counting_decision);
CREATE INDEX IF NOT EXISTS idx_apf_counting_items_absorbed_by
  ON public.apf_counting_items(absorbed_by_item_id);

ALTER TABLE public.apf_elementary_processes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS apf_elementary_processes_select ON public.apf_elementary_processes;
CREATE POLICY apf_elementary_processes_select
ON public.apf_elementary_processes
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.apf_counting_sessions session
    JOIN public.projects project ON project.id = session.project_id
    WHERE session.id = apf_elementary_processes.session_id
      AND (
        public.is_team_member(auth.uid(), project.team_id)
        OR public.has_role(auth.uid(), 'admin')
      )
  )
);

CREATE OR REPLACE FUNCTION public.normalize_apf_process_key(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(replace(public.normalize_apf_text(p_text), ' ', '-'), '');
$$;

CREATE OR REPLACE FUNCTION public.is_apf_auxiliary_action(p_text TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.normalize_apf_text(p_text) ~
    '(^| )(historico|preview|previa|validacao|validar|mensagem|carregamento|loading|log|auditoria|consultar|consulta|visualizar|exibir|listar)( |$)';
$$;

UPDATE public.apf_counting_items
SET elementary_process_key = coalesce(
      elementary_process_key,
      public.normalize_apf_process_key(
        coalesce(hu_ref, '') || ' ' || coalesce(ef_description, normalized_key, '')
      )
    ),
    elementary_process_name = coalesce(elementary_process_name, ef_description),
    process_role = CASE
      WHEN function_sigla = 'N/A' THEN 'auxiliary'
      ELSE process_role
    END,
    counting_decision = CASE
      WHEN function_sigla = 'N/A' THEN 'not_countable'
      ELSE counting_decision
    END
WHERE elementary_process_key IS NULL
   OR elementary_process_name IS NULL;

-- A função é recriada para que a regra de processo elementar seja aplicada
-- na mesma transação que calcula e persiste PF Bruto e PF Simples.
CREATE OR REPLACE FUNCTION public.save_contractual_counting_items(
  p_session_id UUID,
  p_story_id UUID,
  p_items JSONB,
  p_ai_model TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session RECORD;
  v_story RECORD;
  v_item JSONB;
  v_baseline_item RECORD;
  v_existing RECORD;
  v_absorbing RECORD;
  v_process_id UUID;
  v_item_id UUID;
  v_function_sigla TEXT;
  v_function_class TEXT;
  v_factor_sigla TEXT;
  v_weight NUMERIC(8,2);
  v_pct NUMERIC(6,2);
  v_pf_fs NUMERIC(8,2);
  v_normalized TEXT;
  v_hu_ref TEXT;
  v_process_key TEXT;
  v_process_name TEXT;
  v_process_objective TEXT;
  v_process_role TEXT;
  v_process_complete BOOLEAN;
  v_process_independent BOOLEAN;
  v_process_precedent TEXT;
  v_process_reasoning TEXT;
  v_decision TEXT;
  v_auxiliary_by_semantics BOOLEAN;
  v_inserted INT := 0;
  v_deduplicated INT := 0;
  v_absorbed INT := 0;
  v_review_required INT := 0;
  v_story_pf_bruto NUMERIC(10,2) := 0;
  v_story_pf_fs NUMERIC(10,2) := 0;
  v_saved_items JSONB := '[]'::jsonb;
  v_summary JSONB;
BEGIN
  SELECT session.*, project.team_id
  INTO v_session
  FROM public.apf_counting_sessions session
  JOIN public.projects project ON project.id = session.project_id
  WHERE session.id = p_session_id;

  IF v_session.id IS NULL OR v_session.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Sessão de contagem não encontrada ou encerrada';
  END IF;

  IF auth.uid() IS NOT NULL
     AND NOT (
       public.is_team_member(auth.uid(), v_session.team_id)
       OR public.has_role(auth.uid(), 'admin')
     ) THEN
    RAISE EXCEPTION 'Usuário sem acesso à sessão' USING ERRCODE = '42501';
  END IF;

  SELECT id, code, title
  INTO v_story
  FROM public.user_stories
  WHERE id = p_story_id;

  IF v_story.id IS NULL THEN
    RAISE EXCEPTION 'História de usuário não encontrada';
  END IF;

  IF jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'p_items deve ser um array JSON não vazio';
  END IF;

  DELETE FROM public.apf_counting_items
  WHERE session_id = p_session_id
    AND story_id = p_story_id
    AND cardinality(story_ids) <= 1;

  UPDATE public.apf_counting_items
  SET story_ids = array_remove(story_ids, p_story_id),
      hu_refs = array_remove(hu_refs, v_story.code),
      updated_at = now()
  WHERE session_id = p_session_id
    AND p_story_id = ANY(story_ids)
    AND cardinality(story_ids) > 1;

  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_function_sigla := upper(coalesce(nullif(v_item->>'function_sigla', ''), 'N/A'));
    v_factor_sigla := upper(coalesce(nullif(v_item->>'factor_sigla', ''), 'N/A'));
    v_hu_ref := coalesce(nullif(v_item->>'hu_ref', ''), v_story.code);
    v_normalized := public.normalize_apf_text(
      coalesce(nullif(v_item->>'ef_description', ''), v_story.title)
    );

    SELECT *
    INTO v_baseline_item
    FROM public.apf_baseline_items
    WHERE id = nullif(v_item->>'baseline_item_id', '')::uuid
      AND baseline_id = v_session.baseline_id;

    IF v_baseline_item.id IS NULL THEN
      SELECT *
      INTO v_baseline_item
      FROM public.apf_baseline_items
      WHERE baseline_id = v_session.baseline_id
        AND normalized_key = v_normalized
      LIMIT 1;
    END IF;

    IF v_baseline_item.id IS NOT NULL THEN
      v_function_sigla := coalesce(v_baseline_item.function_sigla, 'N/A');
      v_factor_sigla := coalesce(v_baseline_item.factor_sigla, 'N/A');
    END IF;

    v_process_name := coalesce(
      nullif(v_item->>'elementary_process_name', ''),
      nullif(v_item->>'process_name', ''),
      nullif(v_item->>'central_process', ''),
      nullif(v_item->>'ef_description', ''),
      v_baseline_item.description,
      v_story.title
    );
    v_process_key := coalesce(
      public.normalize_apf_process_key(v_item->>'elementary_process_key'),
      public.normalize_apf_process_key(v_item->>'process_key'),
      CASE
        WHEN v_baseline_item.id IS NOT NULL
          THEN public.normalize_apf_process_key(
            coalesce(v_baseline_item.item_ref, '') || ' ' || v_process_name
          )
        ELSE public.normalize_apf_process_key(v_process_name)
      END
    );
    v_process_objective := nullif(v_item->>'process_objective', '');
    v_process_role := lower(coalesce(nullif(v_item->>'process_role', ''), 'central'));
    v_process_complete := coalesce(
      nullif(v_item->>'process_is_complete', '')::boolean,
      v_process_role <> 'auxiliary'
    );
    v_process_independent := coalesce(
      nullif(v_item->>'process_is_independent', '')::boolean,
      v_process_role <> 'auxiliary'
    );
    v_process_precedent := coalesce(
      nullif(v_item->>'separation_precedent_ref', ''),
      nullif(v_item->>'precedent_ref', ''),
      v_baseline_item.item_ref
    );
    v_process_reasoning := coalesce(
      nullif(v_item->>'process_reasoning', ''),
      nullif(v_item->>'justification', '')
    );

    IF v_process_role NOT IN ('central', 'independent', 'auxiliary') THEN
      RAISE EXCEPTION 'Papel de processo elementar inválido: %', v_process_role;
    END IF;
    IF v_process_key IS NULL THEN
      RAISE EXCEPTION 'Não foi possível determinar a chave do processo elementar para %', v_process_name;
    END IF;

    v_auxiliary_by_semantics := public.is_apf_auxiliary_action(v_process_name);

    IF v_function_sigla = 'N/A' OR v_factor_sigla = 'N/A' THEN
      v_decision := 'not_countable';
    ELSIF v_process_role = 'auxiliary' THEN
      v_decision := 'absorbed';
    ELSIF NOT v_process_complete OR NOT v_process_independent THEN
      v_decision := 'review_required';
    ELSIF v_auxiliary_by_semantics
          AND v_baseline_item.id IS NULL
          AND v_process_precedent IS NULL THEN
      v_decision := 'review_required';
    ELSE
      v_decision := 'counted';
    END IF;

    IF v_function_sigla = 'N/A' OR v_factor_sigla = 'N/A' THEN
      v_function_class := NULL;
      v_weight := 0;
      v_pct := 0;
      v_pf_fs := 0;
    ELSE
      SELECT func_class::text, weight
      INTO v_function_class, v_weight
      FROM public.apf_function_types
      WHERE model_id = v_session.model_id
        AND sigla = v_function_sigla
        AND is_active = true;

      IF v_weight IS NULL THEN
        RAISE EXCEPTION 'Tipo funcional % não existe no modelo contratual', v_function_sigla;
      END IF;

      SELECT contribution_pct
      INTO v_pct
      FROM public.apf_impact_factors
      WHERE model_id = v_session.model_id
        AND sigla = v_factor_sigla
        AND is_active = true;

      IF v_pct IS NULL THEN
        RAISE EXCEPTION 'Fator de impacto % não existe no modelo contratual', v_factor_sigla;
      END IF;

      IF v_decision = 'counted' THEN
        v_pf_fs := round(v_weight * v_pct / 100.0, 2);
      ELSE
        v_weight := 0;
        v_pct := 0;
        v_pf_fs := 0;
      END IF;
    END IF;

    INSERT INTO public.apf_elementary_processes(
      session_id,
      process_key,
      process_name,
      objective,
      process_role,
      is_complete,
      is_independent,
      precedent_ref,
      confidence,
      decision,
      decision_reason
    ) VALUES (
      p_session_id,
      v_process_key,
      v_process_name,
      v_process_objective,
      v_process_role,
      v_process_complete,
      v_process_independent,
      v_process_precedent,
      coalesce(nullif(v_item->>'confidence', '')::numeric, 0.5),
      v_decision,
      v_process_reasoning
    )
    ON CONFLICT (session_id, process_key) DO UPDATE SET
      process_name = excluded.process_name,
      objective = coalesce(excluded.objective, apf_elementary_processes.objective),
      process_role = CASE
        WHEN apf_elementary_processes.process_role = 'central' THEN 'central'
        ELSE excluded.process_role
      END,
      is_complete = apf_elementary_processes.is_complete AND excluded.is_complete,
      is_independent = apf_elementary_processes.is_independent AND excluded.is_independent,
      precedent_ref = coalesce(excluded.precedent_ref, apf_elementary_processes.precedent_ref),
      confidence = greatest(apf_elementary_processes.confidence, excluded.confidence),
      decision = CASE
        WHEN apf_elementary_processes.decision = 'counted' THEN 'counted'
        WHEN excluded.decision = 'counted' THEN 'counted'
        WHEN apf_elementary_processes.decision = 'review_required'
          OR excluded.decision = 'review_required' THEN 'review_required'
        ELSE excluded.decision
      END,
      decision_reason = coalesce(excluded.decision_reason, apf_elementary_processes.decision_reason),
      updated_at = now()
    RETURNING id INTO v_process_id;

    v_existing := NULL;

    IF v_decision = 'counted' AND v_function_class = 'transactional' THEN
      SELECT *
      INTO v_existing
      FROM public.apf_counting_items
      WHERE session_id = p_session_id
        AND elementary_process_key = v_process_key
        AND counting_decision = 'counted'
        AND factor_sigla = v_factor_sigla
      LIMIT 1;
    ELSIF v_decision = 'counted' THEN
      SELECT *
      INTO v_existing
      FROM public.apf_counting_items
      WHERE session_id = p_session_id
        AND counting_decision = 'counted'
        AND (
          (
            v_baseline_item.id IS NOT NULL
            AND baseline_item_id = v_baseline_item.id
            AND factor_sigla = v_factor_sigla
          )
          OR (
            v_baseline_item.id IS NULL
            AND baseline_item_id IS NULL
            AND normalized_key = v_normalized
            AND function_sigla = v_function_sigla
            AND factor_sigla = v_factor_sigla
          )
        )
      LIMIT 1;
    END IF;

    IF v_existing.id IS NOT NULL THEN
      UPDATE public.apf_counting_items
      SET story_ids = CASE
            WHEN p_story_id = ANY(story_ids) THEN story_ids
            ELSE array_append(story_ids, p_story_id)
          END,
          hu_refs = CASE
            WHEN v_hu_ref = ANY(hu_refs) THEN hu_refs
            ELSE array_append(hu_refs, v_hu_ref)
          END,
          updated_at = now()
      WHERE id = v_existing.id;

      v_item_id := v_existing.id;
      v_deduplicated := v_deduplicated + 1;
    ELSE
      v_absorbing := NULL;
      IF v_decision = 'absorbed' THEN
        SELECT *
        INTO v_absorbing
        FROM public.apf_counting_items
        WHERE session_id = p_session_id
          AND elementary_process_key = v_process_key
          AND counting_decision = 'counted'
        ORDER BY created_at
        LIMIT 1;
      END IF;

      INSERT INTO public.apf_counting_items(
        session_id,
        baseline_item_id,
        story_id,
        story_ids,
        hu_ref,
        hu_refs,
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
        match_type,
        match_confidence,
        ai_confidence_score,
        normalized_key,
        source_payload,
        sort_order,
        elementary_process_id,
        elementary_process_key,
        elementary_process_name,
        process_role,
        process_is_complete,
        process_is_independent,
        counting_decision,
        process_reasoning,
        separation_precedent_ref,
        absorbed_by_item_id
      ) VALUES (
        p_session_id,
        v_baseline_item.id,
        p_story_id,
        ARRAY[p_story_id],
        v_hu_ref,
        ARRAY[v_hu_ref],
        coalesce(nullif(v_item->>'ef_description', ''), v_baseline_item.description, v_story.title),
        v_function_sigla,
        v_factor_sigla,
        coalesce(nullif(v_item->>'category_sigla', ''), v_baseline_item.category_sigla),
        coalesce(nullif(v_item->>'complexity', ''), v_baseline_item.complexity, 'Padrão'),
        v_weight,
        v_pct,
        v_pf_fs,
        nullif(v_item->>'justification', ''),
        nullif(v_item->>'evidence_literal', ''),
        coalesce(nullif(v_item->>'precedent_ref', ''), v_baseline_item.item_ref),
        coalesce(
          nullif(v_item->>'match_type', ''),
          CASE WHEN v_baseline_item.id IS NULL THEN 'ai_new_function' ELSE 'baseline_similar' END
        ),
        coalesce(nullif(v_item->>'confidence', '')::numeric, 0.5),
        coalesce(nullif(v_item->>'confidence', '')::numeric, 0.5),
        v_normalized,
        coalesce(v_item, '{}'::jsonb),
        (
          SELECT coalesce(max(sort_order), -1) + 1
          FROM public.apf_counting_items
          WHERE session_id = p_session_id
        ),
        v_process_id,
        v_process_key,
        v_process_name,
        v_process_role,
        v_process_complete,
        v_process_independent,
        v_decision,
        v_process_reasoning,
        v_process_precedent,
        v_absorbing.id
      )
      RETURNING id INTO v_item_id;

      v_inserted := v_inserted + 1;
      IF v_decision = 'absorbed' THEN
        v_absorbed := v_absorbed + 1;
      ELSIF v_decision = 'review_required' THEN
        v_review_required := v_review_required + 1;
      END IF;
    END IF;

    v_saved_items := v_saved_items || jsonb_build_array(jsonb_build_object(
      'id', v_item_id,
      'baseline_item_id', v_baseline_item.id,
      'story_id', p_story_id,
      'hu_ref', v_hu_ref,
      'ef_description', coalesce(nullif(v_item->>'ef_description', ''), v_baseline_item.description, v_story.title),
      'function_sigla', v_function_sigla,
      'factor_sigla', v_factor_sigla,
      'pf_bruto', v_weight,
      'contribution_pct', v_pct,
      'pf_fs', v_pf_fs,
      'match_type', coalesce(nullif(v_item->>'match_type', ''), 'baseline_similar'),
      'match_confidence', coalesce(nullif(v_item->>'confidence', '')::numeric, 0.5),
      'justification', v_item->>'justification',
      'evidence_literal', v_item->>'evidence_literal',
      'elementary_process_id', v_process_id,
      'elementary_process_key', v_process_key,
      'elementary_process_name', v_process_name,
      'process_role', v_process_role,
      'process_is_complete', v_process_complete,
      'process_is_independent', v_process_independent,
      'counting_decision', v_decision,
      'process_reasoning', v_process_reasoning,
      'separation_precedent_ref', v_process_precedent,
      'absorbed_by_item_id', v_absorbing.id,
      'is_validated', false
    ));
  END LOOP;

  SELECT
    round(coalesce(sum(coalesce(corrected_pf_bruto, pf_bruto)), 0), 2),
    round(coalesce(sum(coalesce(corrected_pf_fs, pf_fs)), 0), 2)
  INTO v_story_pf_bruto, v_story_pf_fs
  FROM public.apf_counting_items
  WHERE session_id = p_session_id
    AND p_story_id = ANY(story_ids)
    AND counting_decision = 'counted';

  UPDATE public.user_stories
  SET function_points = v_story_pf_fs,
      apf_pf_bruto = v_story_pf_bruto,
      apf_pf_fs = v_story_pf_fs,
      apf_function_sigla = CASE
        WHEN (
          SELECT count(*)
          FROM public.apf_counting_items
          WHERE session_id = p_session_id
            AND p_story_id = ANY(story_ids)
            AND counting_decision = 'counted'
        ) = 1 THEN (
          SELECT function_sigla
          FROM public.apf_counting_items
          WHERE session_id = p_session_id
            AND p_story_id = ANY(story_ids)
            AND counting_decision = 'counted'
          LIMIT 1
        )
        ELSE 'MIXED'
      END,
      apf_factor_sigla = CASE
        WHEN (
          SELECT count(*)
          FROM public.apf_counting_items
          WHERE session_id = p_session_id
            AND p_story_id = ANY(story_ids)
            AND counting_decision = 'counted'
        ) = 1 THEN (
          SELECT factor_sigla
          FROM public.apf_counting_items
          WHERE session_id = p_session_id
            AND p_story_id = ANY(story_ids)
            AND counting_decision = 'counted'
          LIMIT 1
        )
        ELSE 'MIXED'
      END,
      apf_counting_session_id = p_session_id,
      ai_fp_breakdown = jsonb_build_object(
        'items', v_saved_items,
        'total_pf_bruto', v_story_pf_bruto,
        'total_pf_fs', v_story_pf_fs,
        'absorbed_items', v_absorbed,
        'review_required_items', v_review_required
      ),
      ai_fp_confidence = (
        SELECT coalesce(avg(ai_confidence_score), 0.5)
        FROM public.apf_counting_items
        WHERE session_id = p_session_id
          AND p_story_id = ANY(story_ids)
      ),
      ai_fp_validated = false
  WHERE id = p_story_id;

  UPDATE public.apf_counting_sessions session
  SET total_pf_bruto = totals.pf_bruto,
      total_pf_fs = totals.pf_fs,
      total_functions = totals.functions,
      total_hus = totals.hus,
      ai_model_used = p_ai_model,
      updated_at = now()
  FROM (
    SELECT
      round(coalesce(sum(coalesce(corrected_pf_bruto, item.pf_bruto)), 0), 2) AS pf_bruto,
      round(coalesce(sum(coalesce(corrected_pf_fs, item.pf_fs)), 0), 2) AS pf_fs,
      count(*)::int AS functions,
      (
        SELECT count(DISTINCT refs.story_id)::int
        FROM public.apf_counting_items item2
        CROSS JOIN LATERAL unnest(item2.story_ids) AS refs(story_id)
        WHERE item2.session_id = p_session_id
      ) AS hus
    FROM public.apf_counting_items item
    WHERE item.session_id = p_session_id
      AND item.counting_decision = 'counted'
  ) totals
  WHERE session.id = p_session_id;

  SELECT jsonb_build_object(
    'session_id', session.id,
    'inserted_items', v_inserted,
    'deduplicated_items', v_deduplicated,
    'absorbed_items', v_absorbed,
    'review_required_items', v_review_required,
    'story_pf_bruto', round(v_story_pf_bruto, 2),
    'story_pf_fs', round(v_story_pf_fs, 2),
    'total_pf_bruto', session.total_pf_bruto,
    'total_pf_fs', session.total_pf_fs,
    'total_functions', session.total_functions,
    'total_hus', session.total_hus,
    'items', v_saved_items
  )
  INTO v_summary
  FROM public.apf_counting_sessions session
  WHERE session.id = p_session_id;

  RETURN v_summary;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_contractual_counting_items(UUID, UUID, JSONB, TEXT)
  TO authenticated;
