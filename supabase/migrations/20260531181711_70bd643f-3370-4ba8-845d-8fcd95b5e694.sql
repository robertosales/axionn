
-- Onda 1, Passo 1: Índices críticos para performance com 150 usuários simultâneos
-- Todos com IF NOT EXISTS — idempotente e seguro de reexecutar.

-- user_stories: filtro principal do Kanban
CREATE INDEX IF NOT EXISTS idx_user_stories_team_sprint_status
  ON public.user_stories(team_id, sprint_id, status);
CREATE INDEX IF NOT EXISTS idx_user_stories_backlog
  ON public.user_stories(team_id) WHERE sprint_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_stories_sprint_id
  ON public.user_stories(sprint_id) WHERE sprint_id IS NOT NULL;

-- demandas: lista e KPIs de Sustentação
CREATE INDEX IF NOT EXISTS idx_demandas_team_situacao_created
  ON public.demandas(team_id, situacao, created_at DESC);

-- demanda_transitions: cálculo de TMR/MTTR/MTTA
CREATE INDEX IF NOT EXISTS idx_demanda_transitions_demanda_created
  ON public.demanda_transitions(demanda_id, created_at);

-- demanda_hours: trigger total_horas + KPIs produtividade
CREATE INDEX IF NOT EXISTS idx_demanda_hours_demanda
  ON public.demanda_hours(demanda_id);
CREATE INDEX IF NOT EXISTS idx_demanda_hours_user
  ON public.demanda_hours(user_id) WHERE user_id IS NOT NULL;

-- activities: soma de horas por HU
CREATE INDEX IF NOT EXISTS idx_activities_hu
  ON public.activities(hu_id);

-- impediments: impedimentos abertos
CREATE INDEX IF NOT EXISTS idx_impediments_team_open
  ON public.impediments(team_id) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_impediments_hu
  ON public.impediments(hu_id) WHERE hu_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_impediments_sprint
  ON public.impediments(sprint_id) WHERE sprint_id IS NOT NULL;

-- demanda_eventos: cálculo IMR
CREATE INDEX IF NOT EXISTS idx_demanda_eventos_demanda_created
  ON public.demanda_eventos(demanda_id, created_at);

-- notifications: sino (notificações não lidas)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, created_at DESC) WHERE is_read = false;
