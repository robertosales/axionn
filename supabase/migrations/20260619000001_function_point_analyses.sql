-- Migration: function_point_analyses
-- Tabela de histórico de contagens APF por IA para aprendizado incremental (few-shot)
-- As contagens validadas pelo usuário alimentam o prompt das próximas requisições

create table if not exists public.function_point_analyses (
  id                     uuid primary key default gen_random_uuid(),
  team_id                uuid not null references public.teams(id) on delete cascade,
  story_id               uuid references public.user_stories(id) on delete set null,
  story_text             text not null,
  story_context          jsonb,

  -- Resultado do agente IA
  ai_raw_count           numeric(7, 2),
  ai_breakdown           jsonb,        -- { EI, EO, EQ, ILF, EIF, total, confidence, reasoning }
  ai_confidence          numeric(4, 3) check (ai_confidence >= 0 and ai_confidence <= 1),
  ai_reasoning           text,

  -- Validação humana (alimenta o loop de aprendizado)
  validated_count        numeric(7, 2),
  validation_notes       text,
  validated_by           uuid references auth.users(id) on delete set null,
  validated_at           timestamptz,
  is_validated           boolean not null default false,

  -- Metadados de treinamento
  model_used             text,
  few_shot_examples_used integer default 0,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Índices
create index if not exists idx_fpa_team_validated
  on public.function_point_analyses (team_id, is_validated, validated_at desc)
  where is_validated = true;

create index if not exists idx_fpa_story
  on public.function_point_analyses (story_id);

create unique index if not exists idx_fpa_story_unique
  on public.function_point_analyses (story_id)
  where story_id is not null;

-- Trigger para atualizar updated_at
create or replace function public.update_fpa_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_fpa_updated_at
  before update on public.function_point_analyses
  for each row execute function public.update_fpa_updated_at();

-- RLS
alter table public.function_point_analyses enable row level security;

create policy "team members can read their fp analyses"
  on public.function_point_analyses for select
  using (
    team_id in (
      select team_id from public.team_members where user_id = auth.uid()
    )
  );

create policy "team members can insert fp analyses"
  on public.function_point_analyses for insert
  with check (
    team_id in (
      select team_id from public.team_members where user_id = auth.uid()
    )
  );

create policy "team members can update their fp analyses"
  on public.function_point_analyses for update
  using (
    team_id in (
      select team_id from public.team_members where user_id = auth.uid()
    )
  );

-- Colunas APF na tabela user_stories (adicionadas com IF NOT EXISTS para idempotência)
alter table public.user_stories
  add column if not exists function_points    numeric(7, 2),
  add column if not exists ai_fp_breakdown    jsonb,
  add column if not exists ai_fp_confidence   numeric(4, 3),
  add column if not exists ai_fp_validated    boolean not null default false;

comment on table public.function_point_analyses is
  'Histórico de contagens APF por IA. Contagens validadas alimentam o few-shot learning das próximas requisições.';
