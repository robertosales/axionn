ALTER TABLE public.git_events ALTER COLUMN provider_event_id DROP NOT NULL;
ALTER TABLE public.git_events ADD COLUMN IF NOT EXISTS headers JSONB;
ALTER TABLE public.git_events ADD COLUMN IF NOT EXISTS event_action TEXT;
CREATE INDEX IF NOT EXISTS idx_git_events_provider_event_id
  ON public.git_events (integration_id, provider_event_id)
  WHERE provider_event_id IS NOT NULL;
COMMENT ON COLUMN public.git_events.provider_event_id IS 'ID único do evento no provedor Git para idempotência (ex: gitlab-mr-12345). NULL quando o provedor não fornece ID.';
COMMENT ON COLUMN public.git_events.headers IS 'Headers relevantes do webhook recebido para auditoria e debugging.';
COMMENT ON COLUMN public.git_events.event_action IS 'Ação específica do evento: opened, closed, merged, success, failed, etc.';