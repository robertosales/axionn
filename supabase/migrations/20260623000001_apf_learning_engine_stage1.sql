-- ============================================================
-- MIGRATION: 20260623000001_apf_learning_engine_stage1.sql
-- Motor de Aprendizado APF — Estágio 1: Memória Estruturada
--
-- Cria:
--   • ENUM apf_correction_reason
--   • TABLE apf_validation_events  (log imutável de todo feedback humano)
--   • TABLE apf_embedding_queue    (fila async de geração de embeddings)
--   • TRIGGER fn_apf_enqueue_embedding
--   • RPC match_similar_apf_cases  (busca vetorial RAG)
--   • RLS policies
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. Extensões necessárias
-- ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ────────────────────────────────────────────────────────────
-- 1. ENUM: razões de correção
-- ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.apf_correction_reason AS ENUM (
    'ambiguous_hu',           -- HU mal escrita / interpretação ambígua
    'wrong_functional_type',  -- IA confundiu o tipo funcional (ALI/AIE/EE/SE/CE)
    'wrong_complexity',       -- Complexidade errada (contagem DETs/RETs)
    'domain_convention',      -- Convenção específica do cliente / domínio
    'baseline_conflict',      -- Conflito com item já existente no baseline
    'scope_misunderstanding', -- IA incluiu/excluiu funcionalidade indevida
    'split_required',         -- HU deveria gerar múltiplos itens APF
    'merge_required',         -- Itens gerados pela IA deveriam ser um só
    'already_counted',        -- Item já contado em sessão anterior
    'not_countable'           -- Item não é contável por APF (infra, config, etc.)
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. TABLE: apf_validation_events
-- Um registro por item validado (acerto OU correção).
-- É o log imutável de todo feedback humano — jamais deletar.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.apf_validation_events (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vínculo com a contagem existente
  counting_item_id           uuid        REFERENCES public.apf_counting_items(id) ON DELETE SET NULL,
  session_id                 uuid        NOT NULL,
  project_id                 uuid        REFERENCES public.projects(id) ON DELETE SET NULL,
  team_id                    uuid        REFERENCES public.teams(id) ON DELETE SET NULL,

  -- Texto da HU (desnormalizado para autonomia do aprendizado)
  hu_text                    text        NOT NULL,
  hu_title                   text,
  project_domain             text,        -- 'financeiro' | 'saúde' | 'governo' | 'varejo' | etc.

  -- O que a IA sugeriu
  ai_functional_type         text        NOT NULL,
  ai_complexity              text        NOT NULL,
  ai_pf_bruto                integer,
  ai_confidence_score        numeric(4,3),
  ai_reasoning               text,        -- chain-of-thought capturado da resposta da IA
  provider_id                uuid        REFERENCES public.ai_providers(id) ON DELETE SET NULL,
  prompt_version_hash        varchar(16), -- hash dos primeiros 200 chars do prompt
  rag_was_used               boolean     NOT NULL DEFAULT false,
  rag_case_count             integer     NOT NULL DEFAULT 0,

  -- O que o especialista decidiu
  validated_functional_type  text        NOT NULL,
  validated_complexity       text        NOT NULL,
  validated_pf_bruto         integer,
  was_corrected              boolean     GENERATED ALWAYS AS (
                               ai_functional_type != validated_functional_type
                               OR ai_complexity   != validated_complexity
                             ) STORED,

  -- Metadados da correção (preenchido quando was_corrected = true)
  correction_reason_code     public.apf_correction_reason,
  correction_notes           text,
  corrected_by               uuid        REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Embedding vetorial da HU (preenchido de forma assíncrona)
  hu_embedding               vector(1536),
  embedding_generated_at     timestamptz,

  created_at                 timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.apf_validation_events IS
  'Log imutável de cada item APF validado por um especialista humano. '
  'Alimenta o Motor de Aprendizado APF (RAG + padrões organizacionais).';

-- Índices relacionais
CREATE INDEX IF NOT EXISTS idx_apf_ve_session
  ON public.apf_validation_events(session_id);
CREATE INDEX IF NOT EXISTS idx_apf_ve_project
  ON public.apf_validation_events(project_id);
CREATE INDEX IF NOT EXISTS idx_apf_ve_team
  ON public.apf_validation_events(team_id);
CREATE INDEX IF NOT EXISTS idx_apf_ve_corrected
  ON public.apf_validation_events(was_corrected);
CREATE INDEX IF NOT EXISTS idx_apf_ve_domain
  ON public.apf_validation_events(project_domain);
CREATE INDEX IF NOT EXISTS idx_apf_ve_reason
  ON public.apf_validation_events(correction_reason_code);
CREATE INDEX IF NOT EXISTS idx_apf_ve_provider
  ON public.apf_validation_events(provider_id);
-- Índice parcial para fila de embeddings pendentes
CREATE INDEX IF NOT EXISTS idx_apf_ve_embedding_null
  ON public.apf_validation_events(id)
  WHERE hu_embedding IS NULL;

-- Índice vetorial — só é útil após ~100 registros.
-- Descomente e rode manualmente quando tiver volume:
-- CREATE INDEX idx_apf_ve_embedding
--   ON public.apf_validation_events
--   USING ivfflat (hu_embedding vector_cosine_ops) WITH (lists = 50);

-- ────────────────────────────────────────────────────────────
-- 3. TABLE: apf_embedding_queue
-- Fila de embeddings a gerar. Processada pelo cron job
-- (Edge Function apf-embeddings a cada 5 minutos).
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

COMMENT ON TABLE public.apf_embedding_queue IS
  'Fila assíncrona de geração de embeddings para apf_validation_events. '
  'Processada pela Edge Function apf-embeddings via pg_cron.';

CREATE INDEX IF NOT EXISTS idx_apf_eq_pending
  ON public.apf_embedding_queue(created_at)
  WHERE status IN ('pending', 'error');

-- ────────────────────────────────────────────────────────────
-- 4. TRIGGER: auto-enqueue após inserção de evento de validação
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_apf_enqueue_embedding()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.apf_embedding_queue (event_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apf_enqueue_embedding ON public.apf_validation_events;
CREATE TRIGGER trg_apf_enqueue_embedding
  AFTER INSERT ON public.apf_validation_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_apf_enqueue_embedding();

-- ────────────────────────────────────────────────────────────
-- 5. RPC: match_similar_apf_cases
-- Busca os N casos mais semanticamente similares a uma HU.
-- Usado pelo RAG dentro da Edge Function apf-count.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.match_similar_apf_cases(
  p_query_embedding    vector(1536),
  p_team_id            uuid     DEFAULT NULL,
  p_domain             text     DEFAULT NULL,
  p_limit              integer  DEFAULT 5,
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
    ve.project_domain                                              AS domain,
    (1 - (ve.hu_embedding <=> p_query_embedding))::numeric(5,4)   AS similarity
  FROM public.apf_validation_events ve
  WHERE ve.hu_embedding IS NOT NULL
    AND (1 - (ve.hu_embedding <=> p_query_embedding)) >= p_similarity_threshold
    -- Prioridade: mesmo cliente > global
    AND (
      p_team_id IS NULL
      OR ve.team_id = p_team_id
      OR ve.team_id IS NULL
    )
    AND (
      p_domain IS NULL
      OR ve.project_domain = p_domain
      OR ve.project_domain IS NULL
    )
  ORDER BY ve.hu_embedding <=> p_query_embedding
  LIMIT p_limit;
$$;

COMMENT ON FUNCTION public.match_similar_apf_cases IS
  'Busca semântica de casos APF similares via pgvector (RAG). '
  'Chamada pela Edge Function apf-count antes de invocar a IA.';

GRANT EXECUTE ON FUNCTION public.match_similar_apf_cases TO authenticated, service_role;

-- ────────────────────────────────────────────────────────────
-- 6. RLS — apf_validation_events
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.apf_validation_events ENABLE ROW LEVEL SECURITY;

-- Leitura: membros do mesmo time ou admin
CREATE POLICY "apf_ve_select_team_or_admin"
  ON public.apf_validation_events FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM public.profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Inserção: apenas service_role (feita pelas Edge Functions)
CREATE POLICY "apf_ve_insert_service_role"
  ON public.apf_validation_events FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Atualização: apenas service_role (para gravar embedding)
CREATE POLICY "apf_ve_update_embedding"
  ON public.apf_validation_events FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────
-- 7. RLS — apf_embedding_queue (apenas service_role)
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.apf_embedding_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apf_eq_service_role_only"
  ON public.apf_embedding_queue
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────
-- 8. Grants
-- ────────────────────────────────────────────────────────────
GRANT SELECT ON public.apf_validation_events TO authenticated;
GRANT ALL    ON public.apf_validation_events TO service_role;
GRANT ALL    ON public.apf_embedding_queue   TO service_role;
