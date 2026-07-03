-- Axion SaaS remote rollout — Operation 2
-- Installs the multi-tenant foundation without activating tenancy enforcement.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('axionn:saas-rollout:02-foundation'));

DO $$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_agg(required.object_name ORDER BY required.object_name)
  INTO v_missing
  FROM (
    VALUES
      ('public.organizations'),
      ('public.organization_members'),
      ('public.companies'),
      ('public.contracts'),
      ('public.teams'),
      ('public.projects'),
      ('public.user_roles'),
      ('public.contract_room_teams')
  ) AS required(object_name)
  WHERE to_regclass(required.object_name) IS NULL;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Dependências ausentes para a fundação multi-tenant: %', array_to_string(v_missing, ', ');
  END IF;

  IF to_regprocedure('public.is_tenancy_enforced()') IS NOT NULL
     AND public.is_tenancy_enforced() THEN
    RAISE EXCEPTION 'O tenancy enforcement está ativo; a fundação não será alterada';
  END IF;
END;
$$;

-- Temporary UUID aggregate used only by deterministic backfills.
CREATE OR REPLACE FUNCTION public.uuid_min_state(current_value uuid, next_value uuid)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN current_value IS NULL THEN next_value
    WHEN next_value IS NULL THEN current_value
    WHEN current_value < next_value THEN current_value
    ELSE next_value
  END;
$$;

DROP AGGREGATE IF EXISTS public.min(uuid);
CREATE AGGREGATE public.min(uuid) (
  SFUNC = public.uuid_min_state,
  STYPE = uuid,
  COMBINEFUNC = public.uuid_min_state,
  PARALLEL = SAFE
);

-- Audit trigger fix.
CREATE OR REPLACE FUNCTION public.audit_log_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_email text;
  v_record_id text;
  v_old_data jsonb;
  v_new_data jsonb;
BEGIN
  BEGIN
    v_actor_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_actor_id := NULL;
  END;

  IF v_actor_id IS NOT NULL THEN
    SELECT email INTO v_actor_email
    FROM auth.users
    WHERE id = v_actor_id;
  END IF;

  IF tg_op = 'DELETE' THEN
    v_old_data := to_jsonb(old);
    v_new_data := NULL;
    v_record_id := coalesce(v_old_data ->> 'id', v_old_data ->> 'user_id');
  ELSIF tg_op = 'INSERT' THEN
    v_old_data := NULL;
    v_new_data := to_jsonb(new);
    v_record_id := coalesce(v_new_data ->> 'id', v_new_data ->> 'user_id');
  ELSE
    v_old_data := to_jsonb(old);
    v_new_data := to_jsonb(new);
    v_record_id := coalesce(v_new_data ->> 'id', v_new_data ->> 'user_id');
  END IF;

  v_old_data := v_old_data - 'password' - 'encrypted_password' - 'must_change_password';
  v_new_data := v_new_data - 'password' - 'encrypted_password' - 'must_change_password';

  INSERT INTO public.audit_log (
    actor_id, actor_email, table_name, operation, record_id, old_data, new_data
  ) VALUES (
    v_actor_id, v_actor_email, tg_table_name, tg_op, v_record_id, v_old_data, v_new_data
  );

  RETURN coalesce(new, old);
END;
$$;

REVOKE ALL ON FUNCTION public.audit_log_trigger_fn() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_log_trigger_fn() TO service_role;

-- Preserve the existing contract_teams table. Create it only when absent.
DO $$
BEGIN
  IF to_regclass('public.contract_teams') IS NULL THEN
    CREATE TABLE public.contract_teams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
      team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT contract_teams_contract_id_team_id_key UNIQUE (contract_id, team_id)
    );
  ELSE
    IF EXISTS (
      SELECT 1
      FROM public.contract_teams
      GROUP BY contract_id, team_id
      HAVING count(*) > 1
    ) THEN
      RAISE EXCEPTION 'contract_teams contém vínculos duplicados';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.contract_teams'::regclass
        AND contype = 'u'
        AND pg_get_constraintdef(oid) = 'UNIQUE (contract_id, team_id)'
    ) THEN
      ALTER TABLE public.contract_teams
        ADD CONSTRAINT contract_teams_contract_id_team_id_key UNIQUE (contract_id, team_id);
    END IF;
  END IF;
END;
$$;

ALTER TABLE public.contract_teams ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.contract_teams IS
  'Vínculo compatível entre contratos e times, preservado durante a consolidação multi-tenant.';

CREATE TABLE IF NOT EXISTS public.platform_user_roles (
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('platform_admin', 'support_agent', 'billing_operator')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  PRIMARY KEY (user_id, role)
);

ALTER TABLE public.platform_user_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_user_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_user_roles TO service_role;

INSERT INTO public.platform_user_roles (user_id, role)
SELECT ur.user_id, 'platform_admin'
FROM public.user_roles ur
WHERE ur.role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_companies_org_id ON public.companies(org_id);
CREATE INDEX IF NOT EXISTS idx_contracts_org_id ON public.contracts(org_id);
CREATE INDEX IF NOT EXISTS idx_teams_org_id ON public.teams(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_org
  ON public.organization_members(user_id, org_id);

WITH company_candidates AS (
  SELECT c.company_id, public.min(c.org_id) AS org_id
  FROM public.contracts c
  WHERE c.company_id IS NOT NULL
    AND c.org_id IS NOT NULL
  GROUP BY c.company_id
  HAVING count(DISTINCT c.org_id) = 1
)
UPDATE public.companies company
SET org_id = candidate.org_id
FROM company_candidates candidate
WHERE company.id = candidate.company_id
  AND company.org_id IS NULL;

WITH team_org_candidates AS (
  SELECT candidate.team_id, public.min(candidate.org_id) AS org_id
  FROM (
    SELECT t.id AS team_id, c.org_id
    FROM public.teams t
    JOIN public.contracts c ON c.id = t.contract_id
    WHERE c.org_id IS NOT NULL

    UNION ALL

    SELECT ct.team_id, c.org_id
    FROM public.contract_teams ct
    JOIN public.contracts c ON c.id = ct.contract_id
    WHERE c.org_id IS NOT NULL

    UNION ALL

    SELECT crt.team_id, c.org_id
    FROM public.contract_room_teams crt
    JOIN public.contracts c ON c.id = crt.contract_id
    WHERE crt.is_active = true
      AND c.org_id IS NOT NULL

    UNION ALL

    SELECT p.team_id, c.org_id
    FROM public.projects p
    JOIN public.contracts c ON c.id = p.contract_id
    WHERE p.team_id IS NOT NULL
      AND c.org_id IS NOT NULL
  ) candidate
  GROUP BY candidate.team_id
  HAVING count(DISTINCT candidate.org_id) = 1
)
UPDATE public.teams team
SET org_id = candidate.org_id
FROM team_org_candidates candidate
WHERE team.id = candidate.team_id
  AND team.org_id IS NULL;

UPDATE public.projects project
SET org_id = contract.org_id
FROM public.contracts contract
WHERE project.contract_id = contract.id
  AND project.org_id IS NULL
  AND contract.org_id IS NOT NULL;

UPDATE public.projects project
SET org_id = team.org_id
FROM public.teams team
WHERE project.team_id = team.id
  AND project.org_id IS NULL
  AND team.org_id IS NOT NULL;

UPDATE public.teams team
SET org_id = company.org_id
FROM public.companies company
WHERE team.company_id = company.id
  AND team.org_id IS NULL
  AND company.org_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_platform_admin(
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_user_roles role
    WHERE role.user_id = p_user_id
      AND role.role = 'platform_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_organization_member(
  p_org_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_platform_admin(p_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.organization_members member
      WHERE member.org_id = p_org_id
        AND member.user_id = p_user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.is_organization_admin(
  p_org_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_platform_admin(p_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.organization_members member
      WHERE member.org_id = p_org_id
        AND member.user_id = p_user_id
        AND member.role IN ('owner', 'admin')
    );
$$;

CREATE OR REPLACE FUNCTION public.resolve_contract_org_id(p_contract_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT contract.org_id
  FROM public.contracts contract
  WHERE contract.id = p_contract_id;
$$;

CREATE OR REPLACE FUNCTION public.resolve_team_org_id(p_team_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    team.org_id,
    company.org_id,
    direct_contract.org_id,
    linked_contract.org_id,
    room_contract.org_id,
    project_contract.org_id
  )
  FROM public.teams team
  LEFT JOIN public.companies company ON company.id = team.company_id
  LEFT JOIN public.contracts direct_contract ON direct_contract.id = team.contract_id
  LEFT JOIN LATERAL (
    SELECT contract.org_id
    FROM public.contract_teams link
    JOIN public.contracts contract ON contract.id = link.contract_id
    WHERE link.team_id = team.id
      AND contract.org_id IS NOT NULL
    ORDER BY link.created_at DESC
    LIMIT 1
  ) linked_contract ON true
  LEFT JOIN LATERAL (
    SELECT contract.org_id
    FROM public.contract_room_teams link
    JOIN public.contracts contract ON contract.id = link.contract_id
    WHERE link.team_id = team.id
      AND link.is_active = true
      AND contract.org_id IS NOT NULL
    ORDER BY link.created_at DESC
    LIMIT 1
  ) room_contract ON true
  LEFT JOIN LATERAL (
    SELECT contract.org_id
    FROM public.projects project
    JOIN public.contracts contract ON contract.id = project.contract_id
    WHERE project.team_id = team.id
      AND contract.org_id IS NOT NULL
    ORDER BY project.created_at DESC
    LIMIT 1
  ) project_contract ON true
  WHERE team.id = p_team_id;
$$;

CREATE OR REPLACE FUNCTION public.resolve_project_org_id(p_project_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    project.org_id,
    contract.org_id,
    public.resolve_team_org_id(project.team_id)
  )
  FROM public.projects project
  LEFT JOIN public.contracts contract ON contract.id = project.contract_id
  WHERE project.id = p_project_id;
$$;

CREATE OR REPLACE FUNCTION public.get_my_organizations_v2()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  status public.org_status,
  plan public.org_plan,
  membership_role text,
  is_platform_admin boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH access AS (
    SELECT
      organization.id,
      organization.name,
      organization.slug,
      organization.status,
      organization.plan,
      member.role::text AS membership_role,
      false AS platform_access
    FROM public.organization_members member
    JOIN public.organizations organization ON organization.id = member.org_id
    WHERE member.user_id = auth.uid()

    UNION ALL

    SELECT
      organization.id,
      organization.name,
      organization.slug,
      organization.status,
      organization.plan,
      'platform_admin'::text,
      true
    FROM public.organizations organization
    WHERE public.is_platform_admin(auth.uid())
  )
  SELECT DISTINCT ON (access.id)
    access.id,
    access.name,
    access.slug,
    access.status,
    access.plan,
    access.membership_role,
    public.is_platform_admin(auth.uid())
  FROM access
  ORDER BY access.id, access.platform_access DESC, access.name;
$$;

CREATE OR REPLACE FUNCTION public.get_accessible_teams_v2(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  module text,
  org_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    team.id,
    team.name,
    team.module,
    coalesce(team.org_id, public.resolve_team_org_id(team.id)) AS org_id
  FROM public.teams team
  WHERE coalesce(team.org_id, public.resolve_team_org_id(team.id)) = p_org_id
    AND (
      public.is_platform_admin(auth.uid())
      OR public.is_organization_admin(p_org_id, auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.team_members member
        WHERE member.team_id = team.id
          AND member.user_id = auth.uid()
      )
    )
  ORDER BY team.name;
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_organization_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_organization_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_contract_org_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_team_org_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_project_org_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_my_organizations_v2() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_accessible_teams_v2(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_organization_admin(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_contract_org_id(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_team_org_id(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_project_org_id(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_organizations_v2() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_accessible_teams_v2(uuid) TO authenticated, service_role;

COMMENT ON TABLE public.platform_user_roles IS
  'Papéis internos da plataforma Axion, separados dos papéis das organizações clientes.';
COMMENT ON FUNCTION public.get_my_organizations_v2() IS
  'Lista organizações acessíveis ao usuário autenticado, incluindo acesso global de platform_admin.';
COMMENT ON FUNCTION public.get_accessible_teams_v2(uuid) IS
  'Lista times acessíveis dentro de uma organização, respeitando administração e membership.';
COMMENT ON FUNCTION public.is_platform_admin(uuid) IS
  'Função interna de autorização. O usuário atual é resolvido pelas RPCs públicas tenant-scoped.';
COMMENT ON FUNCTION public.is_organization_member(uuid, uuid) IS
  'Função interna de membership; não aceita execução direta do frontend.';
COMMENT ON FUNCTION public.is_organization_admin(uuid, uuid) IS
  'Função interna de administração organizacional; não aceita execução direta do frontend.';

DROP AGGREGATE IF EXISTS public.min(uuid);
DROP FUNCTION IF EXISTS public.uuid_min_state(uuid, uuid);

DO $$
BEGIN
  IF to_regclass('public.platform_user_roles') IS NULL THEN
    RAISE EXCEPTION 'platform_user_roles não foi criada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'org_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'org_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'org_id'
  ) THEN
    RAISE EXCEPTION 'As colunas org_id da fundação não foram criadas';
  END IF;

  IF to_regprocedure('public.uuid_min_state(uuid,uuid)') IS NOT NULL
     OR to_regprocedure('public.min(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'O helper temporário de UUID não foi removido';
  END IF;

  IF has_function_privilege('authenticated', 'public.is_platform_admin(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.get_my_organizations_v2()', 'EXECUTE') THEN
    RAISE EXCEPTION 'ACL incorreta nos wrappers de organização';
  END IF;
END;
$$;

COMMIT;

SELECT
  (SELECT count(*) FROM public.companies WHERE org_id IS NULL) AS companies_without_org,
  (SELECT count(*) FROM public.teams WHERE org_id IS NULL) AS teams_without_org,
  (SELECT count(*) FROM public.projects WHERE org_id IS NULL) AS projects_without_org,
  (SELECT count(*) FROM public.platform_user_roles WHERE role = 'platform_admin') AS platform_admins,
  NOT has_function_privilege('authenticated', 'public.is_platform_admin(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.get_my_organizations_v2()', 'EXECUTE')
  AS multitenant_foundation_ok;
