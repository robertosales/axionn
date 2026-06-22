-- ============================================================
-- MIGRATION: Multi-Tenancy + APF Engine
-- Branch:    feat/multi-tenancy-apf-engine
-- Data:      2026-06-20
-- Descrição: Fundação completa para plataforma SaaS multi-tenant
--            com motor de contagem APF configurável por contrato.
-- IMPORTANTE: Não altera tabelas existentes (contracts, projects,
--             contract_slas, user_stories) — apenas adiciona.
-- ============================================================

-- ============================================================
-- BLOCO 1: EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- BLOCO 2: ENUM TYPES
-- ============================================================

DO $$ BEGIN
  CREATE TYPE org_plan AS ENUM ('free', 'pro', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE org_status AS ENUM ('active', 'trial', 'suspended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE org_member_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE apf_standard AS ENUM ('pfs_dpf', 'ifpug', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE apf_function_class AS ENUM ('transactional', 'data');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE apf_baseline_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE apf_session_status AS ENUM ('in_progress', 'pending_review', 'validated', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- BLOCO 3: MULTI-TENANCY — organizations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  plan          org_plan NOT NULL DEFAULT 'trial',
  status        org_status NOT NULL DEFAULT 'trial',
  logo_url      TEXT,
  -- Limites por plano
  max_projects  INT NOT NULL DEFAULT 3,
  max_users     INT NOT NULL DEFAULT 5,
  max_countings_per_month INT NOT NULL DEFAULT 20,
  -- Contato
  contact_email TEXT,
  contact_name  TEXT,
  -- Datas
  trial_ends_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organizations IS
  'Empresas/tenants licenciados na plataforma Axionn SaaS.';

-- ============================================================
-- BLOCO 4: MULTI-TENANCY — organization_members
-- ============================================================

CREATE TABLE IF NOT EXISTS public.organization_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        org_member_role NOT NULL DEFAULT 'member',
  invited_by  UUID REFERENCES auth.users(id),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

COMMENT ON TABLE public.organization_members IS
  'Vínculo usuário <-> organização com papel (owner/admin/member).';

CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_id  ON public.organization_members(org_id);

-- ============================================================
-- BLOCO 5: vincular contracts existentes a organizations
-- (nullable para não quebrar dados existentes)
-- ============================================================

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.contracts.org_id IS
  'Organização dona do contrato. NULL = contrato legado (pré-multitenancy).';

CREATE INDEX IF NOT EXISTS idx_contracts_org_id ON public.contracts(org_id);

-- ============================================================
-- BLOCO 6: APF — apf_counting_models
-- Um modelo por contrato. Define o padrão de contagem.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apf_counting_models (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id  UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  standard     apf_standard NOT NULL DEFAULT 'pfs_dpf',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contract_id)  -- 1 modelo por contrato
);

COMMENT ON TABLE public.apf_counting_models IS
  'Modelo de contagem APF vinculado a um contrato. Define padrão, tipos e fatores.';

CREATE INDEX IF NOT EXISTS idx_apf_models_contract_id ON public.apf_counting_models(contract_id);

-- ============================================================
-- BLOCO 7: APF — apf_function_types
-- Tipos de função configuráveis (TRN, ARQ, EI, EO, EQ, ILF, EIF...)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apf_function_types (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id    UUID NOT NULL REFERENCES public.apf_counting_models(id) ON DELETE CASCADE,
  sigla       TEXT NOT NULL,          -- TRN, ARQ, EI, EO...
  name        TEXT NOT NULL,          -- Transação, Arquivo, Entrada Externa...
  func_class  apf_function_class NOT NULL DEFAULT 'transactional',
  weight      NUMERIC(5,2) NOT NULL,  -- 4.60, 7.00, 3.00...
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_id, sigla)
);

COMMENT ON TABLE public.apf_function_types IS
  'Tipos de função configuráveis por modelo APF. Ex: TRN=4.6, ARQ=7.0 para PFS/DPF.';

CREATE INDEX IF NOT EXISTS idx_apf_func_types_model_id ON public.apf_function_types(model_id);

-- ============================================================
-- BLOCO 8: APF — apf_impact_factors
-- 34 fatores de impacto do contrato DPF-GlobalWeb (e outros)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apf_impact_factors (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id              UUID NOT NULL REFERENCES public.apf_counting_models(id) ON DELETE CASCADE,
  sigla                 TEXT NOT NULL,          -- I, A, A75, COR50, GAR...
  name                  TEXT NOT NULL,          -- Inclusão, Alteração...
  contribution_pct      NUMERIC(6,2) NOT NULL,  -- 100.00, 60.00, 75.00...
  action_on_baseline    TEXT NOT NULL DEFAULT 'Incluir/Alterar',  -- ou 'Remover' ou 'Não Impacta'
  origin                TEXT,                   -- Guia de Métricas DPF, SISP - 4.3...
  is_inm                BOOLEAN NOT NULL DEFAULT false,  -- Item Não Mensurável
  is_active             BOOLEAN NOT NULL DEFAULT true,
  sort_order            INT NOT NULL DEFAULT 0,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_id, sigla)
);

COMMENT ON TABLE public.apf_impact_factors IS
  'Fatores de impacto configuráveis. Os 34 fatores DPF-GlobalWeb são o seed padrão.';

CREATE INDEX IF NOT EXISTS idx_apf_factors_model_id ON public.apf_impact_factors(model_id);

-- ============================================================
-- BLOCO 9: APF — apf_categories
-- ARN, ADS, ATD, AGR, NM — categorias funcionais
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apf_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id    UUID NOT NULL REFERENCES public.apf_counting_models(id) ON DELETE CASCADE,
  sigla       TEXT NOT NULL,   -- ARN, ADS, ATD, AGR, NM
  name        TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (model_id, sigla)
);

COMMENT ON TABLE public.apf_categories IS
  'Categorias funcionais por modelo: ARN (Navegação), ADS (Dados), ATD (Técnico), AGR (Regulatório), NM.';

-- ============================================================
-- BLOCO 10: APF — apf_counting_rules
-- Regras de comportamento da IA — texto configurável por contrato
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apf_counting_rules (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id                    UUID NOT NULL REFERENCES public.apf_counting_models(id) ON DELETE CASCADE,
  -- Seções do prompt APF (§3, §5, §6, §10, §11, §19, §21 do prompt)
  rule_mission                TEXT,  -- missão do especialista (§2)
  rule_fundamental_principle  TEXT,  -- HU é gatilho, EF é unidade (§3)
  rule_decision_hierarchy     TEXT,  -- hierarquia de decisão (§5)
  rule_critical_guidelines    TEXT,  -- regras críticas (§6)
  rule_elementary_process     TEXT,  -- processo elementar e unicidade (§10)
  rule_granularity            TEXT,  -- granularidade (§11)
  rule_precedence_override    TEXT,  -- histórico do time vence teoria (§19/§20)
  rule_closure                TEXT,  -- fechamento do processo elementar (§21)
  -- Regra de consistência contratual (§20)
  rule_contractual_consistency TEXT,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_id)
);

COMMENT ON TABLE public.apf_counting_rules IS
  'Regras de comportamento da IA por modelo. Montam o prompt dinâmico em tempo de execução.';

-- ============================================================
-- BLOCO 11: APF — apf_output_templates
-- Template do documento de evidência de contagem (9 seções)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apf_output_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id    UUID NOT NULL REFERENCES public.apf_counting_models(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Modelo de Evidência Padrão',
  sections    JSONB NOT NULL DEFAULT '[]',
  -- sections é um array JSON com estrutura:
  -- [{ "id": "1", "title": "Dados do Atendimento", "fields": [...] }, ...]
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (model_id)
);

COMMENT ON TABLE public.apf_output_templates IS
  'Template do documento de evidência de contagem. Estrutura JSON das 9 seções oficiais.';

-- ============================================================
-- BLOCO 12: APF — apf_project_baselines
-- Baseline versionada por projeto
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apf_project_baselines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  model_id    UUID NOT NULL REFERENCES public.apf_counting_models(id) ON DELETE RESTRICT,
  version     TEXT NOT NULL,           -- v1.0, v2.0, Sprint01-R05...
  label       TEXT,                    -- descrição legível
  status      apf_baseline_status NOT NULL DEFAULT 'draft',
  imported_at TIMESTAMPTZ,
  imported_by UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.apf_project_baselines IS
  'Baseline APF versionada por projeto. Cada versão é imutável após ativação.';

CREATE INDEX IF NOT EXISTS idx_apf_baselines_project_id ON public.apf_project_baselines(project_id);
CREATE INDEX IF NOT EXISTS idx_apf_baselines_status     ON public.apf_project_baselines(status);

-- ============================================================
-- BLOCO 13: APF — apf_baseline_items
-- Cada EF homologada no baseline
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apf_baseline_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baseline_id     UUID NOT NULL REFERENCES public.apf_project_baselines(id) ON DELETE CASCADE,
  item_ref        TEXT NOT NULL,         -- referência na planilha: HU049.1, Processo Bancário...
  description     TEXT NOT NULL,         -- descrição da EF
  module          TEXT,                  -- módulo/subprocesso: PROC AUTORIZATIVO, PROC BANCÁRIOS...
  function_sigla  TEXT NOT NULL,         -- TRN, ARQ (referencia apf_function_types.sigla)
  category_sigla  TEXT,                  -- ARN, ADS, ATD, AGR, NM
  complexity      TEXT NOT NULL DEFAULT 'Padrão',
  pf_bruto        NUMERIC(8,2),          -- peso já calculado do tipo
  notes           TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.apf_baseline_items IS
  'Cada EF homologada no baseline. Âncora principal da contagem — HU é apenas gatilho.';

CREATE INDEX IF NOT EXISTS idx_apf_baseline_items_baseline_id   ON public.apf_baseline_items(baseline_id);
CREATE INDEX IF NOT EXISTS idx_apf_baseline_items_function_sigla ON public.apf_baseline_items(function_sigla);

-- ============================================================
-- BLOCO 14: APF — apf_counting_sessions
-- Uma sessão de contagem por sprint/OS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apf_counting_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  baseline_id     UUID REFERENCES public.apf_project_baselines(id) ON DELETE SET NULL,
  model_id        UUID NOT NULL REFERENCES public.apf_counting_models(id) ON DELETE RESTRICT,
  -- Identificação
  sprint_ref      TEXT,                  -- Sprint 01, OS #25044...
  release_ref     TEXT,                  -- Release 05...
  redmine_ref     TEXT,                  -- nº do REDMINE
  -- Status
  status          apf_session_status NOT NULL DEFAULT 'in_progress',
  -- Totais calculados
  total_pf_bruto  NUMERIC(10,2) DEFAULT 0,
  total_pf_fs     NUMERIC(10,2) DEFAULT 0,
  total_functions INT DEFAULT 0,
  total_hus       INT DEFAULT 0,
  -- Auditoria
  analyst_id      UUID REFERENCES auth.users(id),
  reviewer_id     UUID REFERENCES auth.users(id),
  validated_at    TIMESTAMPTZ,
  -- Documento gerado
  evidence_doc    TEXT,                  -- markdown do documento de evidência gerado
  ai_model_used   TEXT,                  -- qual provider/modelo de IA foi usado
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.apf_counting_sessions IS
  'Sessão de contagem APF por sprint. Contém os totais e o documento de evidência gerado.';

CREATE INDEX IF NOT EXISTS idx_apf_sessions_project_id  ON public.apf_counting_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_apf_sessions_status      ON public.apf_counting_sessions(status);

-- ============================================================
-- BLOCO 15: APF — apf_counting_items
-- Cada EF contada em uma sessão (resultado da IA + validação humana)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apf_counting_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID NOT NULL REFERENCES public.apf_counting_sessions(id) ON DELETE CASCADE,
  baseline_item_id      UUID REFERENCES public.apf_baseline_items(id) ON DELETE SET NULL,
  -- HU relacionada
  hu_ref                TEXT,              -- HU049.1, HU200...
  -- Classificação pela IA
  ef_description        TEXT NOT NULL,
  function_sigla        TEXT NOT NULL,     -- TRN, ARQ
  factor_sigla          TEXT NOT NULL,     -- I, A, A75, COR50...
  category_sigla        TEXT,             -- ARN, ADS, ATD, AGR, NM
  complexity            TEXT DEFAULT 'Padrão',
  -- Valores calculados
  pf_bruto              NUMERIC(8,2) NOT NULL DEFAULT 0,
  contribution_pct      NUMERIC(6,2) NOT NULL DEFAULT 100,
  pf_fs                 NUMERIC(8,2) NOT NULL DEFAULT 0,
  -- Justificativa e precedente
  justification         TEXT,
  evidence_literal      TEXT,
  precedent_ref         TEXT,              -- referência ao precedente usado
  -- Validação humana
  is_validated          BOOLEAN NOT NULL DEFAULT false,
  validated_by          UUID REFERENCES auth.users(id),
  validated_at          TIMESTAMPTZ,
  analyst_note          TEXT,
  -- Correção humana (para fechar o ciclo de aprendizado)
  corrected_function_sigla  TEXT,
  corrected_factor_sigla    TEXT,
  corrected_pf_bruto        NUMERIC(8,2),
  corrected_pf_fs           NUMERIC(8,2),
  sort_order            INT DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.apf_counting_items IS
  'Cada EF contada numa sessão. Campos corrected_* fecham o ciclo de aprendizado da IA.';

CREATE INDEX IF NOT EXISTS idx_apf_items_session_id       ON public.apf_counting_items(session_id);
CREATE INDEX IF NOT EXISTS idx_apf_items_is_validated     ON public.apf_counting_items(is_validated);
CREATE INDEX IF NOT EXISTS idx_apf_items_baseline_item_id ON public.apf_counting_items(baseline_item_id);

-- ============================================================
-- BLOCO 16: APF — apf_gray_zones
-- Zonas cinzentas registradas pela IA durante a contagem
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apf_gray_zones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES public.apf_counting_sessions(id) ON DELETE CASCADE,
  counting_item_id UUID REFERENCES public.apf_counting_items(id) ON DELETE SET NULL,
  hu_ref          TEXT,
  scenario        TEXT NOT NULL,            -- descrição do cenário ambíguo
  interpretation_a TEXT NOT NULL,           -- interpretação A
  interpretation_b TEXT NOT NULL,           -- interpretação B
  pf_difference   NUMERIC(8,2),            -- diferença de PF entre A e B
  decision        TEXT,                    -- decisão adotada
  confidence_level TEXT,                   -- alto, médio, baixo
  applicable_precedent TEXT,              -- precedente aplicado
  resolved        BOOLEAN NOT NULL DEFAULT false,
  resolved_by     UUID REFERENCES auth.users(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.apf_gray_zones IS
  'Zonas cinzentas registradas pela IA. Base para aprendizado e consistência de decisões.';

CREATE INDEX IF NOT EXISTS idx_apf_gray_zones_session_id ON public.apf_gray_zones(session_id);

-- ============================================================
-- BLOCO 17: TRIGGERS — updated_at automático
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_apf_models_updated_at
    BEFORE UPDATE ON public.apf_counting_models
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_apf_baselines_updated_at
    BEFORE UPDATE ON public.apf_project_baselines
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_apf_sessions_updated_at
    BEFORE UPDATE ON public.apf_counting_sessions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- BLOCO 18: RLS — Row Level Security por organização
-- ============================================================

ALTER TABLE public.organizations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apf_counting_models     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apf_function_types      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apf_impact_factors      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apf_categories          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apf_counting_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apf_output_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apf_project_baselines   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apf_baseline_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apf_counting_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apf_counting_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apf_gray_zones          ENABLE ROW LEVEL SECURITY;

-- Função helper: retorna org_ids do usuário logado
CREATE OR REPLACE FUNCTION public.my_org_ids()
RETURNS UUID[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ARRAY(
    SELECT org_id FROM public.organization_members
    WHERE user_id = auth.uid()
  );
$$;

-- organizations: membro vê sua própria org
DROP POLICY IF EXISTS org_select ON public.organizations;
CREATE POLICY org_select ON public.organizations
  FOR SELECT USING (id = ANY(public.my_org_ids()));

DROP POLICY IF EXISTS org_insert ON public.organizations;
CREATE POLICY org_insert ON public.organizations
  FOR INSERT WITH CHECK (true);  -- service_role apenas em prod

DROP POLICY IF EXISTS org_update ON public.organizations;
CREATE POLICY org_update ON public.organizations
  FOR UPDATE USING (
    id IN (
      SELECT org_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- organization_members: ver membros da própria org
DROP POLICY IF EXISTS org_members_select ON public.organization_members;
CREATE POLICY org_members_select ON public.organization_members
  FOR SELECT USING (org_id = ANY(public.my_org_ids()));

-- apf_counting_models: acesso via contrato vinculado à org
DROP POLICY IF EXISTS apf_models_select ON public.apf_counting_models;
CREATE POLICY apf_models_select ON public.apf_counting_models
  FOR SELECT USING (
    contract_id IN (
      SELECT id FROM public.contracts
      WHERE org_id = ANY(public.my_org_ids())
         OR org_id IS NULL  -- contratos legados sempre visíveis
    )
  );

DROP POLICY IF EXISTS apf_models_all ON public.apf_counting_models;
CREATE POLICY apf_models_all ON public.apf_counting_models
  FOR ALL USING (
    contract_id IN (
      SELECT id FROM public.contracts
      WHERE org_id = ANY(public.my_org_ids())
         OR org_id IS NULL
    )
  );

-- apf_function_types: via model
DROP POLICY IF EXISTS apf_func_types_all ON public.apf_function_types;
CREATE POLICY apf_func_types_all ON public.apf_function_types
  FOR ALL USING (
    model_id IN (SELECT id FROM public.apf_counting_models)
  );

-- apf_impact_factors: via model
DROP POLICY IF EXISTS apf_factors_all ON public.apf_impact_factors;
CREATE POLICY apf_factors_all ON public.apf_impact_factors
  FOR ALL USING (
    model_id IN (SELECT id FROM public.apf_counting_models)
  );

-- apf_categories: via model
DROP POLICY IF EXISTS apf_categories_all ON public.apf_categories;
CREATE POLICY apf_categories_all ON public.apf_categories
  FOR ALL USING (
    model_id IN (SELECT id FROM public.apf_counting_models)
  );

-- apf_counting_rules: via model
DROP POLICY IF EXISTS apf_rules_all ON public.apf_counting_rules;
CREATE POLICY apf_rules_all ON public.apf_counting_rules
  FOR ALL USING (
    model_id IN (SELECT id FROM public.apf_counting_models)
  );

-- apf_output_templates: via model
DROP POLICY IF EXISTS apf_templates_all ON public.apf_output_templates;
CREATE POLICY apf_templates_all ON public.apf_output_templates
  FOR ALL USING (
    model_id IN (SELECT id FROM public.apf_counting_models)
  );

-- apf_project_baselines: via projeto
DROP POLICY IF EXISTS apf_baselines_all ON public.apf_project_baselines;
CREATE POLICY apf_baselines_all ON public.apf_project_baselines
  FOR ALL USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE contract_id IN (
        SELECT id FROM public.contracts
        WHERE org_id = ANY(public.my_org_ids()) OR org_id IS NULL
      )
    )
  );

-- apf_baseline_items: via baseline
DROP POLICY IF EXISTS apf_baseline_items_all ON public.apf_baseline_items;
CREATE POLICY apf_baseline_items_all ON public.apf_baseline_items
  FOR ALL USING (
    baseline_id IN (SELECT id FROM public.apf_project_baselines)
  );

-- apf_counting_sessions: via projeto
DROP POLICY IF EXISTS apf_sessions_all ON public.apf_counting_sessions;
CREATE POLICY apf_sessions_all ON public.apf_counting_sessions
  FOR ALL USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE contract_id IN (
        SELECT id FROM public.contracts
        WHERE org_id = ANY(public.my_org_ids()) OR org_id IS NULL
      )
    )
  );

-- apf_counting_items: via sessão
DROP POLICY IF EXISTS apf_items_all ON public.apf_counting_items;
CREATE POLICY apf_items_all ON public.apf_counting_items
  FOR ALL USING (
    session_id IN (SELECT id FROM public.apf_counting_sessions)
  );

-- apf_gray_zones: via sessão
DROP POLICY IF EXISTS apf_gray_zones_all ON public.apf_gray_zones;
CREATE POLICY apf_gray_zones_all ON public.apf_gray_zones
  FOR ALL USING (
    session_id IN (SELECT id FROM public.apf_counting_sessions)
  );
