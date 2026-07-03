-- One-off production operation: install org resource isolation infrastructure.
-- Run manually in Lovable Cloud SQL Editor after Operation 2 validation.
-- This installs policies, triggers, settings and tenant-aware RPCs, but keeps
-- tenancy enforcement disabled. Do not call set_tenancy_enforcement(true).

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('axionn:20260703:03_org_resource_isolation'));

DO $$
DECLARE
  v_missing text;
  v_enforced boolean := false;
BEGIN
  SELECT string_agg(object_name, ', ' ORDER BY object_name)
    INTO v_missing
  FROM (
    VALUES
      ('table public.companies', to_regclass('public.companies') IS NOT NULL),
      ('table public.contract_room_teams', to_regclass('public.contract_room_teams') IS NOT NULL),
      ('table public.contract_slas', to_regclass('public.contract_slas') IS NOT NULL),
      ('table public.contract_teams', to_regclass('public.contract_teams') IS NOT NULL),
      ('table public.contracts', to_regclass('public.contracts') IS NOT NULL),
      ('table public.organizations', to_regclass('public.organizations') IS NOT NULL),
      ('table public.projects', to_regclass('public.projects') IS NOT NULL),
      ('table public.teams', to_regclass('public.teams') IS NOT NULL),
      ('function auth.role()', to_regprocedure('auth.role()') IS NOT NULL),
      ('function auth.uid()', to_regprocedure('auth.uid()') IS NOT NULL),
      ('function public.is_platform_admin(uuid)', to_regprocedure('public.is_platform_admin(uuid)') IS NOT NULL),
      ('function public.is_organization_member(uuid,uuid)', to_regprocedure('public.is_organization_member(uuid,uuid)') IS NOT NULL),
      ('function public.resolve_team_org_id(uuid)', to_regprocedure('public.resolve_team_org_id(uuid)') IS NOT NULL),
      ('function public.resolve_project_org_id(uuid)', to_regprocedure('public.resolve_project_org_id(uuid)') IS NOT NULL)
  ) AS required(object_name, present)
  WHERE NOT present;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required dependencies before Operation 3 writes: %', v_missing;
  END IF;

  SELECT string_agg(table_name || '.' || column_name, ', ' ORDER BY table_name, column_name)
    INTO v_missing
  FROM (
    VALUES
      ('companies', 'cnpj'),
      ('companies', 'created_at'),
      ('companies', 'email'),
      ('companies', 'id'),
      ('companies', 'logo_url'),
      ('companies', 'name'),
      ('companies', 'org_id'),
      ('companies', 'phone'),
      ('companies', 'status'),
      ('contract_room_teams', 'contract_id'),
      ('contract_room_teams', 'project_id'),
      ('contract_room_teams', 'team_id'),
      ('contract_slas', 'contract_id'),
      ('contract_slas', 'id'),
      ('contract_teams', 'contract_id'),
      ('contract_teams', 'team_id'),
      ('contracts', 'company_id'),
      ('contracts', 'currency'),
      ('contracts', 'description'),
      ('contracts', 'ends_at'),
      ('contracts', 'id'),
      ('contracts', 'name'),
      ('contracts', 'number'),
      ('contracts', 'object'),
      ('contracts', 'org_id'),
      ('contracts', 'room_mode'),
      ('contracts', 'starts_at'),
      ('contracts', 'status'),
      ('contracts', 'value_per_pfus'),
      ('organizations', 'id'),
      ('organizations', 'status'),
      ('projects', 'code'),
      ('projects', 'contract_id'),
      ('projects', 'created_at'),
      ('projects', 'description'),
      ('projects', 'id'),
      ('projects', 'legacy_projetos_id'),
      ('projects', 'module_type'),
      ('projects', 'name'),
      ('projects', 'org_id'),
      ('projects', 'redmine_id'),
      ('projects', 'sla_id'),
      ('projects', 'status'),
      ('projects', 'team_id'),
      ('projects', 'updated_at'),
      ('teams', 'company_id'),
      ('teams', 'contract_id'),
      ('teams', 'id'),
      ('teams', 'org_id')
  ) AS required(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns column_info
    WHERE column_info.table_schema = 'public'
      AND column_info.table_name = required.table_name
      AND column_info.column_name = required.column_name
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required columns before Operation 3 writes: %', v_missing;
  END IF;

  IF to_regprocedure('public.is_tenancy_enforced()') IS NOT NULL THEN
    EXECUTE 'SELECT public.is_tenancy_enforced()' INTO v_enforced;
  ELSIF to_regclass('public.saas_runtime_settings') IS NOT NULL THEN
    EXECUTE $sql$
      SELECT coalesce((
        SELECT lower(value ->> 'enabled') = 'true'
        FROM public.saas_runtime_settings
        WHERE key = 'tenancy_enforcement'
      ), false)
    $sql$ INTO v_enforced;
  END IF;

  IF coalesce(v_enforced, false) THEN
    RAISE EXCEPTION 'Tenancy enforcement is already enabled; aborting Operation 3.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.companies WHERE org_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.contracts WHERE org_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.teams WHERE org_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.projects WHERE org_id IS NULL) THEN
    RAISE EXCEPTION 'Core resources still have null org_id; run readiness cleanup before Operation 3.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.contracts contract
    JOIN public.companies company ON company.id = contract.company_id
    WHERE contract.org_id IS NOT NULL
      AND company.org_id IS NOT NULL
      AND contract.org_id <> company.org_id
  ) THEN
    RAISE EXCEPTION 'Contract/company organization mismatch exists before Operation 3.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.contract_teams relation
    JOIN public.contracts contract ON contract.id = relation.contract_id
    JOIN public.teams team ON team.id = relation.team_id
    WHERE contract.org_id IS NOT NULL
      AND team.org_id IS NOT NULL
      AND contract.org_id <> team.org_id
  ) THEN
    RAISE EXCEPTION 'Contract/team organization mismatch exists before Operation 3.';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.saas_runtime_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.saas_runtime_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.saas_runtime_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_runtime_settings TO service_role;

INSERT INTO public.saas_runtime_settings (key, value)
VALUES ('tenancy_enforcement', jsonb_build_object('enabled', false))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_tenancy_enforced()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    (
      SELECT lower(setting.value ->> 'enabled') = 'true'
      FROM public.saas_runtime_settings setting
      WHERE setting.key = 'tenancy_enforcement'
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.set_tenancy_enforcement(p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.saas_runtime_settings (key, value, updated_at, updated_by)
  VALUES (
    'tenancy_enforcement',
    jsonb_build_object('enabled', p_enabled),
    now(),
    auth.uid()
  )
  ON CONFLICT (key) DO UPDATE
    SET value = excluded.value,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_read_organization(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_org_id IS NOT NULL
    AND public.is_organization_member(p_org_id);
$$;

CREATE OR REPLACE FUNCTION public.can_operate_organization(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_org_id IS NOT NULL
    AND (
      public.is_platform_admin()
      OR (
        public.is_organization_member(p_org_id)
        AND EXISTS (
          SELECT 1
          FROM public.organizations organization
          WHERE organization.id = p_org_id
            AND organization.status IN ('active', 'trial')
        )
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.get_accessible_companies_v2(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  cnpj text,
  email text,
  phone text,
  logo_url text,
  status text,
  created_at timestamptz,
  org_id uuid,
  team_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    company.id,
    company.name,
    company.cnpj,
    company.email,
    company.phone,
    company.logo_url,
    company.status::text,
    company.created_at,
    company.org_id,
    count(DISTINCT team.id) AS team_count
  FROM public.companies company
  LEFT JOIN public.teams team
    ON team.company_id = company.id
   AND team.org_id = p_org_id
  WHERE company.org_id = p_org_id
    AND public.can_read_organization(p_org_id)
  GROUP BY company.id
  ORDER BY company.name;
$$;

CREATE OR REPLACE FUNCTION public.get_accessible_contracts_v2(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  status text,
  starts_at date,
  ends_at date,
  company_id uuid,
  number text,
  object text,
  value_per_pfus numeric,
  currency text,
  room_mode text,
  description text,
  org_id uuid,
  project_count bigint,
  sla_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    contract.id,
    contract.name,
    contract.status::text,
    contract.starts_at,
    contract.ends_at,
    contract.company_id,
    contract.number,
    contract.object,
    contract.value_per_pfus,
    contract.currency,
    contract.room_mode::text,
    contract.description,
    contract.org_id,
    count(DISTINCT project.id) AS project_count,
    count(DISTINCT sla.id) AS sla_count
  FROM public.contracts contract
  LEFT JOIN public.projects project ON project.contract_id = contract.id
  LEFT JOIN public.contract_slas sla ON sla.contract_id = contract.id
  WHERE contract.org_id = p_org_id
    AND public.can_read_organization(p_org_id)
  GROUP BY contract.id
  ORDER BY contract.name;
$$;

CREATE OR REPLACE FUNCTION public.get_accessible_projects_v2(
  p_org_id uuid,
  p_contract_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  code text,
  status text,
  module_type text,
  contract_id uuid,
  team_id uuid,
  redmine_id bigint,
  legacy_projetos_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  sla_id uuid,
  org_id uuid,
  contract_name text,
  team_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    project.id,
    project.name,
    project.description,
    project.code,
    project.status::text,
    project.module_type::text,
    project.contract_id,
    project.team_id,
    project.redmine_id,
    project.legacy_projetos_id,
    project.created_at,
    project.updated_at,
    project.sla_id,
    project.org_id,
    contract.name AS contract_name,
    team.name AS team_name
  FROM public.projects project
  LEFT JOIN public.contracts contract ON contract.id = project.contract_id
  LEFT JOIN public.teams team ON team.id = project.team_id
  WHERE project.org_id = p_org_id
    AND project.status <> 'archived'
    AND (p_contract_id IS NULL OR project.contract_id = p_contract_id)
    AND public.can_read_organization(p_org_id)
  ORDER BY project.name;
$$;

CREATE OR REPLACE FUNCTION public.enforce_company_org_boundary()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_tenancy_enforced()
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    IF NEW.org_id IS NULL THEN
      RAISE EXCEPTION 'organization_required';
    END IF;
    IF NOT public.can_operate_organization(NEW.org_id) THEN
      RAISE EXCEPTION 'organization_not_operational';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_contract_org_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  linked_org_id uuid;
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    SELECT company.org_id
      INTO linked_org_id
      FROM public.companies company
     WHERE company.id = NEW.company_id;
  END IF;

  IF NEW.org_id IS NULL THEN
    NEW.org_id := linked_org_id;
  ELSIF linked_org_id IS NOT NULL AND NEW.org_id <> linked_org_id THEN
    RAISE EXCEPTION 'contract_company_organization_mismatch';
  END IF;

  IF public.is_tenancy_enforced()
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    IF NEW.org_id IS NULL THEN
      RAISE EXCEPTION 'organization_required';
    END IF;
    IF NOT public.can_operate_organization(NEW.org_id) THEN
      RAISE EXCEPTION 'organization_not_operational';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_team_org_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  company_org_id uuid;
  contract_org_id uuid;
  linked_org_id uuid;
BEGIN
  IF NEW.company_id IS NOT NULL THEN
    SELECT company.org_id
      INTO company_org_id
      FROM public.companies company
     WHERE company.id = NEW.company_id;
  END IF;

  IF NEW.contract_id IS NOT NULL THEN
    SELECT contract.org_id
      INTO contract_org_id
      FROM public.contracts contract
     WHERE contract.id = NEW.contract_id;
  END IF;

  IF company_org_id IS NOT NULL
     AND contract_org_id IS NOT NULL
     AND company_org_id <> contract_org_id THEN
    RAISE EXCEPTION 'team_relationship_organization_mismatch';
  END IF;

  linked_org_id := coalesce(contract_org_id, company_org_id);

  IF NEW.org_id IS NULL THEN
    NEW.org_id := linked_org_id;
  ELSIF linked_org_id IS NOT NULL AND NEW.org_id <> linked_org_id THEN
    RAISE EXCEPTION 'team_organization_mismatch';
  END IF;

  IF public.is_tenancy_enforced()
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    IF NEW.org_id IS NULL THEN
      RAISE EXCEPTION 'organization_required';
    END IF;
    IF NOT public.can_operate_organization(NEW.org_id) THEN
      RAISE EXCEPTION 'organization_not_operational';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_project_org_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  contract_org_id uuid;
  team_org_id uuid;
  linked_org_id uuid;
BEGIN
  IF NEW.contract_id IS NOT NULL THEN
    SELECT contract.org_id
      INTO contract_org_id
      FROM public.contracts contract
     WHERE contract.id = NEW.contract_id;
  END IF;

  IF NEW.team_id IS NOT NULL THEN
    SELECT coalesce(team.org_id, public.resolve_team_org_id(team.id))
      INTO team_org_id
      FROM public.teams team
     WHERE team.id = NEW.team_id;
  END IF;

  IF contract_org_id IS NOT NULL
     AND team_org_id IS NOT NULL
     AND contract_org_id <> team_org_id THEN
    RAISE EXCEPTION 'project_relationship_organization_mismatch';
  END IF;

  linked_org_id := coalesce(contract_org_id, team_org_id);

  IF NEW.org_id IS NULL THEN
    NEW.org_id := linked_org_id;
  ELSIF linked_org_id IS NOT NULL AND NEW.org_id <> linked_org_id THEN
    RAISE EXCEPTION 'project_organization_mismatch';
  END IF;

  IF public.is_tenancy_enforced()
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    IF NEW.org_id IS NULL THEN
      RAISE EXCEPTION 'organization_required';
    END IF;
    IF NOT public.can_operate_organization(NEW.org_id) THEN
      RAISE EXCEPTION 'organization_not_operational';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_contract_team_org_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  contract_org_id uuid;
  team_org_id uuid;
BEGIN
  SELECT contract.org_id
    INTO contract_org_id
    FROM public.contracts contract
   WHERE contract.id = NEW.contract_id;

  SELECT coalesce(team.org_id, public.resolve_team_org_id(team.id))
    INTO team_org_id
    FROM public.teams team
   WHERE team.id = NEW.team_id;

  IF contract_org_id IS NOT NULL
     AND team_org_id IS NOT NULL
     AND contract_org_id <> team_org_id THEN
    RAISE EXCEPTION 'contract_team_organization_mismatch';
  END IF;

  IF public.is_tenancy_enforced()
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    IF contract_org_id IS NULL OR team_org_id IS NULL THEN
      RAISE EXCEPTION 'organization_required';
    END IF;
    IF NOT public.can_operate_organization(contract_org_id) THEN
      RAISE EXCEPTION 'organization_not_operational';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_contract_room_team_org_consistency()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  contract_org_id uuid;
  team_org_id uuid;
  project_org_id uuid;
BEGIN
  SELECT contract.org_id
    INTO contract_org_id
    FROM public.contracts contract
   WHERE contract.id = NEW.contract_id;

  SELECT coalesce(team.org_id, public.resolve_team_org_id(team.id))
    INTO team_org_id
    FROM public.teams team
   WHERE team.id = NEW.team_id;

  IF NEW.project_id IS NOT NULL THEN
    SELECT coalesce(project.org_id, public.resolve_project_org_id(project.id))
      INTO project_org_id
      FROM public.projects project
     WHERE project.id = NEW.project_id;
  END IF;

  IF contract_org_id IS NOT NULL
     AND team_org_id IS NOT NULL
     AND contract_org_id <> team_org_id THEN
    RAISE EXCEPTION 'contract_room_team_organization_mismatch';
  END IF;

  IF project_org_id IS NOT NULL
     AND contract_org_id IS NOT NULL
     AND project_org_id <> contract_org_id THEN
    RAISE EXCEPTION 'contract_room_project_organization_mismatch';
  END IF;

  IF public.is_tenancy_enforced()
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    IF contract_org_id IS NULL OR team_org_id IS NULL THEN
      RAISE EXCEPTION 'organization_required';
    END IF;
    IF NEW.project_id IS NOT NULL AND project_org_id IS NULL THEN
      RAISE EXCEPTION 'project_organization_required';
    END IF;
    IF NOT public.can_operate_organization(contract_org_id) THEN
      RAISE EXCEPTION 'organization_not_operational';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_org_boundary ON public.companies;
CREATE TRIGGER trg_company_org_boundary
BEFORE INSERT OR UPDATE ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.enforce_company_org_boundary();

DROP TRIGGER IF EXISTS trg_contract_org_consistency ON public.contracts;
CREATE TRIGGER trg_contract_org_consistency
BEFORE INSERT OR UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.enforce_contract_org_consistency();

DROP TRIGGER IF EXISTS trg_team_org_consistency ON public.teams;
CREATE TRIGGER trg_team_org_consistency
BEFORE INSERT OR UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.enforce_team_org_consistency();

DROP TRIGGER IF EXISTS trg_project_org_consistency ON public.projects;
CREATE TRIGGER trg_project_org_consistency
BEFORE INSERT OR UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.enforce_project_org_consistency();

DROP TRIGGER IF EXISTS trg_contract_team_org_consistency ON public.contract_teams;
CREATE TRIGGER trg_contract_team_org_consistency
BEFORE INSERT OR UPDATE ON public.contract_teams
FOR EACH ROW EXECUTE FUNCTION public.enforce_contract_team_org_consistency();

DROP TRIGGER IF EXISTS trg_contract_room_team_org_consistency ON public.contract_room_teams;
CREATE TRIGGER trg_contract_room_team_org_consistency
BEFORE INSERT OR UPDATE ON public.contract_room_teams
FOR EACH ROW EXECUTE FUNCTION public.enforce_contract_room_team_org_consistency();

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_room_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_slas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_tenant_boundary ON public.companies;
CREATE POLICY companies_tenant_boundary
ON public.companies AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  NOT public.is_tenancy_enforced()
  OR (org_id IS NOT NULL AND public.can_read_organization(org_id))
)
WITH CHECK (
  NOT public.is_tenancy_enforced()
  OR (org_id IS NOT NULL AND public.can_operate_organization(org_id))
);

DROP POLICY IF EXISTS contracts_tenant_boundary ON public.contracts;
CREATE POLICY contracts_tenant_boundary
ON public.contracts AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  NOT public.is_tenancy_enforced()
  OR (org_id IS NOT NULL AND public.can_read_organization(org_id))
)
WITH CHECK (
  NOT public.is_tenancy_enforced()
  OR (org_id IS NOT NULL AND public.can_operate_organization(org_id))
);

DROP POLICY IF EXISTS teams_tenant_boundary ON public.teams;
CREATE POLICY teams_tenant_boundary
ON public.teams AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  NOT public.is_tenancy_enforced()
  OR (org_id IS NOT NULL AND public.can_read_organization(org_id))
)
WITH CHECK (
  NOT public.is_tenancy_enforced()
  OR (org_id IS NOT NULL AND public.can_operate_organization(org_id))
);

DROP POLICY IF EXISTS projects_tenant_boundary ON public.projects;
CREATE POLICY projects_tenant_boundary
ON public.projects AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  NOT public.is_tenancy_enforced()
  OR (org_id IS NOT NULL AND public.can_read_organization(org_id))
)
WITH CHECK (
  NOT public.is_tenancy_enforced()
  OR (org_id IS NOT NULL AND public.can_operate_organization(org_id))
);

DROP POLICY IF EXISTS contract_teams_tenant_boundary ON public.contract_teams;
CREATE POLICY contract_teams_tenant_boundary
ON public.contract_teams AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  NOT public.is_tenancy_enforced()
  OR EXISTS (
    SELECT 1
    FROM public.contracts contract
    WHERE contract.id = contract_teams.contract_id
      AND public.can_read_organization(contract.org_id)
  )
)
WITH CHECK (
  NOT public.is_tenancy_enforced()
  OR EXISTS (
    SELECT 1
    FROM public.contracts contract
    WHERE contract.id = contract_teams.contract_id
      AND public.can_operate_organization(contract.org_id)
  )
);

DROP POLICY IF EXISTS contract_room_teams_tenant_boundary ON public.contract_room_teams;
CREATE POLICY contract_room_teams_tenant_boundary
ON public.contract_room_teams AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  NOT public.is_tenancy_enforced()
  OR EXISTS (
    SELECT 1
    FROM public.contracts contract
    WHERE contract.id = contract_room_teams.contract_id
      AND public.can_read_organization(contract.org_id)
  )
)
WITH CHECK (
  NOT public.is_tenancy_enforced()
  OR EXISTS (
    SELECT 1
    FROM public.contracts contract
    WHERE contract.id = contract_room_teams.contract_id
      AND public.can_operate_organization(contract.org_id)
  )
);

DROP POLICY IF EXISTS contract_slas_tenant_boundary ON public.contract_slas;
CREATE POLICY contract_slas_tenant_boundary
ON public.contract_slas AS RESTRICTIVE
FOR ALL TO authenticated
USING (
  NOT public.is_tenancy_enforced()
  OR EXISTS (
    SELECT 1
    FROM public.contracts contract
    WHERE contract.id = contract_slas.contract_id
      AND public.can_read_organization(contract.org_id)
  )
)
WITH CHECK (
  NOT public.is_tenancy_enforced()
  OR EXISTS (
    SELECT 1
    FROM public.contracts contract
    WHERE contract.id = contract_slas.contract_id
      AND public.can_operate_organization(contract.org_id)
  )
);

CREATE OR REPLACE FUNCTION public.get_tenancy_readiness_report()
RETURNS TABLE (
  resource text,
  issue text,
  affected_rows bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 'companies'::text, 'missing_org_id'::text, count(*)::bigint
  FROM public.companies
  WHERE org_id IS NULL

  UNION ALL

  SELECT 'contracts'::text, 'missing_org_id'::text, count(*)::bigint
  FROM public.contracts
  WHERE org_id IS NULL

  UNION ALL

  SELECT 'teams'::text, 'missing_org_id'::text, count(*)::bigint
  FROM public.teams
  WHERE org_id IS NULL

  UNION ALL

  SELECT 'projects'::text, 'missing_org_id'::text, count(*)::bigint
  FROM public.projects
  WHERE org_id IS NULL

  UNION ALL

  SELECT 'contracts'::text, 'company_org_mismatch'::text, count(*)::bigint
  FROM public.contracts contract
  JOIN public.companies company ON company.id = contract.company_id
  WHERE contract.org_id IS NOT NULL
    AND company.org_id IS NOT NULL
    AND contract.org_id <> company.org_id

  UNION ALL

  SELECT 'contract_teams'::text, 'contract_team_org_mismatch'::text, count(*)::bigint
  FROM public.contract_teams relation
  JOIN public.contracts contract ON contract.id = relation.contract_id
  JOIN public.teams team ON team.id = relation.team_id
  WHERE contract.org_id IS NOT NULL
    AND team.org_id IS NOT NULL
    AND contract.org_id <> team.org_id

  UNION ALL

  SELECT 'contract_room_teams'::text, 'contract_team_org_mismatch'::text, count(*)::bigint
  FROM public.contract_room_teams relation
  JOIN public.contracts contract ON contract.id = relation.contract_id
  JOIN public.teams team ON team.id = relation.team_id
  WHERE contract.org_id IS NOT NULL
    AND team.org_id IS NOT NULL
    AND contract.org_id <> team.org_id

  UNION ALL

  SELECT 'projects'::text, 'contract_org_mismatch'::text, count(*)::bigint
  FROM public.projects project
  JOIN public.contracts contract ON contract.id = project.contract_id
  WHERE project.org_id IS NOT NULL
    AND contract.org_id IS NOT NULL
    AND project.org_id <> contract.org_id

  UNION ALL

  SELECT 'projects'::text, 'team_org_mismatch'::text, count(*)::bigint
  FROM public.projects project
  JOIN public.teams team ON team.id = project.team_id
  WHERE project.org_id IS NOT NULL
    AND team.org_id IS NOT NULL
    AND project.org_id <> team.org_id;
$$;

REVOKE ALL ON FUNCTION public.is_tenancy_enforced() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_tenancy_enforcement(boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_read_organization(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_operate_organization(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_accessible_companies_v2(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_accessible_contracts_v2(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_accessible_projects_v2(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enforce_company_org_boundary() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_contract_org_consistency() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_team_org_consistency() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_project_org_consistency() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_contract_team_org_consistency() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_contract_room_team_org_consistency() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_tenancy_readiness_report() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_tenancy_enforced() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_tenancy_enforcement(boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_read_organization(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_operate_organization(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_accessible_companies_v2(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_accessible_contracts_v2(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_accessible_projects_v2(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforce_company_org_boundary() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_contract_org_consistency() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_team_org_consistency() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_project_org_consistency() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_contract_team_org_consistency() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_contract_room_team_org_consistency() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_tenancy_readiness_report() TO service_role;

COMMENT ON TABLE public.saas_runtime_settings IS
  'Configuracoes operacionais de rollout controladas exclusivamente pelo backend da plataforma.';
COMMENT ON FUNCTION public.set_tenancy_enforcement(boolean) IS
  'Ativa ou desativa o isolamento multi-tenant restritivo no banco. Executavel somente com service_role.';
COMMENT ON FUNCTION public.get_accessible_contracts_v2(uuid) IS
  'Lista contratos da organizacao acessivel ao usuario autenticado.';
COMMENT ON FUNCTION public.get_accessible_projects_v2(uuid, uuid) IS
  'Lista projetos da organizacao, com filtro opcional de contrato informado explicitamente.';
COMMENT ON FUNCTION public.get_tenancy_readiness_report() IS
  'Relatorio somente backend para validar registros sem organizacao e vinculos entre organizacoes antes do enforcement.';

DO $$
DECLARE
  v_enforced boolean;
  v_readiness_issues bigint;
BEGIN
  SELECT public.is_tenancy_enforced() INTO v_enforced;
  IF coalesce(v_enforced, false) THEN
    RAISE EXCEPTION 'Post-validation failed: tenancy enforcement was enabled.';
  END IF;

  SELECT count(*)::bigint
    INTO v_readiness_issues
  FROM public.get_tenancy_readiness_report()
  WHERE affected_rows > 0;

  IF v_readiness_issues > 0 THEN
    RAISE EXCEPTION 'Post-validation failed: tenancy readiness report has % issue groups.', v_readiness_issues;
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.is_tenancy_enforced()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Post-validation failed: authenticated cannot execute is_tenancy_enforced() required by policies.';
  END IF;

  IF has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Post-validation failed: client role can execute set_tenancy_enforcement(boolean).';
  END IF;

  IF has_function_privilege('anon', 'public.get_accessible_companies_v2(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_accessible_contracts_v2(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_accessible_projects_v2(uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Post-validation failed: anon can execute tenant-scoped resource RPCs.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies policy
    WHERE policy.schemaname = 'public'
      AND policy.policyname IN (
        'companies_tenant_boundary',
        'contracts_tenant_boundary',
        'teams_tenant_boundary',
        'projects_tenant_boundary',
        'contract_teams_tenant_boundary',
        'contract_room_teams_tenant_boundary',
        'contract_slas_tenant_boundary'
      )
    GROUP BY policy.schemaname
    HAVING count(DISTINCT policy.policyname) = 7
  ) THEN
    RAISE EXCEPTION 'Post-validation failed: tenant boundary policies are incomplete.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.triggers trigger_info
    WHERE trigger_info.trigger_schema = 'public'
      AND trigger_info.trigger_name IN (
        'trg_company_org_boundary',
        'trg_contract_org_consistency',
        'trg_team_org_consistency',
        'trg_project_org_consistency',
        'trg_contract_team_org_consistency',
        'trg_contract_room_team_org_consistency'
      )
    HAVING count(DISTINCT trigger_info.trigger_name) = 6
  ) THEN
    RAISE EXCEPTION 'Post-validation failed: tenancy consistency triggers are incomplete.';
  END IF;
END;
$$;

COMMIT;

WITH readiness AS (
  SELECT *
  FROM public.get_tenancy_readiness_report()
),
summary AS (
  SELECT
    coalesce(sum(affected_rows) FILTER (WHERE issue = 'missing_org_id'), 0)::bigint AS missing_org_rows,
    coalesce(sum(affected_rows) FILTER (WHERE issue <> 'missing_org_id'), 0)::bigint AS org_mismatch_rows
  FROM readiness
),
policy_count AS (
  SELECT count(DISTINCT policy.policyname)::bigint AS tenant_boundary_policies
  FROM pg_policies policy
  WHERE policy.schemaname = 'public'
    AND policy.policyname IN (
      'companies_tenant_boundary',
      'contracts_tenant_boundary',
      'teams_tenant_boundary',
      'projects_tenant_boundary',
      'contract_teams_tenant_boundary',
      'contract_room_teams_tenant_boundary',
      'contract_slas_tenant_boundary'
    )
),
trigger_count AS (
  SELECT count(DISTINCT trigger_info.trigger_name)::bigint AS tenancy_consistency_triggers
  FROM information_schema.triggers trigger_info
  WHERE trigger_info.trigger_schema = 'public'
    AND trigger_info.trigger_name IN (
      'trg_company_org_boundary',
      'trg_contract_org_consistency',
      'trg_team_org_consistency',
      'trg_project_org_consistency',
      'trg_contract_team_org_consistency',
      'trg_contract_room_team_org_consistency'
    )
)
SELECT
  public.is_tenancy_enforced() AS tenancy_enforcement_enabled,
  to_regclass('public.saas_runtime_settings') IS NOT NULL AS runtime_settings_installed,
  to_regprocedure('public.set_tenancy_enforcement(boolean)') IS NOT NULL AS tenancy_toggle_installed,
  policy_count.tenant_boundary_policies,
  trigger_count.tenancy_consistency_triggers,
  summary.missing_org_rows,
  summary.org_mismatch_rows,
  has_function_privilege('authenticated', 'public.get_accessible_companies_v2(uuid)', 'EXECUTE') AS companies_rpc_available,
  has_function_privilege('authenticated', 'public.get_accessible_contracts_v2(uuid)', 'EXECUTE') AS contracts_rpc_available,
  has_function_privilege('authenticated', 'public.get_accessible_projects_v2(uuid, uuid)', 'EXECUTE') AS projects_rpc_available,
  (
    public.is_tenancy_enforced() IS FALSE
    AND policy_count.tenant_boundary_policies = 7
    AND trigger_count.tenancy_consistency_triggers = 6
    AND summary.missing_org_rows = 0
    AND summary.org_mismatch_rows = 0
    AND has_function_privilege('authenticated', 'public.get_accessible_companies_v2(uuid)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.get_accessible_contracts_v2(uuid)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.get_accessible_projects_v2(uuid, uuid)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.set_tenancy_enforcement(boolean)', 'EXECUTE')
  ) AS org_resource_isolation_ready_enforcement_off
FROM summary
CROSS JOIN policy_count
CROSS JOIN trigger_count;
