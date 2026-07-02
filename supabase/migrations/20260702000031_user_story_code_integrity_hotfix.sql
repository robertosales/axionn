BEGIN;

-- ============================================================
-- HOTFIX — Integridade dos códigos de User Stories
--
-- Problema:
--   O frontend gerava code por userStories.length + 1. Inserções rápidas
--   podiam persistir várias HUs com o mesmo código interno.
--
-- Estratégia:
--   1. separar código interno de referência externa/oficial;
--   2. preencher external_reference a partir do início do título;
--   3. reparar apenas os códigos internos duplicados;
--   4. sincronizar as cópias textuais da contagem APF;
--   5. impedir novas duplicidades com índice único;
--   6. atribuir o código em trigger transacional com advisory lock.
--
-- Não altera story_id, análises, itens APF, PF ou fatores.
-- ============================================================

ALTER TABLE public.user_stories
  ADD COLUMN IF NOT EXISTS external_reference TEXT;

COMMENT ON COLUMN public.user_stories.external_reference IS
  'Referência funcional/oficial da HU na origem, distinta do código interno único do Axion.';

-- Normaliza referências no formato HU219, HU 219, HU-219, HU049.2 ou FUNC001.
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
  'Extrai e normaliza a referência funcional localizada no início do título da User Story.';

-- Preserva valores preenchidos manualmente e completa somente registros sem referência.
UPDATE public.user_stories
SET external_reference = public.extract_user_story_external_reference(title)
WHERE nullif(trim(external_reference), '') IS NULL
  AND public.extract_user_story_external_reference(title) IS NOT NULL;

-- Normaliza o código interno antes de identificar as duplicidades.
UPDATE public.user_stories
SET code = upper(trim(code))
WHERE code IS DISTINCT FROM upper(trim(code));

LOCK TABLE public.user_stories IN SHARE ROW EXCLUSIVE MODE;

-- Mapeamento temporário dos códigos internos que precisam ser reparados.
CREATE TEMP TABLE tmp_user_story_code_repairs
ON COMMIT DROP
AS
WITH ranked AS (
  SELECT
    story.id,
    story.team_id,
    story.code AS old_code,
    story.created_at,
    row_number() OVER (
      PARTITION BY story.team_id, story.code
      ORDER BY story.created_at, story.id
    ) AS duplicate_rank
  FROM public.user_stories story
),
to_repair AS (
  SELECT
    ranked.*,
    row_number() OVER (
      PARTITION BY ranked.team_id
      ORDER BY ranked.old_code, ranked.created_at, ranked.id
    ) AS repair_sequence
  FROM ranked
  WHERE ranked.duplicate_rank > 1
),
team_maximum AS (
  SELECT
    story.team_id,
    coalesce(max(
      CASE
        WHEN story.code ~ '^HU-[0-9]+$'
          THEN substring(story.code FROM '^HU-([0-9]+)$')::bigint
        ELSE NULL
      END
    ), 0) AS maximum_number
  FROM public.user_stories story
  GROUP BY story.team_id
)
SELECT
  repair.id AS story_id,
  repair.team_id,
  repair.old_code,
  'HU-' || lpad(
    (maximum.maximum_number + repair.repair_sequence)::text,
    greatest(3, length((maximum.maximum_number + repair.repair_sequence)::text)),
    '0'
  ) AS new_code
FROM to_repair repair
JOIN team_maximum maximum ON maximum.team_id = repair.team_id;

-- Auditoria persistente do reparo para conferência posterior.
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
  repair.story_id,
  repair.team_id,
  repair.old_code,
  repair.new_code,
  story.external_reference
FROM tmp_user_story_code_repairs repair
JOIN public.user_stories story ON story.id = repair.story_id
ON CONFLICT (migration_key, story_id) DO NOTHING;

-- Repara somente a identidade textual. UUIDs e relacionamentos permanecem iguais.
UPDATE public.user_stories story
SET code = repair.new_code,
    updated_at = now()
FROM tmp_user_story_code_repairs repair
WHERE story.id = repair.story_id;

-- A contagem APF mantém hu_ref/hu_refs como cópias para relatórios.
-- Reconstrói essas cópias a partir dos UUIDs, sem alterar os itens ou os PFs.
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
WHERE EXISTS (
  SELECT 1
  FROM tmp_user_story_code_repairs repair
  WHERE repair.story_id = item.story_id
     OR repair.story_id = ANY(item.story_ids)
);

-- A migration deve falhar antes do índice se algum caso não tiver sido reparado.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.user_stories
    GROUP BY team_id, code
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Ainda existem códigos internos duplicados após o reparo';
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

-- Gera o próximo código sob lock por time. O lock evita corrida entre inserções.
CREATE OR REPLACE FUNCTION public.assign_user_story_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_number BIGINT;
BEGIN
  IF NEW.team_id IS NULL THEN
    RAISE EXCEPTION 'team_id é obrigatório para gerar o código da HU';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('user_story_code:' || NEW.team_id::text, 0)
  );

  NEW.external_reference := coalesce(
    nullif(trim(NEW.external_reference), ''),
    public.extract_user_story_external_reference(NEW.title)
  );

  NEW.code := nullif(upper(trim(NEW.code)), '');

  IF NEW.code IS NULL
     OR EXISTS (
       SELECT 1
       FROM public.user_stories existing
       WHERE existing.team_id = NEW.team_id
         AND existing.code = NEW.code
         AND existing.id IS DISTINCT FROM NEW.id
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
          AND existing.id IS DISTINCT FROM NEW.id
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

-- Diagnóstico operacional: deve permanecer vazio após a migration.
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
  v_repaired_count INTEGER;
BEGIN
  SELECT count(*) INTO v_repaired_count
  FROM tmp_user_story_code_repairs;

  RAISE NOTICE 'User Story code hotfix: % código(s) interno(s) reparado(s)', v_repaired_count;
END;
$$;

COMMIT;
