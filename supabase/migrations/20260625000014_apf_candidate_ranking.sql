-- ============================================================
-- APF — ranking cirúrgico de processos e itens da baseline.
-- Evita favorecer grupos grandes e limita o payload a itens aderentes.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_apf_project_process_candidates(
  p_project_id UUID,
  p_story_text TEXT,
  p_limit INT DEFAULT 6
)
RETURNS TABLE(
  baseline_id UUID,
  process_ref TEXT,
  process_name TEXT,
  item_count INT,
  total_pf_bruto NUMERIC,
  items JSONB,
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
      AND b.scope_type = 'project'
      AND b.status = 'active'
      AND b.deleted_at IS NULL
      AND (
        auth.uid() IS NULL
        OR public.is_team_member(auth.uid(), p.team_id)
        OR public.has_role(auth.uid(), 'admin')
      )
    ORDER BY b.imported_at DESC NULLS LAST, b.created_at DESC
    LIMIT 1
  ), story AS (
    SELECT left(public.normalize_apf_text(p_story_text), 8000) AS full_story
  ), scope AS (
    SELECT
      full_story,
      left(split_part(full_story, 'criterios de aceite', 1), 2500) AS primary_story
    FROM story
  ), raw_tokens AS (
    SELECT token
    FROM scope,
      regexp_split_to_table(primary_story, '\s+') AS token
  ), story_tokens AS (
    SELECT DISTINCT
      CASE
        WHEN length(token) > 4 THEN regexp_replace(token, 's$', '')
        ELSE token
      END AS token
    FROM raw_tokens
    WHERE length(token) > 3
      AND token NOT IN (
        'para', 'com', 'dos', 'das', 'uma', 'por', 'que', 'como',
        'sistema', 'funcionalidade', 'processo', 'processos',
        'bancario', 'bancarios', 'usuario', 'usuarios', 'modulo',
        'projeto', 'historia', 'interno', 'intranet', 'internet',
        'objetivo', 'descricao', 'forma', 'acesso', 'situacao',
        'deve', 'permitir', 'disponibilizar', 'garantir', 'dados'
      )
  ), token_stats AS (
    SELECT greatest(count(*), 1)::numeric AS token_count
    FROM story_tokens
  ), item_base AS (
    SELECT
      bi.*,
      public.normalize_apf_text(concat_ws(
        ' ', bi.process_ref, bi.process_name
      )) AS process_text,
      public.normalize_apf_text(concat_ws(
        ' ', bi.item_ref, bi.description, bi.module,
        bi.product_reference, bi.project_reference,
        bi.measurement_reference
      )) AS item_text
    FROM public.apf_baseline_items bi
    JOIN active_baseline active ON active.id = bi.baseline_id
  ), item_scored AS (
    SELECT
      item.*,
      (
        SELECT count(*)::numeric
        FROM story_tokens token
        WHERE item.item_text LIKE '%' || token.token || '%'
      ) AS item_hits,
      (
        SELECT count(*)::numeric
        FROM story_tokens token
        WHERE item.process_text LIKE '%' || token.token || '%'
      ) AS process_hits,
      greatest(
        similarity(item.item_text, (SELECT primary_story FROM scope)),
        word_similarity(item.item_text, (SELECT primary_story FROM scope))
      ) AS item_similarity,
      greatest(
        similarity(item.process_text, (SELECT primary_story FROM scope)),
        word_similarity(item.process_text, (SELECT primary_story FROM scope))
      ) AS process_similarity
    FROM item_base item
  ), scored AS (
    SELECT
      item_scored.*,
      round(greatest(
        least(item_hits / least((SELECT token_count FROM token_stats), 8), 1) * 0.75
          + item_similarity * 0.25,
        least(process_hits / least((SELECT token_count FROM token_stats), 8), 1) * 0.70
          + process_similarity * 0.30
      )::numeric, 4) AS item_match_score
    FROM item_scored
  ), ranked AS (
    SELECT
      scored.*,
      row_number() OVER (
        PARTITION BY scored.baseline_id, scored.process_ref
        ORDER BY scored.item_match_score DESC, scored.source_row NULLS LAST,
          scored.description
      ) AS item_rank
    FROM scored
  ), grouped AS (
    SELECT
      ranked.baseline_id,
      ranked.process_ref,
      min(ranked.process_name) AS process_name,
      count(*)::int AS item_count,
      round(sum(ranked.pf_bruto), 2) AS total_pf_bruto,
      max(ranked.item_match_score) AS best_item_score,
      jsonb_agg(jsonb_build_object(
        'id', ranked.id,
        'item_ref', ranked.item_ref,
        'process_ref', ranked.process_ref,
        'process_name', ranked.process_name,
        'description', ranked.description,
        'module', ranked.module,
        'function_sigla', ranked.function_sigla,
        'baseline_factor_sigla', ranked.factor_sigla,
        'category_sigla', ranked.category_sigla,
        'complexity', ranked.complexity,
        'pf_bruto', ranked.pf_bruto,
        'pf_fs_baseline', ranked.pf_fs,
        'is_measurable', ranked.is_measurable,
        'notes', ranked.notes,
        'product_reference', ranked.product_reference,
        'project_reference', ranked.project_reference,
        'measurement_reference', ranked.measurement_reference,
        'match_score', ranked.item_match_score
      ) ORDER BY ranked.item_match_score DESC, ranked.source_row NULLS LAST)
        FILTER (WHERE ranked.item_rank <= 8) AS items
    FROM ranked
    GROUP BY ranked.baseline_id, ranked.process_ref
  )
  SELECT
    grouped.baseline_id,
    grouped.process_ref,
    grouped.process_name,
    grouped.item_count,
    grouped.total_pf_bruto,
    coalesce(grouped.items, '[]'::jsonb),
    round(grouped.best_item_score::numeric, 4) AS match_score
  FROM grouped
  WHERE grouped.best_item_score >= 0.05
  ORDER BY match_score DESC, grouped.item_count ASC, grouped.process_ref
  LIMIT least(greatest(coalesce(p_limit, 6), 1), 8);
$$;

GRANT EXECUTE ON FUNCTION public.get_apf_project_process_candidates(UUID, TEXT, INT)
  TO authenticated;
