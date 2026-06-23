-- ============================================================
-- MIGRATION: 20260623000001_apf_learning_engine_stage1.sql
-- Motor de Aprendizado APF — Estágio 1: Memória Estruturada
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. Extensões
-- ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ────────────────────────────────────────────────────────────
-- 1. ENUM: razões de correção (causa raiz estruturada)
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.apf_correction_reason AS ENUM (
    'ambiguous_hu',
    'wrong_functional_type',
    'wrong_complexity',
    'domain_convention',
    'baseline_conflict',
    'scope_misunderstanding',
    'split_required',
    'merge_required',
    'already_counted',
    'not_countable'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. TABLE: apf_validation_events
-- Log imutável de cada item APF validado por especialista.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.apf_validation_events (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  counting_item_id           uuid        REFERENCES public.apf_counting_items(id) ON DELETE SET NULL,
  session_id                 uuid        NOT NULL,
  project_id                 uuid        REFERENCES public.projects(id) ON DELETE SET NULL,
  team_id                    uuid        REFERENCES public.teams(id) ON DELETE SET NULL,

  hu_text                    text        NOT NULL,
  hu_title                   text,
  project_domain             text,

  ai_functional_type         text        NOT NULL,
  ai_complexity              text        NOT NULL,
  ai_pf_bruto                integer,
  ai_confidence_score        numeric(4,3),
  ai_reasoning               text,
  provider_id                uuid        REFERENCES public.ai_providers(id) ON DELETE SET NULL,
  prompt_version_hash        varchar(16),
  rag_was_used               boolean     NOT NULL DEFAULT false,
  rag_case_count             integer     NOT NULL DEFAULT 0,

  validated_functional_type  text        NOT NULL,
  validated_complexity       text        NOT NULL,
  validated_pf_bruto         integer,
  was_corrected              boolean     GENERATED ALWAYS AS (
                               ai_functional_type != validated_functional_type
                               OR ai_complexity   != validated_complexity
                             ) STORED,

  correction_reason_code     public.apf_correction_reason,
  correction_notes           text,
  corrected_by               uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  hu_embedding               vector(1536),
  embedding_generated_at     timestamptz,

  created_at                 timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.apf_validation_events IS
  'Log imutável de cada item APF validado por especialista humano. Alimenta o Motor de Aprendizado APF.';

CREATE INDEX IF NOT EXISTS idx_apf_ve_session   ON public.apf_validation_events(session_id);
CREATE INDEX IF NOT EXISTS idx_apf_ve_project   ON public.apf_validation_events(project_id);
CREATE INDEX IF NOT EXISTS idx_apf_ve_team      ON public.apf_validation_events(team_id);
CREATE INDEX IF NOT EXISTS idx_apf_ve_corrected ON public.apf_validation_events(was_corrected);
CREATE INDEX IF NOT EXISTS idx_apf_ve_domain    ON public.apf_validation_events(project_domain);
CREATE INDEX IF NOT EXISTS idx_apf_ve_reason    ON public.apf_validation_events(correction_reason_code);
CREATE INDEX IF NOT EXISTS idx_apf_ve_provider  ON public.apf_validation_events(provider_id);
CREATE INDEX IF NOT EXISTS idx_apf_ve_embedding_null
  ON public.apf_validation_events(id) WHERE hu_embedding IS NULL;

-- ────────────────────────────────────────────────────────────
-- 3. TABLE: apf_embedding_queue
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.apf_embedding_queue (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid        NOT NULL REFERENCES public.apf_validation_events(id) ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'processing', 'done', 'error')),
  attempts      integer     NOT NULL DEFAULT 0,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_apf_eq_pending
  ON public.apf_embedding_queue(created_at)
  WHERE status IN ('pending', 'error');

-- ────────────────────────────────────────────────────────────
-- 4. TRIGGER: enqueue automático após INSERT
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_apf_enqueue_embedding()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.apf_embedding_queue (event_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apf_enqueue_embedding ON public.apf_validation_events;
CREATE TRIGGER trg_apf_enqueue_embedding
  AFTER INSERT ON public.apf_validation_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_apf_enqueue_embedding();

-- ────────────────────────────────────────────────────────────
-- 5. RPC: match_similar_apf_cases (busca vetorial RAG)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.match_similar_apf_cases(
  p_query_embedding      vector(1536),
  p_team_id              uuid    DEFAULT NULL,
  p_domain               text    DEFAULT NULL,
  p_limit                integer DEFAULT 5,
  p_similarity_threshold numeric DEFAULT 0.80
)
RETURNS TABLE (
  id                        uuid,
  hu_text                   text,
  hu_title                  text,
  validated_functional_type text,
  validated_complexity      text,
  validated_pf_bruto        integer,
  was_corrected             boolean,
  correction_reason_code    text,
  domain                    text,
  similarity                numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    ve.id,
    ve.hu_text,
    ve.hu_title,
    ve.validated_functional_type,
    ve.validated_complexity,
    ve.validated_pf_bruto,
    ve.was_corrected,
    ve.correction_reason_code::text,
    ve.project_domain AS domain,
    (1 - (ve.hu_embedding <=> p_query_embedding))::numeric(5,4) AS similarity
  FROM public.apf_validation_events ve
  WHERE ve.hu_embedding IS NOT NULL
    AND (1 - (ve.hu_embedding <=> p_query_embedding)) >= p_similarity_threshold
    AND (p_team_id IS NULL OR ve.team_id = p_team_id OR ve.team_id IS NULL)
    AND (p_domain  IS NULL OR ve.project_domain = p_domain OR ve.project_domain IS NULL)
  ORDER BY ve.hu_embedding <=> p_query_embedding
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.match_similar_apf_cases TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────
-- 6. RLS — apf_validation_events
-- Usa has_role() e is_team_member() — padrão do schema Axionn
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.apf_validation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apf_ve_select_team_or_admin"
  ON public.apf_validation_events FOR SELECT
  USING (
    public.is_team_member(auth.uid(), team_id)
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "apf_ve_insert_service_role"
  ON public.apf_validation_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "apf_ve_update_embedding"
  ON public.apf_validation_events FOR UPDATE
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────
-- 7. RLS — apf_embedding_queue (service_role apenas)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.apf_embedding_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apf_eq_service_role_only"
  ON public.apf_embedding_queue
  USING  (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────
-- 8. Grants
-- ────────────────────────────────────────────────────────────
GRANT SELECT ON public.apf_validation_events TO authenticated;
GRANT ALL    ON public.apf_validation_events TO service_role;
GRANT ALL    ON public.apf_embedding_queue   TO service_role;
