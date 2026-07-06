-- Consolida project_id em demandas sem conflitar com a migration contratual 20260603.
-- A entidade canônica é public.projects; o campo texto projeto permanece para compatibilidade.

ALTER TABLE public.demandas
  ADD COLUMN IF NOT EXISTS project_id uuid
    REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_demandas_project_id
  ON public.demandas(project_id);

COMMENT ON COLUMN public.demandas.project_id IS
  'FK para projects.id. Nullable para demandas legadas e compatibilidade com o campo projeto em texto.';
