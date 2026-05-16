-- =============================================================
-- Migration: APF Generations - persistência completa
-- Criado em: 2026-05-15
-- Descrição:
--   1. Adiciona coluna pf_total (numeric) à tabela apf_generations
--   2. Adiciona coluna pf_breakdown (jsonb) à tabela apf_generations
--   3. Adiciona status 'pending' ao check existente
--   4. Cria bucket no Storage para armazenar os docx/md gerados
--   5. Políticas RLS para o bucket
-- =============================================================

-- ---------------------------------------------------------------
-- 1. Novas colunas em apf_generations
-- ---------------------------------------------------------------
ALTER TABLE public.apf_generations
  ADD COLUMN IF NOT EXISTS pf_total      numeric,
  ADD COLUMN IF NOT EXISTS pf_breakdown  jsonb;

COMMENT ON COLUMN public.apf_generations.pf_total
  IS 'Total de Pontos de Função extraído pela IA do documento gerado';

COMMENT ON COLUMN public.apf_generations.pf_breakdown
  IS 'Detalhamento por função APF { "ALI": 3, "AIE": 1, "EE": 5, ... }';

-- ---------------------------------------------------------------
-- 2. Permitir status = 'pending' em apf_generations
--    Remove o check antigo (se existir) e recria incluindo pending
-- ---------------------------------------------------------------
DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT constraint_name INTO v_constraint
  FROM information_schema.table_constraints
  WHERE table_schema = 'public'
    AND table_name   = 'apf_generations'
    AND constraint_type = 'CHECK'
    AND constraint_name LIKE '%status%'
  LIMIT 1;

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.apf_generations DROP CONSTRAINT %I', v_constraint);
  END IF;
END;
$$;

ALTER TABLE public.apf_generations
  ADD CONSTRAINT apf_generations_status_check
  CHECK (status IN ('pending', 'success', 'error'));

-- ---------------------------------------------------------------
-- 3. Bucket no Supabase Storage: apf-documents
-- ---------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'apf-documents',
  'apf-documents',
  false,
  52428800,
  ARRAY[
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/markdown',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------
-- 4. RLS para o bucket apf-documents
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'apf-documents: authenticated upload'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "apf-documents: authenticated upload"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'apf-documents');
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'apf-documents: authenticated read'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "apf-documents: authenticated read"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'apf-documents');
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'apf-documents: authenticated delete'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "apf-documents: authenticated delete"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'apf-documents');
    $p$;
  END IF;
END;
$$;
