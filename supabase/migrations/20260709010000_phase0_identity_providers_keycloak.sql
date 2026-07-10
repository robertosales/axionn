-- Phase 0: Fundações - Identity Providers (Keycloak) e Mapeamento de Usuários
-- Cria tabelas para configuração de provedores de identidade e mapeamento de usuários

-- 1. Tabela de provedores de identidade (Keycloak, Azure AD, etc.)
CREATE TABLE IF NOT EXISTS public.identity_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    provider_type TEXT NOT NULL CHECK (provider_type IN ('keycloak', 'azure_ad', 'okta', 'auth0', 'generic_oidc')),
    issuer_url TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_secret_encrypted TEXT,
    jwks_url TEXT,
    authorization_endpoint TEXT,
    token_endpoint TEXT,
    userinfo_endpoint TEXT,
    scopes TEXT[] DEFAULT ARRAY['openid', 'profile', 'email'],
    claim_mapping JSONB DEFAULT '{
        "sub": "sub",
        "email": "email",
        "name": "name",
        "preferred_username": "preferred_username",
        "groups": "groups",
        "roles": "roles"
    }'::jsonb,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    config_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    UNIQUE (organization_id, name)
);

COMMENT ON TABLE public.identity_providers IS 'Configuração de provedores de identidade OIDC/OAuth2 por organização (Keycloak, Azure AD, etc.)';
COMMENT ON COLUMN public.identity_providers.claim_mapping IS 'Mapeamento de claims do token OIDC para campos internos';

-- 2. Tabela de mapeamento de usuários Keycloak <-> Axionn
CREATE TABLE IF NOT EXISTS public.keycloak_user_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    identity_provider_id UUID NOT NULL REFERENCES public.identity_providers(id) ON DELETE CASCADE,
    axionn_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    keycloak_user_id TEXT NOT NULL,
    keycloak_username TEXT,
    keycloak_email TEXT,
    keycloak_realm TEXT,
    sync_status TEXT DEFAULT 'active' CHECK (sync_status IN ('active', 'inactive', 'pending', 'error')),
    last_synced_at TIMESTAMPTZ,
    sync_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (identity_provider_id, keycloak_user_id),
    UNIQUE (identity_provider_id, axionn_user_id)
);

COMMENT ON TABLE public.keycloak_user_mappings IS 'Mapeamento bidirecional entre usuários do Axionn e usuários do Keycloak';

-- 3. Tabela de eventos de autenticação e autorização (auditoria de auth)
CREATE TABLE IF NOT EXISTS public.auth_audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    identity_provider_id UUID REFERENCES public.identity_providers(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'login_success', 'login_failure', 'logout', 'token_refresh', 'token_revoked',
        'mfa_challenge', 'mfa_success', 'mfa_failure',
        'password_change', 'password_reset_request', 'password_reset_complete',
        'account_locked', 'account_unlocked', 'session_expired',
        'permission_denied', 'role_assigned', 'role_revoked',
        'group_added', 'group_removed'
    )),
    client_id TEXT,
    ip_address INET,
    user_agent TEXT,
    correlation_id UUID,
    result TEXT NOT NULL CHECK (result IN ('success', 'failure', 'partial')),
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.auth_audit_events IS 'Auditoria de eventos de autenticação e autorização (login, logout, MFA, permissões, etc.)';

CREATE INDEX IF NOT EXISTS idx_auth_audit_events_org_created ON public.auth_audit_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_events_user_created ON public.auth_audit_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_events_correlation ON public.auth_audit_events (correlation_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_events_type_created ON public.auth_audit_events (event_type, created_at DESC);

-- 4. Trigger para updated_at nas tabelas de identity
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_identity_providers_updated_at ON public.identity_providers;
CREATE TRIGGER update_identity_providers_updated_at
    BEFORE UPDATE ON public.identity_providers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_keycloak_user_mappings_updated_at ON public.keycloak_user_mappings;
CREATE TRIGGER update_keycloak_user_mappings_updated_at
    BEFORE UPDATE ON public.keycloak_user_mappings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. RLS Policies
ALTER TABLE public.identity_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keycloak_user_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_events ENABLE ROW LEVEL SECURITY;

-- Identity Providers: org members can read, admins can manage
CREATE POLICY "identity_providers_select_org_member" ON public.identity_providers
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "identity_providers_manage_org_admin" ON public.identity_providers
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- Keycloak User Mappings: users can see their own, admins can manage all
CREATE POLICY "keycloak_user_mappings_select_own" ON public.keycloak_user_mappings
    FOR SELECT USING (
        axionn_user_id = auth.uid() OR
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

CREATE POLICY "keycloak_user_mappings_manage_org_admin" ON public.keycloak_user_mappings
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        )
    );

-- Auth Audit Events: only org admins and platform admins can read
CREATE POLICY "auth_audit_events_select_org_admin" ON public.auth_audit_events
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
        ) OR
        public.is_platform_admin(auth.uid())
    );

-- Insert policy for system/services to write audit events
CREATE POLICY "auth_audit_events_insert_service" ON public.auth_audit_events
    FOR INSERT WITH CHECK (true);

-- 6. RPC para buscar provedor de identidade ativo padrão da organização
CREATE OR REPLACE FUNCTION public.get_default_identity_provider(p_organization_id UUID)
RETURNS public.identity_providers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_provider public.identity_providers;
BEGIN
    SELECT * INTO v_provider
    FROM public.identity_providers
    WHERE organization_id = p_organization_id
      AND is_active = true
      AND is_default = true
    LIMIT 1;

    IF v_provider IS NULL THEN
        SELECT * INTO v_provider
        FROM public.identity_providers
        WHERE organization_id = p_organization_id
          AND is_active = true
        ORDER BY created_at ASC
        LIMIT 1;
    END IF;

    RETURN v_provider;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_default_identity_provider(UUID) TO authenticated;

-- 7. RPC para registrar evento de auditoria de auth
CREATE OR REPLACE FUNCTION public.log_auth_audit_event(
    p_organization_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_identity_provider_id UUID DEFAULT NULL,
    p_event_type TEXT,
    p_client_id TEXT DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_correlation_id UUID DEFAULT NULL,
    p_result TEXT,
    p_failure_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO public.auth_audit_events (
        organization_id, user_id, identity_provider_id, event_type,
        client_id, ip_address, user_agent, correlation_id,
        result, failure_reason, metadata
    ) VALUES (
        p_organization_id, p_user_id, p_identity_provider_id, p_event_type,
        p_client_id, p_ip_address, p_user_agent, p_correlation_id,
        p_result, p_failure_reason, p_metadata
    ) RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_auth_audit_event(
    UUID, UUID, UUID, TEXT, TEXT, INET, TEXT, UUID, TEXT, TEXT, JSONB
) TO authenticated;

-- 8. Função para sincronizar usuário do Keycloak
CREATE OR REPLACE FUNCTION public.sync_keycloak_user(
    p_identity_provider_id UUID,
    p_keycloak_user_id TEXT,
    p_keycloak_username TEXT DEFAULT NULL,
    p_keycloak_email TEXT DEFAULT NULL,
    p_keycloak_realm TEXT DEFAULT NULL,
    p_axionn_user_id UUID DEFAULT NULL
)
RETURNS public.keycloak_user_mappings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_mapping public.keycloak_user_mappings;
    v_org_id UUID;
BEGIN
    SELECT organization_id INTO v_org_id
    FROM public.identity_providers
    WHERE id = p_identity_provider_id;

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Identity provider not found';
    END IF;

    -- Tenta encontrar mapeamento existente
    SELECT * INTO v_mapping
    FROM public.keycloak_user_mappings
    WHERE identity_provider_id = p_identity_provider_id
      AND keycloak_user_id = p_keycloak_user_id;

    IF v_mapping IS NOT NULL THEN
        -- Atualiza mapeamento existente
        UPDATE public.keycloak_user_mappings
        SET keycloak_username = p_keycloak_username,
            keycloak_email = p_keycloak_email,
            keycloak_realm = p_keycloak_realm,
            sync_status = 'active',
            last_synced_at = now(),
            axionn_user_id = COALESCE(p_axionn_user_id, axionn_user_id),
            updated_at = now()
        WHERE id = v_mapping.id
        RETURNING * INTO v_mapping;
    ELSE
        -- Cria novo mapeamento
        IF p_axionn_user_id IS NULL THEN
            -- Tenta encontrar usuário Axionn pelo email
            SELECT id INTO p_axionn_user_id
            FROM auth.users
            WHERE email = p_keycloak_email
            LIMIT 1;
        END IF;

        INSERT INTO public.keycloak_user_mappings (
            organization_id, identity_provider_id, axionn_user_id,
            keycloak_user_id, keycloak_username, keycloak_email, keycloak_realm,
            sync_status, last_synced_at
        ) VALUES (
            v_org_id, p_identity_provider_id, p_axionn_user_id,
            p_keycloak_user_id, p_keycloak_username, p_keycloak_email, p_keycloak_realm,
            'active', now()
        ) RETURNING * INTO v_mapping;
    END IF;

    RETURN v_mapping;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_keycloak_user(UUID, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;