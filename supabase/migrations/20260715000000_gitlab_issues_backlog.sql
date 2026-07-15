-- Fase 1: GitLab issues -> backlog de um Time no Axionn
-- Adiciona à git_integrations o time de destino e o roteamento por label,
-- e estende o CHECK de hu_git_links para permitir o vínculo 'issue'.

ALTER TABLE public.git_integrations
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sync_issues_as_backlog BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS issue_labels_team_map JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.git_integrations.team_id IS
  'Time que recebe as issues do GitLab como itens de backlog.';
COMMENT ON COLUMN public.git_integrations.sync_issues_as_backlog IS
  'Se true, issues do GitLab viram user_stories (HU) no backlog do team_id.';
COMMENT ON COLUMN public.git_integrations.issue_labels_team_map IS
  'Mapa rotulo->team_id para rotear issues por label (ex: {"time::A":"<id>"})';

-- Estender CHECK de git_entity_type para incluir 'issue'
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint c
  WHERE c.conrelid = 'public.hu_git_links'::regclass
    AND pg_get_constraintdef(c.oid) LIKE '%git_entity_type%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.hu_git_links DROP CONSTRAINT %I', cname);
  END IF;
END
$$;

ALTER TABLE public.hu_git_links
  ADD CONSTRAINT hu_git_links_git_entity_type_check
  CHECK (git_entity_type IN ('branch', 'commit', 'merge_request', 'pipeline', 'deployment', 'tag', 'issue'));

CREATE INDEX IF NOT EXISTS idx_hu_git_links_issue
  ON public.hu_git_links (git_entity_type, git_entity_id)
  WHERE git_entity_type = 'issue';
