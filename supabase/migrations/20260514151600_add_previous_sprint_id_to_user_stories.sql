-- Migration: adiciona previous_sprint_id em user_stories
-- Guarda referencia da sprint anterior quando a HU e movida ao encerrar uma sprint
-- Autor: Roberto Sales | Data: 2026-05-14

ALTER TABLE user_stories
  ADD COLUMN IF NOT EXISTS previous_sprint_id uuid REFERENCES sprints(id);

COMMENT ON COLUMN user_stories.previous_sprint_id
  IS 'Referencia da sprint anterior. Preenchido automaticamente ao encerrar uma sprint, permitindo rastrear em qual sprint a HU estava antes de ser devolvida ao backlog.';
