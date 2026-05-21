-- Migration: adiciona status_changed_at em user_stories
-- Usado pelo aging badge do KanbanCard (#3) para calcular
-- quantos dias um card permanece na mesma coluna.
-- É idempotente (IF NOT EXISTS) -- seguro rodar mais de uma vez.

-- 1. Adiciona a coluna (não falha se já existir)
ALTER TABLE public.user_stories
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Backfill: para linhas existentes que ainda não têm valor,
--    usa created_at como aproximação conservadora.
--    (Atualiza apenas onde NULL para não sobrescrever dados já gravados)
UPDATE public.user_stories
  SET status_changed_at = created_at
WHERE status_changed_at IS NULL;

-- 3. Trigger: atualiza status_changed_at automaticamente sempre que
--    o campo "status" mudar, garantindo consistência mesmo em updates
--    feitos diretamente no banco ou por outros clientes.
CREATE OR REPLACE FUNCTION public.fn_user_stories_set_status_changed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- Remove trigger anterior se existir (idempotente)
DROP TRIGGER IF EXISTS trg_user_stories_status_changed_at ON public.user_stories;

CREATE TRIGGER trg_user_stories_status_changed_at
  BEFORE UPDATE ON public.user_stories
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_user_stories_set_status_changed_at();

-- 4. Índice para queries de aging (ex: filtrar cards por tempo na coluna)
CREATE INDEX IF NOT EXISTS idx_user_stories_status_changed_at
  ON public.user_stories (status_changed_at)
  WHERE status_changed_at IS NOT NULL;
