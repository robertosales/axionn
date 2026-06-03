-- Fase 4: adiciona project_id (nullable) em demandas
-- O campo texto 'projeto' permanece intacto — remocao sera feita na Fase 5 apos validacao
alter table public.demandas
  add column if not exists project_id uuid
    references public.projetos(id) on delete set null;

create index if not exists idx_demandas_project_id on public.demandas(project_id);

comment on column public.demandas.project_id is
  'FK para projetos.id — substitui o campo projeto (texto livre). Nullable para compatibilidade com dados existentes.';
