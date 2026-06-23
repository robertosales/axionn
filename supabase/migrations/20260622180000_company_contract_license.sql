-- =============================================================================
-- MIGRATION: company_contract_license
-- Data: 2026-06-22
-- Descrição: Cadastro de empresa (tenant), campos APF em contratos e licença
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABELA: companies
-- Cada empresa cliente é um tenant. Teams e contratos pertencem a uma empresa.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  cnpj         TEXT        UNIQUE,
  email        TEXT,
  phone        TEXT,
  logo_url     TEXT,
  status       TEXT        NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active', 'trial', 'suspended', 'inactive')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.companies             IS 'Empresas clientes da plataforma Axionn (tenants)';
COMMENT ON COLUMN public.companies.cnpj        IS 'CNPJ único da empresa (sem formatação)';
COMMENT ON COLUMN public.companies.status      IS 'active | trial | suspended | inactive';

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_companies_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_updated_at ON public.companies;
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_companies_updated_at();

-- -----------------------------------------------------------------------------
-- 2. VINCULAR TEAMS À EMPRESA
-- -----------------------------------------------------------------------------
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_teams_company_id ON public.teams(company_id);

COMMENT ON COLUMN public.teams.company_id IS 'Empresa à qual este time pertence';

-- -----------------------------------------------------------------------------
-- 3. CAMPOS APF NO CONTRATO EXISTENTE
-- Adiciona número do contrato, objeto, valor por PF e vínculo com empresa
-- -----------------------------------------------------------------------------
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS company_id      UUID        REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS number          TEXT,
  ADD COLUMN IF NOT EXISTS object          TEXT,
  ADD COLUMN IF NOT EXISTS value_per_pfus  NUMERIC(12,4),
  ADD COLUMN IF NOT EXISTS currency        TEXT        NOT NULL DEFAULT 'BRL';

CREATE INDEX IF NOT EXISTS idx_contracts_company_id ON public.contracts(company_id);

COMMENT ON COLUMN public.contracts.company_id     IS 'Empresa contratante vinculada';
COMMENT ON COLUMN public.contracts.number         IS 'Número do contrato (ex: GESP-3-25044)';
COMMENT ON COLUMN public.contracts.object         IS 'Objeto / escopo do contrato';
COMMENT ON COLUMN public.contracts.value_per_pfus IS 'Valor em moeda por Ponto de Função (PF)';
COMMENT ON COLUMN public.contracts.currency       IS 'Código da moeda ISO 4217 (BRL, USD, EUR)';

-- -----------------------------------------------------------------------------
-- 4. VINCULAR RELEASES AO CONTRATO
-- Cada release de desenvolvimento pode ser rastreada a um contrato
-- -----------------------------------------------------------------------------
ALTER TABLE public.releases
  ADD COLUMN IF NOT EXISTS contract_id UUID REFERENCES public.contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_releases_contract_id ON public.releases(contract_id);

COMMENT ON COLUMN public.releases.contract_id IS 'Contrato ao qual esta release pertence para medição APF';

-- -----------------------------------------------------------------------------
-- 5. TABELA: licenses
-- Controla o plano, cota de uso de IA/PF e validade por empresa
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.licenses (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID        NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  plan             TEXT        NOT NULL DEFAULT 'starter'
                               CHECK (plan IN ('starter', 'pro', 'enterprise')),
  pf_quota_month   INTEGER,    -- NULL = ilimitado
  pf_used_month    INTEGER     NOT NULL DEFAULT 0,
  ai_calls_quota   INTEGER,    -- NULL = ilimitado
  ai_calls_used    INTEGER     NOT NULL DEFAULT 0,
  quota_reset_at   DATE        NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month')::date,
  valid_until      DATE        NOT NULL DEFAULT (now() + interval '30 days')::date,
  status           TEXT        NOT NULL DEFAULT 'active'
                               CHECK (status IN ('active', 'trial', 'expired', 'suspended')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.licenses                  IS 'Licença SaaS por empresa: plano, cotas de uso e validade';
COMMENT ON COLUMN public.licenses.plan             IS 'starter | pro | enterprise';
COMMENT ON COLUMN public.licenses.pf_quota_month  IS 'Cota mensal de PF calculados (NULL = ilimitado)';
COMMENT ON COLUMN public.licenses.ai_calls_quota  IS 'Cota mensal de chamadas à IA (NULL = ilimitado)';
COMMENT ON COLUMN public.licenses.quota_reset_at  IS 'Data do próximo reset mensal dos contadores';
COMMENT ON COLUMN public.licenses.valid_until      IS 'Data de vencimento da licença';

-- Trigger: atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_licenses_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_licenses_updated_at ON public.licenses;
CREATE TRIGGER trg_licenses_updated_at
  BEFORE UPDATE ON public.licenses
  FOR EACH ROW EXECUTE FUNCTION public.set_licenses_updated_at();

-- -----------------------------------------------------------------------------
-- 6. RPC: check_license_quota
-- Verifica se o team ainda tem cota disponível antes de chamar a IA
-- Retorna: { allowed: bool, pf_remaining: int | null, ai_remaining: int | null }
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_license_quota(p_team_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_company_id UUID;
  v_license    public.licenses%ROWTYPE;
  v_allowed    BOOLEAN := true;
  v_pf_rem     INTEGER;
  v_ai_rem     INTEGER;
BEGIN
  -- Busca empresa do team
  SELECT company_id INTO v_company_id
    FROM public.teams WHERE id = p_team_id;

  IF v_company_id IS NULL THEN
    -- Time sem empresa vinculada: libera sem restrição
    RETURN jsonb_build_object('allowed', true, 'pf_remaining', null, 'ai_remaining', null);
  END IF;

  -- Busca licença da empresa
  SELECT * INTO v_license
    FROM public.licenses WHERE company_id = v_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', true, 'pf_remaining', null, 'ai_remaining', null);
  END IF;

  -- Verifica validade
  IF v_license.status IN ('expired', 'suspended') THEN
    RETURN jsonb_build_object('allowed', false, 'pf_remaining', 0, 'ai_remaining', 0,
                              'reason', 'Licença ' || v_license.status);
  END IF;

  IF v_license.valid_until < CURRENT_DATE THEN
    -- Atualiza status automaticamente
    UPDATE public.licenses SET status = 'expired' WHERE id = v_license.id;
    RETURN jsonb_build_object('allowed', false, 'pf_remaining', 0, 'ai_remaining', 0,
                              'reason', 'Licença vencida em ' || v_license.valid_until);
  END IF;

  -- Reset mensal automático
  IF v_license.quota_reset_at <= CURRENT_DATE THEN
    UPDATE public.licenses
       SET pf_used_month  = 0,
           ai_calls_used  = 0,
           quota_reset_at = (date_trunc('month', now()) + interval '1 month')::date
     WHERE id = v_license.id;
    v_license.pf_used_month := 0;
    v_license.ai_calls_used := 0;
  END IF;

  -- Verifica cota de chamadas IA
  IF v_license.ai_calls_quota IS NOT NULL THEN
    v_ai_rem := v_license.ai_calls_quota - v_license.ai_calls_used;
    IF v_ai_rem <= 0 THEN
      v_allowed := false;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'allowed',       v_allowed,
    'pf_remaining',  CASE WHEN v_license.pf_quota_month IS NULL THEN NULL
                          ELSE (v_license.pf_quota_month - v_license.pf_used_month) END,
    'ai_remaining',  CASE WHEN v_license.ai_calls_quota IS NULL THEN NULL
                          ELSE v_ai_rem END
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. RPC: increment_license_usage
-- Incrementa os contadores após uma contagem APF validada
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_license_usage(
  p_team_id    UUID,
  p_pf_count   INTEGER DEFAULT 0,
  p_ai_calls   INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_company_id UUID;
BEGIN
  SELECT company_id INTO v_company_id
    FROM public.teams WHERE id = p_team_id;

  IF v_company_id IS NULL THEN RETURN; END IF;

  UPDATE public.licenses
     SET pf_used_month = pf_used_month + p_pf_count,
         ai_calls_used = ai_calls_used + p_ai_calls,
         updated_at    = now()
   WHERE company_id = v_company_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. RLS — Row Level Security
-- Padrão do projeto: usar public.is_admin() ao invés de coluna is_admin
-- -----------------------------------------------------------------------------
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licenses  ENABLE ROW LEVEL SECURITY;

-- Admin vê e gerencia tudo
CREATE POLICY "companies_admin_all" ON public.companies
  FOR ALL TO authenticated
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "licenses_admin_all" ON public.licenses
  FOR ALL TO authenticated
  USING      (public.is_admin())
  WITH CHECK (public.is_admin());

-- Usuário comum: leitura apenas da empresa do seu time
CREATE POLICY "companies_member_select" ON public.companies
  FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT t.company_id
        FROM public.teams t
       INNER JOIN public.team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = auth.uid()
         AND t.company_id IS NOT NULL
    )
  );

-- Usuário comum: leitura apenas da licença da sua empresa
CREATE POLICY "licenses_member_select" ON public.licenses
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT t.company_id
        FROM public.teams t
       INNER JOIN public.team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = auth.uid()
         AND t.company_id IS NOT NULL
    )
  );

-- -----------------------------------------------------------------------------
-- 9. ÍNDICES DE PERFORMANCE
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_cnpj   ON public.companies(cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_licenses_company ON public.licenses(company_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status  ON public.licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_reset   ON public.licenses(quota_reset_at);
