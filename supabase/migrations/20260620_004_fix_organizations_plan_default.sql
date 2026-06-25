-- ============================================================
-- FIX: organizations — autossuficiente (ENUMs + tabela + RLS)
-- Usa EXECUTE dinâmico para evitar erro de parse quando
-- os ENUMs ainda não existem no banco.
-- ============================================================

DO $outer$
BEGIN

  -- 1. ENUMs (idempotente)
  BEGIN
    CREATE TYPE public.org_plan AS ENUM ('free', 'pro', 'enterprise');
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    CREATE TYPE public.org_status AS ENUM ('active', 'trial', 'suspended', 'cancelled');
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    CREATE TYPE public.org_member_role AS ENUM ('owner', 'admin', 'member');
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  -- 2. organization_members (tabela base, sem FK para organizations ainda)
  EXECUTE $sql$
    CREATE TABLE IF NOT EXISTS public.organization_members (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id     UUID NOT NULL,
      user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      role       public.org_member_role NOT NULL DEFAULT 'member',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (org_id, user_id)
    )
  $sql$;

  -- 3. Função helper RLS
  EXECUTE $sql$
    CREATE OR REPLACE FUNCTION public.my_org_ids()
    RETURNS UUID[] LANGUAGE sql STABLE SECURITY DEFINER AS $$
      SELECT ARRAY(
        SELECT org_id FROM public.organization_members
        WHERE user_id = auth.uid()
      );
    $$
  $sql$;

  -- 4. Drop + recria organizations com ENUMs corretos
  EXECUTE 'DROP TABLE IF EXISTS public.organizations CASCADE';

  EXECUTE $sql$
    CREATE TABLE public.organizations (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name          TEXT NOT NULL,
      slug          TEXT NOT NULL UNIQUE,
      plan          public.org_plan   NOT NULL DEFAULT 'free',
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
    )
  $sql$;

  EXECUTE $sql$
    COMMENT ON TABLE public.organizations IS
      'Empresas/tenants licenciados na plataforma Axionn SaaS.'
  $sql$;

  -- 5. RLS
  EXECUTE 'ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY';

  EXECUTE 'DROP POLICY IF EXISTS org_select ON public.organizations';
  EXECUTE $sql$
    CREATE POLICY org_select ON public.organizations
      FOR SELECT USING (id = ANY(public.my_org_ids()))
  $sql$;

  EXECUTE 'DROP POLICY IF EXISTS org_insert ON public.organizations';
  EXECUTE $sql$
    CREATE POLICY org_insert ON public.organizations
      FOR INSERT WITH CHECK (true)
  $sql$;

  EXECUTE 'DROP POLICY IF EXISTS org_update ON public.organizations';
  EXECUTE $sql$
    CREATE POLICY org_update ON public.organizations
      FOR UPDATE USING (
        id IN (
          SELECT org_id FROM public.organization_members
          WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin')
        )
      )
  $sql$;

  -- 6. Trigger updated_at (função set_updated_at já existe no banco)
  BEGIN
    EXECUTE $sql$
      CREATE TRIGGER trg_organizations_updated_at
        BEFORE UPDATE ON public.organizations
        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()
    $sql$;
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  -- 7. FK: organization_members -> organizations
  EXECUTE 'ALTER TABLE public.organization_members
    DROP CONSTRAINT IF EXISTS organization_members_org_id_fkey';
  EXECUTE 'ALTER TABLE public.organization_members
    ADD CONSTRAINT organization_members_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE';

  -- 8. FK: contracts -> organizations (somente se contracts existir)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contracts'
  ) THEN
    EXECUTE 'ALTER TABLE public.contracts
      DROP CONSTRAINT IF EXISTS contracts_org_id_fkey';
    EXECUTE 'ALTER TABLE public.contracts
      ADD COLUMN IF NOT EXISTS org_id UUID';
    EXECUTE 'ALTER TABLE public.contracts
      ADD CONSTRAINT contracts_org_id_fkey
      FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE SET NULL';
  END IF;

END;
$outer$;
