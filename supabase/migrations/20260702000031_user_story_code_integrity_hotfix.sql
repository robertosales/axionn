BEGIN;

-- ============================================================
-- HOTFIX — Integridade dos códigos de User Stories
--
-- O UUID continua sendo a identidade interna. O campo code passa a ser um
-- identificador textual único e legível, preferindo a referência oficial
-- extraída do título. external_reference preserva a referência de origem,
-- que pode se repetir em versões, projetos ou itens históricos.
--
-- Não altera story_id, análises, itens APF, PF ou fatores.
-- ============================================================

ALTER TABLE public.user_stories
  ADD COLUMN IF NOT EXISTS external_reference TEXT;

COMMENT ON COLUMN public.user_stories.external_reference IS
  'Referência funcional/oficial da HU na origem; pode se repetir e é distinta do UUID interno.';

CREATE OR REPLACE FUNCTION public.extract_user_story_external_reference(p_title TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  WITH matched AS (
    SELECT regexp_match(
      upper(trim(coalesce(p_title, ''))),
      '^(HU|FUNC)[[:space:]-]*([0-9]+([.][0-9]+)?)'
    ) AS parts
  )
  SELECT CASE
    WHEN parts IS NULL THEN NULL
    ELSE parts[1] || '-' || parts[2]
  END
  FROM matched;
$$;

COMMENT ON FUNCTION public.extract_user_story_external_reference(TEXT) IS
  'Extrai HU219, HU 219, HU-219, HU049.2 ou FUNC001 do início do título.';

UPDATE public.user_stories
SET external_reference = public.extract_user_story_external_reference(title)
WHERE nullif(trim(external_reference), '') IS NULL
  AND public.extract_user_story_external_reference(title) IS NOT NULL;

UPDATE public.user_stories
SET code = upper(trim(code)),
    external_reference = nullif(upper(trim(external_reference)), '')
WHERE code IS DISTINCT FROM upper(trim(code))
   OR external_reference IS DISTINCT FROM nullif(upper(trim(external_reference)), '');

LOCK TABLE public.user_stories IN SHARE ROW EXCLUSIVE MODE;

-- Plano completo de códigos:
-- 1. referência externa única: usa a própria referência;
-- 2. referência externa repetida: usa sufixo estável -2, -3...;
-- 3. sem referência: mantém código atual somente se não houver conflito;
-- 4. conflitos remanescentes recebem o próximo HU-numérico livre.
CREATE TEMP TABLE tmp_user_story_code_plan
ON COMMIT DROP
AS
WITH base AS (
  SELECT
    story.id AS story_id,
    story.team_id,
    story.code AS old_code,
    story.external_reference,
    story.created_at,
    CASE
      WHEN story.external_reference IS NOT NULL THEN row_number() OVER (
        PARTITION BY story.team_id, story.external_reference
        ORDER BY story.created_at, story.id
      )
      ELSE NULL
    END AS external_rank,
    row_number() OVER (
      PARTITION BY story.team_id, story.code
      ORDER BY story.created_at, story.id
    ) AS current_code_rank
  FROM public.user_stories story
),
external_plan AS (
  SELECT
    base.story_id,
    base.team_id,
    base.old_code,
    base.external_reference,
    CASE
      WHEN base.external_rank = 1 THEN base.external_reference
      ELSE base.external_reference || '-' || base.external_rank::text
    END AS new_code
  FROM base
  WHERE base.external_reference IS NOT NULL
),
no_external_keep AS (
  SELECT
    base.story_id,
    base.team_id,
    base.old_code,
    base.external_reference,
    base.old_code AS new_code
  FROM base
  WHERE base.external_reference IS NULL
    AND base.current_code_rank = 1
    AND nullif(base.old_code, '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM external_plan reserved
      WHERE reserved.team_id = base.team_id
        AND reserved.new_code = base.old_code
    )
),
needs_generated_code AS (
  SELECT base.*
  FROM base
  WHERE base.external_reference IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM no_external_keep kept
      WHERE kept.story_id = base.story_id
    )
),
reserved_codes AS (
  SELECT team_id, new_code FROM external_plan
  UNION ALL
  SELECT team_id, new_code FROM no_external_keep
),
team_maximum AS (
  SELECT
    team.team_id,
    coalesce(max(
      CASE
        WHEN reserved.new_code ~ '^HU-[0-9]+$'
          THEN substring(reserved.new_code FROM '^HU-([0-9]+)$')::bigint
        ELSE NULL
      END
    ), 0) AS maximum_number
  FROM (SELECT DISTINCT team_id FROM base) team
  LEFT JOIN reserved_codes reserved ON reserved.team_id = team.team_id
  GROUP BY team.team_id
),
generated_numbered AS (
  SELECT
    pending.*,
    row_number() OVER (
      PARTITION BY pending.team_id
      ORDER BY pending.created_at, pending.story_id
    ) AS generated_sequence
  FROM needs_generated_code pending
),
generated_plan AS (
  SELECT
    pending.story_id,
    pending.team_id,
    pending.old_code,
    pending.external_reference,
    'HU-' || lpad(
      (maximum.maximum_number + pending.generated_sequence)::text,
      greatest(3, length((maximum.maximum_number + pending.generated_sequence)::text)),
      '0'
    ) AS new_code
  FROM generated_numbered pending
  JOIN team_maximum maximum ON maximum.team_id = pending.team_id
)
SELECT * FROM external_plan
UNION ALL
SELECT * FROM no_external_keep
UNION ALL
SELECT * FROM generated_plan;

DO $$
BEGIN
  IF (SELECT count(*) FROM tmp_user_story_code_plan)
     <> (SELECT count(*) FROM public.user_stories) THEN
    RAISE EXCEPTION 'O plano de códigos não contemplou todas as User Stories';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tmp_user_story_code_plan
    GROUP BY team_id, new_code
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'O plano de códigos produziu identificadores duplicados';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.user_story_code_repair_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_key TEXT NOT NULL,
  story_id UUID NOT NULL,
  team_id UUID NOT NULL,
  old_code TEXT NOT NULL,
  new_code TEXT NOT NULL,
  external_reference TEXT,
  repaired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (migration_key, story_id)
);

ALTER TABLE public.user_story_code_repair_log ENABLE ROW LEVEL SECURITY;

INSERT INTO public.user_story_code_repair_log(
  migration_key,
  story_id,
  team_id,
  old_code,
  new_code,
  external_reference
)
SELECT
  '20260702000031',
  plan.story_id,
  plan.team_id,
  plan.old_code,
  plan.new_code,
  plan.external_reference
FROM tmp_user_story_code_plan plan
WHERE plan.old_code IS DISTINCT FROM plan.new_code
ON CONFLICT (migration_key, story_id) DO NOTHING;

UPDATE public.user_stories story
SET code = plan.new_code,
    updated_at = CASE
      WHEN story.code IS DISTINCT FROM plan.new_code THEN now()
      ELSE story.updated_at
    END
FROM tmp_user_story_code_plan plan
WHERE story.id = plan.story_id
  AND story.code IS DISTINCT FROM plan.new_code;

-- hu_ref e hu_refs são cópias de apresentação. Reconstrói pelos UUIDs.
UPDATE public.apf_counting_items item
SET hu_ref = CASE
      WHEN item.story_id IS NOT NULL THEN coalesce(
        (SELECT story.code FROM public.user_stories story WHERE story.id = item.story_id),
        item.hu_ref
      )
      WHEN cardinality(item.story_ids) = 1 THEN coalesce(
        (SELECT story.code FROM public.user_stories story WHERE story.id = item.story_ids[1]),
        item.hu_ref
      )
      ELSE item.hu_ref
    END,
    hu_refs = CASE
      WHEN cardinality(item.story_ids) > 0 THEN ARRAY(
        SELECT story.code
        FROM unnest(item.story_ids) WITH ORDINALITY AS reference(story_id, position)
        JOIN public.user_stories story ON story.id = reference.story_id
        ORDER BY reference.position
      )
      ELSE item.hu_refs
    END,
    updated_at = now()
WHERE item.story_id IS NOT NULL
   OR cardinality(item.story_ids) > 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.user_stories
    GROUP BY team_id, code
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Ainda existem códigos duplicados após o reparo';
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_stories_team_code
  ON public.user_stories(team_id, code);

CREATE INDEX IF NOT EXISTS idx_user_stories_team_external_reference
  ON public.user_stories(team_id, external_reference)
  WHERE external_reference IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.user_stories'::regclass
      AND conname = 'ck_user_stories_code_normalized'
  ) THEN
    ALTER TABLE public.user_stories
      ADD CONSTRAINT ck_user_stories_code_normalized
      CHECK (code = upper(trim(code)));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_user_story_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_base_code TEXT;
  v_candidate TEXT;
  v_suffix INTEGER := 1;
  v_next_number BIGINT;
BEGIN
  IF NEW.team_id IS NULL THEN
    RAISE EXCEPTION 'team_id é obrigatório para gerar o código da HU';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('user_story_code:' || NEW.team_id::text, 0)
  );

  NEW.external_reference := coalesce(
    nullif(upper(trim(NEW.external_reference)), ''),
    public.extract_user_story_external_reference(NEW.title)
  );

  IF NEW.external_reference IS NOT NULL THEN
    v_base_code := NEW.external_reference;
    v_candidate := v_base_code;

    WHILE EXISTS (
      SELECT 1
      FROM public.user_stories existing
      WHERE existing.team_id = NEW.team_id
        AND existing.code = v_candidate
    ) LOOP
      v_suffix := v_suffix + 1;
      v_candidate := v_base_code || '-' || v_suffix::text;
    END LOOP;

    NEW.code := v_candidate;
    RETURN NEW;
  END IF;

  NEW.code := nullif(upper(trim(NEW.code)), '');

  IF NEW.code IS NULL
     OR EXISTS (
       SELECT 1
       FROM public.user_stories existing
       WHERE existing.team_id = NEW.team_id
         AND existing.code = NEW.code
     ) THEN
    SELECT coalesce(max(
      CASE
        WHEN story.code ~ '^HU-[0-9]+$'
          THEN substring(story.code FROM '^HU-([0-9]+)$')::bigint
        ELSE NULL
      END
    ), 0) + 1
    INTO v_next_number
    FROM public.user_stories story
    WHERE story.team_id = NEW.team_id;

    LOOP
      NEW.code := 'HU-' || lpad(
        v_next_number::text,
        greatest(3, length(v_next_number::text)),
        '0'
      );

      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.user_stories existing
        WHERE existing.team_id = NEW.team_id
          AND existing.code = NEW.code
      );

      v_next_number := v_next_number + 1;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_user_story_identity
  ON public.user_stories;
CREATE TRIGGER trg_assign_user_story_identity
BEFORE INSERT
ON public.user_stories
FOR EACH ROW
EXECUTE FUNCTION public.assign_user_story_identity();

CREATE OR REPLACE VIEW public.v_user_story_code_duplicates AS
SELECT
  story.team_id,
  story.code,
  count(*) AS duplicate_count,
  array_agg(story.id ORDER BY story.created_at, story.id) AS story_ids
FROM public.user_stories story
GROUP BY story.team_id, story.code
HAVING count(*) > 1;

GRANT SELECT ON public.v_user_story_code_duplicates TO authenticated;

DO $$
DECLARE
  v_changed_count INTEGER;
BEGIN
  SELECT count(*) INTO v_changed_count
  FROM tmp_user_story_code_plan
  WHERE old_code IS DISTINCT FROM new_code;

  RAISE NOTICE 'User Story code hotfix: % código(s) reconciliado(s)', v_changed_count;
END;
$$;

COMMIT;
