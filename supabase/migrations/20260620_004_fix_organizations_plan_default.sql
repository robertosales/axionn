-- ============================================================
-- FIX: organizations.plan DEFAULT incorreto
-- Erro: invalid input value for enum org_plan: "trial"
-- Causa: plan e status usam ENUMs diferentes:
--   org_plan   → free | pro | enterprise
--   org_status → active | trial | suspended | cancelled
-- O DEFAULT 'trial' foi aplicado em plan (errado).
-- Este fix recria a tabela com os defaults corretos.
-- ============================================================

-- A tabela ainda não tem dados (foi criada nesta branch).
-- Estratégia segura: DROP + CREATE com defaults corretos.

DROP TABLE IF EXISTS public.organizations CASCADE;

CREATE TABLE public.organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  -- plan usa org_plan  → DEFAULT 'free'   ✓
  plan          org_plan   NOT NULL DEFAULT 'free',
  -- status usa org_status → DEFAULT 'trial' ✓
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

-- RLS (igual ao arquivo 001, re-aplica após DROP/CREATE)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_select ON public.organizations;
CREATE POLICY org_select ON public.organizations
  FOR SELECT USING (id = ANY(public.my_org_ids()));

DROP POLICY IF EXISTS org_insert ON public.organizations;
CREATE POLICY org_insert ON public.organizations
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS org_update ON public.organizations;
CREATE POLICY org_update ON public.organizations
  FOR UPDATE USING (
    id IN (
      SELECT org_id FROM public.organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Trigger updated_at
DO $$ BEGIN
  CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Re-cria FK em organization_members (pode ter sido dropada pelo CASCADE)
ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_org_id_fkey;

ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Re-cria FK em contracts (pode ter sido dropada pelo CASCADE)
ALTER TABLE public.contracts
  DROP CONSTRAINT IF EXISTS contracts_org_id_fkey;

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS org_id UUID;

ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
