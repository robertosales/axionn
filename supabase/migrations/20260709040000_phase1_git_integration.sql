-- Phase 1: Integração Git - Tabelas para GitLab/GitHub/Bitbucket
-- Cria tabelas para integrações Git, eventos, pipelines, deployments e vinculação HU-Git

-- 1. Tabela de configurações de integração Git por projeto/organização
CREATE TABLE IF NOT EXISTS public.git_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('gitlab', 'github', 'bitbucket', 'azure_devops')),
    base_url TEXT NOT NULL, -- Ex: https://gitlab.com, https://github.com, https://gitlab.empresa.com
    api_url TEXT, -- URL da API (diferente se self-hosted)
    repository_id TEXT, -- ID do repositório no provedor
    repository_path TEXT, -- Ex: grupo/projeto, owner/repo
    repository_name TEXT,
    -- Credenciais criptografadas (usar vault/secrets)
    access_token_encrypted TEXT,
    webhook_secret_encrypted TEXT,
    -- Configurações
    webhook_url TEXT, -- URL pública do webhook (preenchido após criação)
    webhook_id TEXT, -- ID do webhook no provedor
    events TEXT[] DEFAULT ARRAY['push', 'merge_request', 'pipeline', 'job', 'deployment', 'note'],
    -- Mapeamento de branches para ambientes
    production_branches TEXT[] DEFAULT ARRAY['main', 'master', 'production'],
    staging_branches TEXT[] DEFAULT ARRAY['staging', 'homolog', 'develop'],
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'error')),
    sync_error TEXT,
    -- Metadata
    config_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE (organization_id, project_id, provider, repository_path)
);

COMMENT ON TABLE public.git_integrations IS 'Configurações de integração com provedores Git (GitLab, GitHub, Bitbucket, Azure DevOps)';

-- 2. Tabela de eventos brutos de webhook Git (auditoria e reprocessamento)
CREATE TABLE IF NOT EXISTS public.git_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES public.git_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- push, merge_request, pipeline, job, deployment, note, tag_push
    event_action TEXT, -- opened, closed, merged, success, failed, etc.
    provider_event_id TEXT, -- ID único do evento no provedor (para idempotência)
    payload JSONB NOT NULL, -- Payload completo do webhook
    headers JSONB, -- Headers relevantes do webhook
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    retry_count INTEGER DEFAULT 0,
    correlation_id UUID,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (integration_id, provider_event_id)
);

COMMENT ON TABLE public.git_events IS 'Eventos brutos recebidos via webhook dos provedores Git para auditoria e reprocessamento';

CREATE INDEX IF NOT EXISTS idx_git_events_integration_received ON public.git_events (integration_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_git_events_processed ON public.git_events (processed, received_at) WHERE NOT processed;
CREATE INDEX IF NOT EXISTS idx_git_events_correlation ON public.git_events (correlation_id);

-- 3. Tabela de Merge Requests / Pull Requests
CREATE TABLE IF NOT EXISTS public.git_merge_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES public.git_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    mr_iid INTEGER NOT NULL, -- IID do MR no projeto (sequencial)
    mr_id BIGINT, -- ID global do MR
    title TEXT NOT NULL,
    description TEXT,
    state TEXT NOT NULL CHECK (state IN ('opened', 'closed', 'merged', 'locked')),
    action TEXT, -- opened, updated, merged, closed, reopened
    source_branch TEXT NOT NULL,
    target_branch TEXT NOT NULL,
    source_sha TEXT,
    target_sha TEXT,
    merge_commit_sha TEXT,
    author_email TEXT,
    author_username TEXT,
    author_id BIGINT,
    assignee_emails TEXT[],
    reviewer_emails TEXT[],
    labels TEXT[],
    web_url TEXT,
    -- Métricas de tempo
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    merged_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    first_review_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    -- Tempo em milissegundos
    time_to_first_review_ms INTEGER,
    time_to_merge_ms INTEGER,
    time_to_close_ms INTEGER,
    -- HUs vinculadas (extraídas do título/descrição/branch)
    hu_ids TEXT[],
    -- Payload original para referência
    payload JSONB,
    UNIQUE (integration_id, mr_iid)
);

COMMENT ON TABLE public.git_merge_requests IS 'Merge Requests / Pull Requests sincronizados dos provedores Git';

CREATE INDEX IF NOT EXISTS idx_git_mrs_integration_state ON public.git_merge_requests (integration_id, state);
CREATE INDEX IF NOT EXISTS idx_git_mrs_author ON public.git_merge_requests (author_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_git_mrs_hu_ids ON public.git_merge_requests USING GIN (hu_ids);
CREATE INDEX IF NOT EXISTS idx_git_mrs_merged_at ON public.git_merge_requests (merged_at DESC) WHERE merged_at IS NOT NULL;

-- 4. Tabela de Commits
CREATE TABLE IF NOT EXISTS public.git_commits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES public.git_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    commit_sha TEXT NOT NULL,
    short_sha TEXT GENERATED ALWAYS AS (substring(commit_sha FROM 1 FOR 8)) STORED,
    message TEXT NOT NULL,
    author_name TEXT,
    author_email TEXT,
    author_username TEXT,
    author_id BIGINT,
    committer_name TEXT,
    committer_email TEXT,
    committer_username TEXT,
    committed_at TIMESTAMPTZ NOT NULL,
    branch_name TEXT,
    tag_name TEXT,
    parent_shas TEXT[],
    files_changed JSONB, -- [{path, additions, deletions, changes}]
    stats JSONB, -- {additions, deletions, total}
    hu_ids TEXT[],
    web_url TEXT,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (integration_id, commit_sha)
);

COMMENT ON TABLE public.git_commits IS 'Commits sincronizados dos repositórios Git';

CREATE INDEX IF NOT EXISTS idx_git_commits_integration_date ON public.git_commits (integration_id, committed_at DESC);
CREATE INDEX IF NOT EXISTS idx_git_commits_author ON public.git_commits (author_email, committed_at DESC);
CREATE INDEX IF NOT EXISTS idx_git_commits_hu_ids ON public.git_commits USING GIN (hu_ids);
CREATE INDEX IF NOT EXISTS idx_git_commits_branch ON public.git_commits (branch_name, committed_at DESC);

-- 5. Tabela de eventos de Pipeline (GitLab CI/CD, GitHub Actions)
CREATE TABLE IF NOT EXISTS public.gitlab_pipeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    git_event_id UUID REFERENCES public.git_events(id) ON DELETE SET NULL,
    integration_id UUID NOT NULL REFERENCES public.git_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    pipeline_id BIGINT NOT NULL,
    pipeline_iid INTEGER,
    status TEXT NOT NULL CHECK (status IN ('created', 'waiting_for_resource', 'preparing', 'pending', 'running', 'success', 'failed', 'canceled', 'skipped', 'manual', 'scheduled')),
    ref TEXT NOT NULL,
    sha TEXT NOT NULL,
    source TEXT, -- push, web, schedule, api, external, pipeline, merge_request_event, external_pull_request_event, parent_pipeline
    duration_seconds INTEGER,
    coverage REAL,
    web_url TEXT,
    -- Para DORA: Lead Time for Changes
    first_commit_sha TEXT,
    first_commit_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    payload JSONB,
    UNIQUE (integration_id, pipeline_id)
);

COMMENT ON TABLE public.gitlab_pipeline_events IS 'Eventos de pipeline CI/CD para cálculo de métricas DORA';

CREATE INDEX IF NOT EXISTS idx_gitlab_pipelines_integration_status ON public.gitlab_pipeline_events (integration_id, status, finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_gitlab_pipelines_ref_sha ON public.gitlab_pipeline_events (ref, sha, finished_at DESC);
CREATE INDEX IF NOT EXISTS idx_gitlab_pipelines_project ON public.gitlab_pipeline_events (project_id, finished_at DESC);

-- 6. Tabela de eventos de Job (stages individuais do pipeline)
CREATE TABLE IF NOT EXISTS public.gitlab_job_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    git_event_id UUID REFERENCES public.git_events(id) ON DELETE SET NULL,
    integration_id UUID NOT NULL REFERENCES public.git_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    job_id BIGINT NOT NULL,
    job_name TEXT NOT NULL,
    stage TEXT,
    status TEXT NOT NULL CHECK (status IN ('created', 'pending', 'running', 'success', 'failed', 'canceled', 'skipped', 'manual', 'scheduled')),
    duration_seconds INTEGER,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    pipeline_id BIGINT NOT NULL,
    runner_id BIGINT,
    runner_tags TEXT[],
    coverage REAL,
    web_url TEXT,
    correlation_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (integration_id, job_id)
);

COMMENT ON TABLE public.gitlab_job_events IS 'Eventos de jobs individuais do pipeline para análise detalhada de stages';

CREATE INDEX IF NOT EXISTS idx_gitlab_jobs_pipeline ON public.gitlab_job_events (pipeline_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gitlab_jobs_stage_status ON public.gitlab_job_events (stage, status, finished_at DESC);

-- 7. Tabela de eventos de Deployment
CREATE TABLE IF NOT EXISTS public.gitlab_deployment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    git_event_id UUID REFERENCES public.git_events(id) ON DELETE SET NULL,
    integration_id UUID NOT NULL REFERENCES public.git_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    deployment_id BIGINT NOT NULL,
    environment TEXT NOT NULL, -- production, staging, development, etc.
    status TEXT NOT NULL CHECK (status IN ('created', 'running', 'success', 'failed', 'canceled', 'blocked')),
    commit_sha TEXT NOT NULL,
    deployable_type TEXT, -- pipeline, job, merge_request
    deployable_id BIGINT,
    deployable_url TEXT,
    -- Para DORA: Deployment Frequency e Lead Time
    deployed_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    correlation_id UUID,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (integration_id, deployment_id)
);

COMMENT ON TABLE public.gitlab_deployment_events IS 'Eventos de deployment para métricas DORA (Deployment Frequency, Lead Time)';

CREATE INDEX IF NOT EXISTS idx_gitlab_deployments_env_status ON public.gitlab_deployment_events (environment, status, deployed_at DESC);
CREATE INDEX IF NOT EXISTS idx_gitlab_deployments_sha ON public.gitlab_deployment_events (commit_sha, deployed_at DESC);
CREATE INDEX IF NOT EXISTS idx_gitlab_deployments_project ON public.gitlab_deployment_events (project_id, deployed_at DESC);

-- 8. Mapeamento de usuários Git <-> Axionn
CREATE TABLE IF NOT EXISTS public.gitlab_user_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES public.git_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    axionn_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    gitlab_user_id BIGINT NOT NULL,
    gitlab_username TEXT NOT NULL,
    gitlab_email TEXT,
    gitlab_name TEXT,
    gitlab_avatar_url TEXT,
    mapping_source TEXT DEFAULT 'email' CHECK (mapping_source IN ('email', 'username', 'manual', 'sso')),
    is_active BOOLEAN DEFAULT true,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (integration_id, gitlab_user_id),
    UNIQUE (integration_id, axionn_user_id)
);

COMMENT ON TABLE public.gitlab_user_mappings IS 'Mapeamento entre usuários do GitLab/GitHub e usuários do Axionn';

CREATE INDEX IF NOT EXISTS idx_gitlab_user_mappings_axionn ON public.gitlab_user_mappings (axionn_user_id);
CREATE INDEX IF NOT EXISTS idx_gitlab_user_mappings_email ON public.gitlab_user_mappings (gitlab_email);

-- 9. Vinculação HU <-> Entidades Git (branches, MRs, commits, deployments)
CREATE TABLE IF NOT EXISTS public.hu_git_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    hu_id UUID NOT NULL REFERENCES public.user_stories(id) ON DELETE CASCADE,
    git_entity_type TEXT NOT NULL CHECK (git_entity_type IN ('branch', 'commit', 'merge_request', 'pipeline', 'deployment', 'tag')),
    git_entity_id TEXT NOT NULL, -- SHA, MR IID, pipeline ID, deployment ID, branch name
    git_entity_data JSONB DEFAULT '{}'::jsonb, -- Dados extras: {mr_title, branch_name, pipeline_status, environment}
    integration_id UUID REFERENCES public.git_integrations(id) ON DELETE SET NULL,
    linked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    correlation_id UUID,
    UNIQUE (organization_id, hu_id, git_entity_type, git_entity_id)
);

COMMENT ON TABLE public.hu_git_links IS 'Vinculação bidirecional entre HUs (User Stories) e entidades Git';

CREATE INDEX IF NOT EXISTS idx_hu_git_links_hu ON public.hu_git_links (hu_id, linked_at DESC);
CREATE INDEX IF NOT EXISTS idx_hu_git_links_entity ON public.hu_git_links (git_entity_type, git_entity_id);
CREATE INDEX IF NOT EXISTS idx_hu_git_links_integration ON public.hu_git_links (integration_id, linked_at DESC);

-- 10. Branches rastreadas
CREATE TABLE IF NOT EXISTS public.git_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES public.git_integrations(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    branch_name TEXT NOT NULL,
    target_branch TEXT, -- branch alvo para MR
    commit_sha TEXT,
    is_protected BOOLEAN DEFAULT false,
    is_default BOOLEAN DEFAULT false,
    hu_ids TEXT[],
    last_pipeline_status TEXT,
    last_pipeline_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (integration_id, branch_name)
);

COMMENT ON TABLE public.git_branches IS 'Branches rastreadas para correlação com HUs e pipelines';

-- 11. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_git_integrations_updated_at ON public.git_integrations;
CREATE TRIGGER update_git_integrations_updated_at
    BEFORE UPDATE ON public.git_integrations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_gitlab_user_mappings_updated_at ON public.gitlab_user_mappings;
CREATE TRIGGER update_gitlab_user_mappings_updated_at
    BEFORE UPDATE ON public.gitlab_user_mappings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_git_branches_updated_at ON public.git_branches;
CREATE TRIGGER update_git_branches_updated_at
    BEFORE UPDATE ON public.git_branches
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. RLS Policies
ALTER TABLE public.git_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.git_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.git_merge_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.git_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gitlab_pipeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gitlab_job_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gitlab_deployment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gitlab_user_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hu_git_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.git_branches ENABLE ROW LEVEL SECURITY;

-- Git Integrations: org members can read, admins manage
CREATE POLICY "git_integrations_select_org_member" ON public.git_integrations
    FOR SELECT USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "git_integrations_manage_org_admin" ON public.git_integrations
    FOR ALL USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- Git Events: org admins only (sensitive payload data)
CREATE POLICY "git_events_select_org_admin" ON public.git_events
    FOR SELECT USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "git_events_insert_service" ON public.git_events
    FOR INSERT WITH CHECK (true);

-- Git Merge Requests: org members can read
CREATE POLICY "git_mrs_select_org_member" ON public.git_merge_requests
    FOR SELECT USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "git_mrs_manage_service" ON public.git_merge_requests
    FOR ALL USING (true);

-- Git Commits: org members can read
CREATE POLICY "git_commits_select_org_member" ON public.git_commits
    FOR SELECT USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "git_commits_manage_service" ON public.git_commits
    FOR ALL USING (true);

-- Pipeline/Job/Deployment Events: org admins
CREATE POLICY "gitlab_pipelines_select_org_admin" ON public.gitlab_pipeline_events
    FOR SELECT USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "gitlab_pipelines_manage_service" ON public.gitlab_pipeline_events
    FOR ALL USING (true);

CREATE POLICY "gitlab_jobs_select_org_admin" ON public.gitlab_job_events
    FOR SELECT USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "gitlab_jobs_manage_service" ON public.gitlab_job_events
    FOR ALL USING (true);

CREATE POLICY "gitlab_deployments_select_org_admin" ON public.gitlab_deployment_events
    FOR SELECT USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR public.is_platform_admin(auth.uid())
    );

CREATE POLICY "gitlab_deployments_manage_service" ON public.gitlab_deployment_events
    FOR ALL USING (true);

-- GitLab User Mappings: user can see own, admins see all
CREATE POLICY "gitlab_user_mappings_select_own" ON public.gitlab_user_mappings
    FOR SELECT USING (
        axionn_user_id = auth.uid() OR
        organization_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "gitlab_user_mappings_manage_org_admin" ON public.gitlab_user_mappings
    FOR ALL USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT org_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- HU Git Links: org members can read, service can write
CREATE POLICY "hu_git_links_select_org_member" ON public.hu_git_links
    FOR SELECT USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "hu_git_links_manage_service" ON public.hu_git_links
    FOR ALL USING (true);

-- Git Branches: org members can read
CREATE POLICY "git_branches_select_org_member" ON public.git_branches
    FOR SELECT USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "git_branches_manage_service" ON public.git_branches
    FOR ALL USING (true);

-- 13. RPC para buscar MRs de uma HU
CREATE OR REPLACE FUNCTION public.get_hu_merge_requests(p_hu_id UUID)
RETURNS SETOF public.git_merge_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT gmr.*
    FROM public.git_merge_requests gmr
    JOIN public.hu_git_links hgl ON hgl.git_entity_type = 'merge_request'
        AND hgl.git_entity_id = gmr.mr_iid::text
        AND hgl.hu_id = p_hu_id
    WHERE gmr.organization_id IN (
        SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
    )
    ORDER BY gmr.updated_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_hu_merge_requests(UUID) TO authenticated;

-- 14. RPC para buscar commits de uma HU
CREATE OR REPLACE FUNCTION public.get_hu_commits(p_hu_id UUID, p_limit INTEGER DEFAULT 50)
RETURNS SETOF public.git_commits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT gc.*
    FROM public.git_commits gc
    JOIN public.hu_git_links hgl ON hgl.git_entity_type = 'commit'
        AND hgl.git_entity_id = gc.commit_sha
        AND hgl.hu_id = p_hu_id
    WHERE gc.organization_id IN (
        SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
    )
    ORDER BY gc.committed_at DESC
    LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_hu_commits(UUID, INTEGER) TO authenticated;

-- 15. RPC para buscar deployments de uma HU
CREATE OR REPLACE FUNCTION public.get_hu_deployments(p_hu_id UUID)
RETURNS SETOF public.gitlab_deployment_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT gde.*
    FROM public.gitlab_deployment_events gde
    JOIN public.hu_git_links hgl ON hgl.git_entity_type = 'deployment'
        AND hgl.git_entity_id = gde.deployment_id::text
        AND hgl.hu_id = p_hu_id
    WHERE gde.organization_id IN (
        SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
    )
    ORDER BY gde.deployed_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_hu_deployments(UUID) TO authenticated;

-- 16. View para dashboard de HU com info Git
CREATE OR REPLACE VIEW public.v_hu_git_summary AS
SELECT
    hu.id AS hu_id,
    hu.code AS hu_code,
    hu.title AS hu_title,
    hu.status AS hu_status,
    t.project_id,
    p.name AS project_name,
    COUNT(DISTINCT hgl.id) FILTER (WHERE hgl.git_entity_type = 'merge_request') AS mr_count,
    COUNT(DISTINCT hgl.id) FILTER (WHERE hgl.git_entity_type = 'commit') AS commit_count,
    COUNT(DISTINCT hgl.id) FILTER (WHERE hgl.git_entity_type = 'deployment') AS deployment_count,
    MAX(hgl.linked_at) AS last_git_activity_at,
    -- Último MR
    (
        SELECT jsonb_build_object(
            'mr_iid', gmr.mr_iid,
            'title', gmr.title,
            'state', gmr.state,
            'web_url', gmr.web_url,
            'merged_at', gmr.merged_at
        )
        FROM public.git_merge_requests gmr
        JOIN public.hu_git_links hgl2 ON hgl2.git_entity_type = 'merge_request'
            AND hgl2.git_entity_id = gmr.mr_iid::text
            AND hgl2.hu_id = hu.id
        WHERE gmr.organization_id = c.org_id
        ORDER BY gmr.updated_at DESC
        LIMIT 1
    ) AS latest_mr,
    -- Último deployment em produção
    (
        SELECT jsonb_build_object(
            'deployment_id', gde.deployment_id,
            'environment', gde.environment,
            'status', gde.status,
            'deployed_at', gde.deployed_at,
            'commit_sha', gde.commit_sha
        )
        FROM public.gitlab_deployment_events gde
        JOIN public.hu_git_links hgl3 ON hgl3.git_entity_type = 'deployment'
            AND hgl3.git_entity_id = gde.deployment_id::text
            AND hgl3.hu_id = hu.id
        WHERE gde.organization_id = c.org_id
          AND gde.environment = 'production'
        ORDER BY gde.deployed_at DESC
        LIMIT 1
    ) AS latest_production_deployment
FROM public.user_stories hu
JOIN public.teams t ON t.id = hu.team_id
LEFT JOIN public.projects p ON p.id = t.project_id
LEFT JOIN public.contracts c ON c.id = p.contract_id
LEFT JOIN public.hu_git_links hgl ON hgl.hu_id = hu.id
WHERE c.org_id IN (
    SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
)
GROUP BY hu.id, hu.code, hu.title, hu.status, t.project_id, p.name, c.org_id;

COMMENT ON VIEW public.v_hu_git_summary IS 'Resumo de atividade Git por HU para dashboards';