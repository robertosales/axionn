-- One-off production operation: install the non-enforcing multi-tenant foundation.
-- Run manually in Lovable Cloud SQL Editor only after backup and preflight approval.
-- This operation is intentionally outside supabase/migrations because it adapts
-- the 20260630 foundation series to the current managed production state.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('axionn:20260703:02_multitenant_foundation'));

DO $$
DECLARE
  v_missing text;
  v_enforced boolean;
BEGIN
  PERFORM set_config(
    'axionn.operation_2.pre_saas_runtime_settings_exists',
    (to_regclass('public.saas_runtime_settings') IS NOT NULL)::text,
    false
  );
  PERFORM set_config(
    'axionn.operation_2.pre_set_tenancy_enforcement_exists',
    (to_regprocedure('public.set_tenancy_enforcement(boolean)') IS NOT NULL)::text,
    false
  );
  PERFORM set_config(
    'axionn.operation_2.pre_is_tenancy_enforced_exists',
    (to_regprocedure('public.is_tenancy_enforced()') IS NOT NULL)::text,
    false
  );
  PERFORM set_config(
    'axionn.operation_2.pre_tenant_boundary_exists',
    (EXISTS (
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
    ))::text,
    false
  );
  PERFORM set_config(
    'axionn.operation_2.pre_tenancy_trigger_exists',
    (EXISTS (
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
    ))::text,
    false
  );

  SELECT string_agg(object_name, ', ' ORDER BY object_name)
    INTO v_missing
  FROM (
    VALUES
      ('table public.audit_log', to_regclass('public.audit_log') IS NOT NULL),
      ('table public.companies', to_regclass('public.companies') IS NOT NULL),
      ('table public.contract_room_teams', to_regclass('public.contract_room_teams') IS NOT NULL),
      ('table public.contract_teams', to_regclass('public.contract_teams') IS NOT NULL),
      ('table public.contracts', to_regclass('public.contracts') IS NOT NULL),
      ('table public.organization_members', to_regclass('public.organization_members') IS NOT NULL),
      ('table public.organizations', to_regclass('public.organizations') IS NOT NULL),
      ('table public.projects', to_regclass('public.projects') IS NOT NULL),
      ('table public.team_members', to_regclass('public.team_members') IS NOT NULL),
      ('table public.teams', to_regclass('public.teams') IS NOT NULL),
      ('table public.user_roles', to_regclass('public.user_roles') IS NOT NULL),
      ('type public.org_plan', to_regtype('public.org_plan') IS NOT NULL),
      ('type public.org_status', to_regtype('public.org_status') IS NOT NULL),
      ('function auth.uid()', to_regprocedure('auth.uid()') IS NOT NULL)
  ) AS required(object_name, present)
  WHERE NOT present;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required dependencies before rollout writes: %', v_missing;
  END IF;

  SELECT string_agg(table_name || '.' || column_name, ', ' ORDER BY table_name, column_name)
    INTO v_missing
  FROM (
    VALUES
      ('audit_log', 'actor_id'),
      ('audit_log', 'actor_email'),
      ('audit_log', 'new_data'),
      ('audit_log', 'old_data'),
      ('audit_log', 'operation'),
      ('audit_log', 'record_id'),
      ('audit_log', 'table_name'),
      ('companies', 'id'),
      ('contract_room_teams', 'contract_id'),
      ('contract_room_teams', 'created_at'),
      ('contract_room_teams', 'is_active'),
      ('contract_room_teams', 'team_id'),
      ('contract_teams', 'contract_id'),
      ('contract_teams', 'created_at'),
      ('contract_teams', 'team_id'),
      ('contracts', 'company_id'),
      ('contracts', 'id'),
      ('contracts', 'org_id'),
      ('organization_members', 'org_id'),
      ('organization_members', 'role'),
      ('organization_members', 'user_id'),
      ('organizations', 'id'),
      ('organizations', 'name'),
      ('organizations', 'plan'),
      ('organizations', 'slug'),
      ('organizations', 'status'),
      ('projects', 'contract_id'),
      ('projects', 'created_at'),
      ('projects', 'id'),
      ('projects', 'name'),
      ('projects', 'team_id'),
      ('team_members', 'team_id'),
      ('team_members', 'user_id'),
      ('teams', 'company_id'),
      ('teams', 'contract_id'),
      ('teams', 'id'),
      ('teams', 'module'),
      ('teams', 'name'),
      ('user_roles', 'role'),
      ('user_roles', 'user_id')
  ) AS required(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns column_info
    WHERE column_info.table_schema = 'public'
      AND column_info.table_name = required.table_name
      AND column_info.column_name = required.column_name
  );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required columns before rollout writes: %', v_missing;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id = 'd7f226d9-9f08-43a7-b565-482cca58f00d'
      AND slug = 'sales-consultoria'
      AND plan = 'enterprise'
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Expected SALES CONSULTORIA organization is absent or not active enterprise.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.contract_teams
    GROUP BY contract_id, team_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate contract_teams(contract_id, team_id) rows found; aborting without normalization.';
  END IF;

  IF to_regprocedure('public.is_tenancy_enforced()') IS NOT NULL THEN
    EXECUTE 'SELECT public.is_tenancy_enforced()' INTO v_enforced;
    IF coalesce(v_enforced, false) THEN
      RAISE EXCEPTION 'Tenancy enforcement is already enabled; aborting Operation 2.';
    END IF;
  END IF;

  PERFORM set_config('axionn.operation_2.tenancy_enforced', coalesce(v_enforced, false)::text, false);
END;
$$;

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
  EXCEPTION WHEN others THEN
    v_actor_id := NULL;
  END;

  IF v_actor_id IS NOT NULL THEN
    SELECT email
      INTO v_actor_email
      FROM auth.users
     WHERE id = v_actor_id;
  END IF;

  IF tg_op = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_record_id := coalesce(v_old_data ->> 'id', v_old_data ->> 'user_id');
  ELSIF tg_op = 'INSERT' THEN
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
    v_record_id := coalesce(v_new_data ->> 'id', v_new_data ->> 'user_id');
  ELSE
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_record_id := coalesce(v_new_data ->> 'id', v_new_data ->> 'user_id');
  END IF;

  v_old_data := v_old_data - 'password' - 'encrypted_password' - 'must_change_password';
  v_new_data := v_new_data - 'password' - 'encrypted_password' - 'must_change_password';

  INSERT INTO public.audit_log (
    actor_id,
    actor_email,
    table_name,
    operation,
    record_id,
    old_data,
    new_data
  ) VALUES (
    v_actor_id,
    v_actor_email,
    tg_table_name,
    tg_op,
    v_record_id,
    v_old_data,
    v_new_data
  );

  RETURN coalesce(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.audit_log_trigger_fn() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_log_trigger_fn() TO service_role;

DO $$
DECLARE
  v_has_unique boolean;
  v_has_contract_index boolean;
  v_has_team_index boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_info
    WHERE constraint_info.conrelid = 'public.contract_teams'::regclass
      AND constraint_info.contype IN ('u', 'p')
      AND (
        SELECT count(*) = 2
          AND bool_or(attribute.attname = 'contract_id')
          AND bool_or(attribute.attname = 'team_id')
        FROM unnest(constraint_info.conkey) WITH ORDINALITY AS key_position(attnum, position)
        JOIN pg_attribute attribute
          ON attribute.attrelid = constraint_info.conrelid
         AND attribute.attnum = key_position.attnum
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_index index_info
    WHERE index_info.indrelid = 'public.contract_teams'::regclass
      AND index_info.indisunique
      AND index_info.indisvalid
      AND index_info.indpred IS NULL
      AND index_info.indnkeyatts = 2
      AND index_info.indkey[0] > 0
      AND index_info.indkey[1] > 0
      AND EXISTS (
        SELECT 1
        FROM pg_attribute attribute
        WHERE attribute.attrelid = index_info.indrelid
          AND attribute.attnum = index_info.indkey[0]
          AND attribute.attname IN ('contract_id', 'team_id')
      )
      AND EXISTS (
        SELECT 1
        FROM pg_attribute attribute
        WHERE attribute.attrelid = index_info.indrelid
          AND attribute.attnum = index_info.indkey[1]
          AND attribute.attname IN ('contract_id', 'team_id')
      )
      AND index_info.indkey[0] <> index_info.indkey[1]
      AND EXISTS (
        SELECT 1
        FROM pg_attribute attribute
        WHERE attribute.attrelid = index_info.indrelid
          AND attribute.attname = 'contract_id'
          AND attribute.attnum IN (index_info.indkey[0], index_info.indkey[1])
      )
      AND EXISTS (
        SELECT 1
        FROM pg_attribute attribute
        WHERE attribute.attrelid = index_info.indrelid
          AND attribute.attname = 'team_id'
          AND attribute.attnum IN (index_info.indkey[0], index_info.indkey[1])
      )
  ) INTO v_has_unique;

  IF NOT v_has_unique THEN
    ALTER TABLE public.contract_teams
      ADD CONSTRAINT contract_teams_contract_id_team_id_key UNIQUE (contract_id, team_id);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_index index_info
    WHERE index_info.indrelid = 'public.contract_teams'::regclass
      AND index_info.indisvalid
      AND index_info.indpred IS NULL
      AND index_info.indkey[0] > 0
      AND EXISTS (
        SELECT 1
        FROM pg_attribute attribute
        WHERE attribute.attrelid = index_info.indrelid
          AND attribute.attnum = index_info.indkey[0]
          AND attribute.attname = 'contract_id'
      )
  ) INTO v_has_contract_index;

  IF NOT v_has_contract_index THEN
    CREATE INDEX idx_contract_teams_contract_id ON public.contract_teams(contract_id);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_index index_info
    WHERE index_info.indrelid = 'public.contract_teams'::regclass
      AND index_info.indisvalid
      AND index_info.indpred IS NULL
      AND index_info.indkey[0] > 0
      AND EXISTS (
        SELECT 1
        FROM pg_attribute attribute
        WHERE attribute.attrelid = index_info.indrelid
          AND attribute.attnum = index_info.indkey[0]
          AND attribute.attname = 'team_id'
      )
  ) INTO v_has_team_index;

  IF NOT v_has_team_index THEN
    CREATE INDEX idx_contract_teams_team_id ON public.contract_teams(team_id);
  END IF;
END;
$$;

ALTER TABLE public.contract_teams ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.contract_teams IS
  'Vinculo compativel entre contratos e times, preservado durante a consolidacao multi-tenant.';

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
SELECT user_roles.user_id, 'platform_admin'
FROM public.user_roles
WHERE user_roles.role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;

DO $$
DECLARE
  v_has_index boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_index index_info
    JOIN pg_class table_info ON table_info.oid = index_info.indrelid
    JOIN pg_namespace namespace ON namespace.oid = table_info.relnamespace
    JOIN pg_attribute attribute
      ON attribute.attrelid = index_info.indrelid
     AND attribute.attnum = index_info.indkey[0]
    WHERE namespace.nspname = 'public'
      AND table_info.relname = 'companies'
      AND index_info.indisvalid
      AND index_info.indpred IS NULL
      AND attribute.attname = 'org_id'
  ) INTO v_has_index;
  IF NOT v_has_index THEN
    CREATE INDEX idx_companies_org_id ON public.companies(org_id);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_index index_info
    JOIN pg_class table_info ON table_info.oid = index_info.indrelid
    JOIN pg_namespace namespace ON namespace.oid = table_info.relnamespace
    JOIN pg_attribute attribute
      ON attribute.attrelid = index_info.indrelid
     AND attribute.attnum = index_info.indkey[0]
    WHERE namespace.nspname = 'public'
      AND table_info.relname = 'contracts'
      AND index_info.indisvalid
      AND index_info.indpred IS NULL
      AND attribute.attname = 'org_id'
  ) INTO v_has_index;
  IF NOT v_has_index THEN
    CREATE INDEX idx_contracts_org_id ON public.contracts(org_id);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_index index_info
    JOIN pg_class table_info ON table_info.oid = index_info.indrelid
    JOIN pg_namespace namespace ON namespace.oid = table_info.relnamespace
    JOIN pg_attribute attribute
      ON attribute.attrelid = index_info.indrelid
     AND attribute.attnum = index_info.indkey[0]
    WHERE namespace.nspname = 'public'
      AND table_info.relname = 'teams'
      AND index_info.indisvalid
      AND index_info.indpred IS NULL
      AND attribute.attname = 'org_id'
  ) INTO v_has_index;
  IF NOT v_has_index THEN
    CREATE INDEX idx_teams_org_id ON public.teams(org_id);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_index index_info
    JOIN pg_class table_info ON table_info.oid = index_info.indrelid
    JOIN pg_namespace namespace ON namespace.oid = table_info.relnamespace
    JOIN pg_attribute attribute
      ON attribute.attrelid = index_info.indrelid
     AND attribute.attnum = index_info.indkey[0]
    WHERE namespace.nspname = 'public'
      AND table_info.relname = 'projects'
      AND index_info.indisvalid
      AND index_info.indpred IS NULL
      AND attribute.attname = 'org_id'
  ) INTO v_has_index;
  IF NOT v_has_index THEN
    CREATE INDEX idx_projects_org_id ON public.projects(org_id);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_index index_info
    WHERE index_info.indrelid = 'public.organization_members'::regclass
      AND index_info.indisvalid
      AND index_info.indpred IS NULL
      AND index_info.indnkeyatts >= 2
      AND EXISTS (
        SELECT 1
        FROM pg_attribute attribute
        WHERE attribute.attrelid = index_info.indrelid
          AND attribute.attnum = index_info.indkey[0]
          AND attribute.attname = 'user_id'
      )
      AND EXISTS (
        SELECT 1
        FROM pg_attribute attribute
        WHERE attribute.attrelid = index_info.indrelid
          AND attribute.attnum = index_info.indkey[1]
          AND attribute.attname = 'org_id'
      )
  ) INTO v_has_index;
  IF NOT v_has_index THEN
    CREATE INDEX idx_organization_members_user_org
      ON public.organization_members(user_id, org_id);
  END IF;
END;
$$;

WITH company_candidates AS (
  SELECT contract.company_id, min(contract.org_id) AS org_id
  FROM public.contracts contract
  WHERE contract.company_id IS NOT NULL
    AND contract.org_id IS NOT NULL
  GROUP BY contract.company_id
  HAVING count(DISTINCT contract.org_id) = 1
)
UPDATE public.companies company
SET org_id = candidate.org_id
FROM company_candidates candidate
WHERE company.id = candidate.company_id
  AND company.org_id IS NULL;

WITH team_org_candidates AS (
  SELECT candidate.team_id, min(candidate.org_id) AS org_id
  FROM (
    SELECT team.id AS team_id, contract.org_id
    FROM public.teams team
    JOIN public.contracts contract ON contract.id = team.contract_id
    WHERE contract.org_id IS NOT NULL

    UNION ALL

    SELECT contract_team.team_id, contract.org_id
    FROM public.contract_teams contract_team
    JOIN public.contracts contract ON contract.id = contract_team.contract_id
    WHERE contract.org_id IS NOT NULL

    UNION ALL

    SELECT room_team.team_id, contract.org_id
    FROM public.contract_room_teams room_team
    JOIN public.contracts contract ON contract.id = room_team.contract_id
    WHERE room_team.is_active = true
      AND contract.org_id IS NOT NULL

    UNION ALL

    SELECT project.team_id, contract.org_id
    FROM public.projects project
    JOIN public.contracts contract ON contract.id = project.contract_id
    WHERE project.team_id IS NOT NULL
      AND contract.org_id IS NOT NULL

    UNION ALL

    SELECT team.id AS team_id, company.org_id
    FROM public.teams team
    JOIN public.companies company ON company.id = team.company_id
    WHERE company.org_id IS NOT NULL
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

WITH project_team_candidates AS (
  SELECT project.id, min(team.org_id) AS org_id
  FROM public.projects project
  JOIN public.teams team ON team.id = project.team_id
  WHERE project.org_id IS NULL
    AND team.org_id IS NOT NULL
  GROUP BY project.id
  HAVING count(DISTINCT team.org_id) = 1
)
UPDATE public.projects project
SET org_id = candidate.org_id
FROM project_team_candidates candidate
WHERE project.id = candidate.id
  AND project.org_id IS NULL;

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
REVOKE ALL ON FUNCTION public.get_my_organizations_v2() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_accessible_teams_v2(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_organization_member(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_organization_admin(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_contract_org_id(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_team_org_id(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_project_org_id(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_organizations_v2() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_accessible_teams_v2(uuid) TO authenticated, service_role;

COMMENT ON TABLE public.platform_user_roles IS
  'Papeis internos da plataforma Axion, separados dos papeis das organizacoes clientes.';
COMMENT ON FUNCTION public.is_platform_admin(uuid) IS
  'Funcao interna de autorizacao. O usuario atual e resolvido pelas RPCs publicas tenant-scoped.';
COMMENT ON FUNCTION public.is_organization_member(uuid, uuid) IS
  'Funcao interna de membership; nao aceita execucao direta do frontend.';
COMMENT ON FUNCTION public.is_organization_admin(uuid, uuid) IS
  'Funcao interna de administracao organizacional; nao aceita execucao direta do frontend.';
COMMENT ON FUNCTION public.get_my_organizations_v2() IS
  'Lista organizacoes acessiveis ao usuario autenticado, incluindo acesso global de platform_admin.';
COMMENT ON FUNCTION public.get_accessible_teams_v2(uuid) IS
  'Lista times acessiveis dentro de uma organizacao, respeitando administracao e membership.';

DROP AGGREGATE IF EXISTS public.min(uuid);
DROP FUNCTION IF EXISTS public.uuid_min_state(uuid, uuid);

DO $$
DECLARE
  v_enforced boolean;
BEGIN
  IF to_regclass('public.platform_user_roles') IS NULL THEN
    RAISE EXCEPTION 'Post-validation failed: platform_user_roles does not exist.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'org_id'
  ) THEN
    RAISE EXCEPTION 'Post-validation failed: companies.org_id does not exist.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'org_id'
  ) THEN
    RAISE EXCEPTION 'Post-validation failed: teams.org_id does not exist.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'org_id'
  ) THEN
    RAISE EXCEPTION 'Post-validation failed: projects.org_id does not exist.';
  END IF;

  IF to_regprocedure('public.min(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Post-validation failed: helper aggregate public.min(uuid) still exists.';
  END IF;

  IF to_regprocedure('public.uuid_min_state(uuid,uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'Post-validation failed: helper function public.uuid_min_state(uuid, uuid) still exists.';
  END IF;

  IF has_function_privilege('authenticated', 'public.is_platform_admin(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.is_organization_member(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.is_organization_admin(uuid, uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.resolve_contract_org_id(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.resolve_team_org_id(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.resolve_project_org_id(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Post-validation failed: authenticated can execute an internal wrapper.';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.get_my_organizations_v2()', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.get_accessible_teams_v2(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Post-validation failed: authenticated cannot execute tenant-scoped RPCs.';
  END IF;

  IF has_function_privilege('anon', 'public.get_my_organizations_v2()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_accessible_teams_v2(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Post-validation failed: anon can execute tenant-scoped RPCs.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc proc
    JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
    CROSS JOIN LATERAL aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) acl
    WHERE namespace.nspname = 'public'
      AND proc.proname IN ('get_my_organizations_v2', 'get_accessible_teams_v2')
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'Post-validation failed: PUBLIC can execute tenant-scoped RPCs.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.contract_teams
    GROUP BY contract_id, team_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Post-validation failed: duplicate contract_teams rows exist.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.contracts contract
    JOIN public.companies company ON company.id = contract.company_id
    WHERE company.org_id IS NOT NULL
      AND contract.org_id IS DISTINCT FROM company.org_id
  ) THEN
    RAISE EXCEPTION 'Post-validation failed: contract org_id mismatches company org_id.';
  END IF;

  IF current_setting('axionn.operation_2.pre_saas_runtime_settings_exists', true) IS DISTINCT FROM 'true'
     AND to_regclass('public.saas_runtime_settings') IS NOT NULL THEN
    RAISE EXCEPTION 'Post-validation failed: Operation 2 created saas_runtime_settings.';
  END IF;

  IF current_setting('axionn.operation_2.pre_set_tenancy_enforcement_exists', true) IS DISTINCT FROM 'true'
     AND to_regprocedure('public.set_tenancy_enforcement(boolean)') IS NOT NULL THEN
    RAISE EXCEPTION 'Post-validation failed: Operation 2 created set_tenancy_enforcement(boolean).';
  END IF;

  IF current_setting('axionn.operation_2.pre_is_tenancy_enforced_exists', true) IS DISTINCT FROM 'true'
     AND to_regprocedure('public.is_tenancy_enforced()') IS NOT NULL THEN
    RAISE EXCEPTION 'Post-validation failed: Operation 2 created is_tenancy_enforced().';
  END IF;

  IF to_regprocedure('public.is_tenancy_enforced()') IS NOT NULL THEN
    EXECUTE 'SELECT public.is_tenancy_enforced()' INTO v_enforced;
    IF coalesce(v_enforced, false) THEN
      RAISE EXCEPTION 'Post-validation failed: tenancy enforcement is enabled.';
    END IF;
  END IF;
  PERFORM set_config('axionn.operation_2.tenancy_enforced', coalesce(v_enforced, false)::text, false);

  IF current_setting('axionn.operation_2.pre_tenant_boundary_exists', true) IS DISTINCT FROM 'true'
     AND EXISTS (
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
  ) THEN
    RAISE EXCEPTION 'Post-validation failed: Operation 2 created tenant boundary policies.';
  END IF;

  IF current_setting('axionn.operation_2.pre_tenancy_trigger_exists', true) IS DISTINCT FROM 'true'
     AND EXISTS (
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
  ) THEN
    RAISE EXCEPTION 'Post-validation failed: Operation 2 created tenancy consistency triggers.';
  END IF;
END;
$$;

COMMIT;

WITH final_checks AS (
  SELECT
    (SELECT count(*)::bigint FROM public.companies WHERE org_id IS NULL) AS companies_without_org,
    (SELECT count(*)::bigint FROM public.teams WHERE org_id IS NULL) AS teams_without_org,
    (SELECT count(*)::bigint FROM public.projects WHERE org_id IS NULL) AS projects_without_org,
    (
      SELECT count(*)::bigint
      FROM public.platform_user_roles
      WHERE role = 'platform_admin'
    ) AS platform_admins,
    (
      SELECT count(*)::bigint
      FROM public.contracts contract
      JOIN public.companies company ON company.id = contract.company_id
      WHERE company.org_id IS NOT NULL
        AND contract.org_id IS DISTINCT FROM company.org_id
    ) AS contract_company_org_mismatches,
    (
      SELECT count(*)::bigint
      FROM public.contract_teams relation
      JOIN public.contracts contract ON contract.id = relation.contract_id
      JOIN public.teams team ON team.id = relation.team_id
      WHERE contract.org_id IS NOT NULL
        AND team.org_id IS NOT NULL
        AND contract.org_id <> team.org_id
    ) AS contract_team_org_mismatches,
    (
      to_regprocedure('public.min(uuid)') IS NULL
      AND to_regprocedure('public.uuid_min_state(uuid,uuid)') IS NULL
    ) AS helper_uuid_removed,
    (
      NOT has_function_privilege('authenticated', 'public.is_platform_admin(uuid)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.is_organization_member(uuid, uuid)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.is_organization_admin(uuid, uuid)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.resolve_contract_org_id(uuid)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.resolve_team_org_id(uuid)', 'EXECUTE')
      AND NOT has_function_privilege('authenticated', 'public.resolve_project_org_id(uuid)', 'EXECUTE')
      AND has_function_privilege('service_role', 'public.is_platform_admin(uuid)', 'EXECUTE')
      AND has_function_privilege('service_role', 'public.is_organization_member(uuid, uuid)', 'EXECUTE')
      AND has_function_privilege('service_role', 'public.is_organization_admin(uuid, uuid)', 'EXECUTE')
      AND has_function_privilege('service_role', 'public.resolve_contract_org_id(uuid)', 'EXECUTE')
      AND has_function_privilege('service_role', 'public.resolve_team_org_id(uuid)', 'EXECUTE')
      AND has_function_privilege('service_role', 'public.resolve_project_org_id(uuid)', 'EXECUTE')
    ) AS internal_wrappers_secured,
    (
      has_function_privilege('authenticated', 'public.get_my_organizations_v2()', 'EXECUTE')
      AND has_function_privilege('authenticated', 'public.get_accessible_teams_v2(uuid)', 'EXECUTE')
      AND has_function_privilege('service_role', 'public.get_my_organizations_v2()', 'EXECUTE')
      AND has_function_privilege('service_role', 'public.get_accessible_teams_v2(uuid)', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.get_my_organizations_v2()', 'EXECUTE')
      AND NOT has_function_privilege('anon', 'public.get_accessible_teams_v2(uuid)', 'EXECUTE')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_proc proc
        JOIN pg_namespace namespace ON namespace.oid = proc.pronamespace
        CROSS JOIN LATERAL aclexplode(coalesce(proc.proacl, acldefault('f', proc.proowner))) acl
        WHERE namespace.nspname = 'public'
          AND proc.proname IN ('get_my_organizations_v2', 'get_accessible_teams_v2')
          AND acl.grantee = 0
          AND acl.privilege_type = 'EXECUTE'
      )
    ) AS tenant_rpcs_available,
    (
      current_setting('axionn.operation_2.tenancy_enforced', true) IS DISTINCT FROM 'true'
      AND (
        current_setting('axionn.operation_2.pre_saas_runtime_settings_exists', true) = 'true'
        OR to_regclass('public.saas_runtime_settings') IS NULL
      )
      AND (
        current_setting('axionn.operation_2.pre_is_tenancy_enforced_exists', true) = 'true'
        OR to_regprocedure('public.is_tenancy_enforced()') IS NULL
      )
      AND (
        current_setting('axionn.operation_2.pre_set_tenancy_enforcement_exists', true) = 'true'
        OR to_regprocedure('public.set_tenancy_enforcement(boolean)') IS NULL
      )
      AND (
        current_setting('axionn.operation_2.pre_tenant_boundary_exists', true) = 'true'
        OR NOT EXISTS (
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
        )
      )
      AND (
        current_setting('axionn.operation_2.pre_tenancy_trigger_exists', true) = 'true'
        OR NOT EXISTS (
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
        )
      )
    ) AS tenancy_enforcement_absent_or_disabled
)
SELECT
  companies_without_org,
  teams_without_org,
  projects_without_org,
  platform_admins,
  contract_company_org_mismatches,
  contract_team_org_mismatches,
  helper_uuid_removed,
  internal_wrappers_secured,
  tenant_rpcs_available,
  tenancy_enforcement_absent_or_disabled,
  (
    to_regclass('public.platform_user_roles') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'org_id'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'org_id'
    )
    AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'org_id'
    )
    AND contract_company_org_mismatches = 0
    AND helper_uuid_removed
    AND internal_wrappers_secured
    AND tenant_rpcs_available
    AND tenancy_enforcement_absent_or_disabled
  ) AS multitenant_foundation_ok
FROM final_checks;
