-- ============================================================
-- FIX: organizations.plan DEFAULT incorreto
-- Erro 1: invalid input value for enum org_plan: "trial"
-- Erro 2: type "org_plan" does not exist (se rodado sem o 001)
--
-- Este arquivo é AUTOSSUFICIENTE:
--   1. Garante os ENUMs (cria se ainda não existirem)
--   2. Dropa e recria a tabela organizations com defaults corretos
--   3. Re-aplica RLS, trigger e FKs dependentes
-- ============================================================

-- ── 1. ENUMs (idempotente) ────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.org_plan AS ENUM ('free', 'pro', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.org_status AS ENUM ('active', 'trial', 'suspended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.org_member_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. Garante tabela organization_members (FK target) ────────
CREATE TABLE IF NOT EXISTS public.organization_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.org_member_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- ── 3. Garante função helper (pode já existir do 001) ─────────
CREATE OR REPLACE FUNCTION public.my_org_ids()
RETURNS UUID[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT ARRAY(
    SELECT org_id FROM public.organization_members
    WHERE user_id = auth.uid()
  );
$$;

-- ── 4. Recria organizations com defaults corretos ─────────────
DROP TABLE IF EXISTS public.organizations CASCADE;

CREATE TABLE public.organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  -- org_plan  → free | pro | enterprise   (DEFAULT 'free' ✓)
  plan          public.org_plan   NOT NULL DEFAULT 'free',
  -- org_status → active | trial | ...    (DEFAULT 'trial' ✓)
  status        public.org_status NOT NULL DEFAULT 'trial',
  logo_url      TEXT,
  max_projects            INT NOT NULL DEFAULT 3,
  max_users               INT NOT NULL DEFAULT 5,
  max_countings_per_month INT NOT NULL DEFAULT 20,
  contact_email TEXT,
  contact_name  TEXT,
  trial_ends_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organizations IS
  'Empresas/tenants licenciados na plataforma Axionn SaaS.';

-- ── 5. RLS ────────────────────────────────────────────────────
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
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- ── 6. Trigger updated_at ─────────────────────────────────────
DO $$ BEGIN
  CREATE TRIGGER trg_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 7. FK: organization_members → organizations ───────────────
ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_org_id_fkey;

ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_org_id_fkey
  FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ── 8. FK: contracts → organizations (se existir) ────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contracts'
  ) THEN
    ALTER TABLE public.contracts
      DROP CONSTRAINT IF EXISTS contracts_org_id_fkey;

    ALTER TABLE public.contracts
      ADD COLUMN IF NOT EXISTS org_id UUID;

    ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;
END $$;
