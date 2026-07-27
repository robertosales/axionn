
-- ============================================================================
-- PR 4 — Objectives v2 + Alinhamentos
-- ============================================================================

-- 1. Extensão da tabela okr_objectives -------------------------------------
ALTER TABLE public.okr_objectives
  ADD COLUMN IF NOT EXISTS sponsor_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS objective_level      text NOT NULL DEFAULT 'team',
  ADD COLUMN IF NOT EXISTS parent_objective_id  uuid REFERENCES public.okr_objectives(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quality_score        numeric,
  ADD COLUMN IF NOT EXISTS quality_status       text,
  ADD COLUMN IF NOT EXISTS quality_issues       jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at         timestamptz,
  ADD COLUMN IF NOT EXISTS published_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paused_at            timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at         timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason  text,
  ADD COLUMN IF NOT EXISTS review_started_at    timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at         timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at          timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version              integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS lock_version         integer NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.okr_objectives'::regclass
      AND conname  = 'okr_objectives_level_check'
  ) THEN
    ALTER TABLE public.okr_objectives
      ADD CONSTRAINT okr_objectives_level_check
      CHECK (objective_level IN ('organizational','portfolio','product','contract','project','team'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.okr_objectives'::regclass
      AND conname  = 'okr_objectives_lifecycle_check_v2'
  ) THEN
    ALTER TABLE public.okr_objectives
      ADD CONSTRAINT okr_objectives_lifecycle_check_v2
      CHECK (lifecycle_status IN ('draft','ready','active','paused','cancelled','completed','archived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_okr_objectives_org_cycle
  ON public.okr_objectives (organization_id, cycle_id);
CREATE INDEX IF NOT EXISTS idx_okr_objectives_parent
  ON public.okr_objectives (parent_objective_id)
  WHERE parent_objective_id IS NOT NULL;

-- 2. Nova tabela okr_objective_alignments ----------------------------------
CREATE TABLE IF NOT EXISTS public.okr_objective_alignments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id        uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  source_objective_id    uuid NOT NULL REFERENCES public.okr_objectives(id) ON DELETE RESTRICT,
  target_objective_id    uuid NOT NULL REFERENCES public.okr_objectives(id) ON DELETE RESTRICT,
  alignment_type         text NOT NULL,
  contribution_weight    numeric,
  rationale              text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  created_by             uuid NOT NULL,
  archived_at            timestamptz,
  archived_by            uuid,
  CONSTRAINT okr_alignment_no_self CHECK (source_objective_id <> target_objective_id),
  CONSTRAINT okr_alignment_type_check
    CHECK (alignment_type IN ('contributes_to','supports','depends_on','conflicts_with')),
  CONSTRAINT okr_alignment_weight_check
    CHECK (contribution_weight IS NULL OR (contribution_weight >= 0 AND contribution_weight <= 100))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_okr_alignment_unique_active
  ON public.okr_objective_alignments (source_objective_id, target_objective_id, alignment_type)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_okr_alignment_target
  ON public.okr_objective_alignments (target_objective_id)
  WHERE archived_at IS NULL;

GRANT SELECT ON public.okr_objective_alignments TO authenticated;
GRANT ALL    ON public.okr_objective_alignments TO service_role;

ALTER TABLE public.okr_objective_alignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS okr_alignments_select ON public.okr_objective_alignments;
CREATE POLICY okr_alignments_select
  ON public.okr_objective_alignments
  FOR SELECT
  TO authenticated
  USING (public.is_organization_member(auth.uid(), organization_id));

-- Escrita somente via RPC (service_role).

-- 3. Helper: assert cycle aberto e mesma org -------------------------------
CREATE OR REPLACE FUNCTION public._okr_assert_cycle_open(
  _org_id uuid, _cycle_id uuid
) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_status text; v_org uuid;
BEGIN
  SELECT status, organization_id INTO v_status, v_org
  FROM public.okr_cycles WHERE id = _cycle_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'OKR_V2_CYCLE_NOT_FOUND' USING ERRCODE = '22023';
  END IF;
  IF v_org <> _org_id THEN
    RAISE EXCEPTION 'OKR_V2_CYCLE_ORG_MISMATCH' USING ERRCODE = '42501';
  END IF;
  IF v_status NOT IN ('planning','active') THEN
    RAISE EXCEPTION 'OKR_V2_CYCLE_NOT_OPEN: ciclo em % não aceita novos objetivos', v_status
      USING ERRCODE = '22023';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._okr_assert_cycle_open(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._okr_assert_cycle_open(uuid, uuid) TO authenticated, service_role;

-- 4. RPC create_okr_objective_v2 -------------------------------------------
CREATE OR REPLACE FUNCTION public.create_okr_objective_v2(
  p_org_id uuid,
  p_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id           uuid;
  v_cycle_id     uuid;
  v_title        text;
  v_description  text;
  v_team_id      uuid;
  v_owner_id     uuid;
  v_sponsor_id   uuid;
  v_level        text;
  v_scope_type   text;
  v_parent_id    uuid;
  v_start        date;
  v_end          date;
BEGIN
  PERFORM public._okr_v2_guard(p_org_id, 'okr.create');

  v_cycle_id    := NULLIF(p_payload->>'cycle_id','')::uuid;
  v_title       := trim(COALESCE(p_payload->>'title',''));
  v_description := p_payload->>'description';
  v_team_id     := NULLIF(p_payload->>'team_id','')::uuid;
  v_owner_id    := COALESCE(NULLIF(p_payload->>'owner_id','')::uuid, auth.uid());
  v_sponsor_id  := NULLIF(p_payload->>'sponsor_id','')::uuid;
  v_level       := COALESCE(NULLIF(p_payload->>'objective_level',''), 'team');
  v_scope_type  := COALESCE(NULLIF(p_payload->>'scope_type',''), v_level);
  v_parent_id   := NULLIF(p_payload->>'parent_objective_id','')::uuid;
  v_start       := NULLIF(p_payload->>'start_date','')::date;
  v_end         := NULLIF(p_payload->>'end_date','')::date;

  IF v_cycle_id IS NULL THEN
    RAISE EXCEPTION 'OKR_V2_CYCLE_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF v_title = '' THEN
    RAISE EXCEPTION 'OKR_V2_TITLE_REQUIRED' USING ERRCODE = '22023';
  END IF;

  PERFORM public._okr_assert_cycle_open(p_org_id, v_cycle_id);

  IF v_level = 'team' AND v_team_id IS NULL THEN
    RAISE EXCEPTION 'OKR_V2_TEAM_REQUIRED_FOR_TEAM_LEVEL' USING ERRCODE = '22023';
  END IF;

  IF v_parent_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.okr_objectives
      WHERE id = v_parent_id AND organization_id = p_org_id
    ) THEN
      RAISE EXCEPTION 'OKR_V2_PARENT_NOT_FOUND_OR_OTHER_ORG' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.okr_objectives (
    organization_id, cycle_id, cycle, title, description,
    team_id, owner_id, sponsor_id,
    objective_level, scope_type, parent_objective_id,
    start_date, end_date,
    lifecycle_status, status, progress, calculated_health,
    created_by, updated_by
  )
  SELECT
    p_org_id, v_cycle_id, c.code, v_title, v_description,
    v_team_id, v_owner_id, v_sponsor_id,
    v_level, v_scope_type, v_parent_id,
    v_start, v_end,
    'draft', 'on_track', 0, 'no_data',
    auth.uid(), auth.uid()
  FROM public.okr_cycles c
  WHERE c.id = v_cycle_id
  RETURNING id INTO v_id;

  INSERT INTO public.okr_audit_log
    (objective_id, actor_id, action, payload, created_at)
  VALUES (v_id, auth.uid(), 'objective.created',
          jsonb_build_object('cycle_id', v_cycle_id, 'title', v_title, 'level', v_level),
          now())
  ON CONFLICT DO NOTHING;

  RETURN v_id;
END;
$$;

-- 5. RPC update_okr_objective_v2 -------------------------------------------
CREATE OR REPLACE FUNCTION public.update_okr_objective_v2(
  p_org_id uuid,
  p_objective_id uuid,
  p_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_org          uuid;
  v_lock         integer;
  v_expected     integer;
  v_lifecycle    text;
BEGIN
  PERFORM public._okr_v2_guard(p_org_id, 'okr.edit');

  SELECT organization_id, lock_version, lifecycle_status
    INTO v_org, v_lock, v_lifecycle
  FROM public.okr_objectives
  WHERE id = p_objective_id
  FOR UPDATE;

  IF v_org IS NULL OR v_org <> p_org_id THEN
    RAISE EXCEPTION 'OKR_V2_OBJECTIVE_NOT_FOUND' USING ERRCODE = '22023';
  END IF;
  IF v_lifecycle IN ('archived','cancelled') THEN
    RAISE EXCEPTION 'OKR_V2_OBJECTIVE_LOCKED: lifecycle=%', v_lifecycle
      USING ERRCODE = '42501';
  END IF;

  v_expected := NULLIF(p_payload->>'lock_version','')::integer;
  IF v_expected IS NOT NULL AND v_expected <> v_lock THEN
    RAISE EXCEPTION 'OKR_V2_LOCK_CONFLICT: esperado=%, atual=%', v_expected, v_lock
      USING ERRCODE = '40001';
  END IF;

  UPDATE public.okr_objectives SET
    title             = COALESCE(NULLIF(p_payload->>'title',''), title),
    description       = COALESCE(p_payload->>'description', description),
    owner_id          = COALESCE(NULLIF(p_payload->>'owner_id','')::uuid, owner_id),
    sponsor_id        = CASE WHEN p_payload ? 'sponsor_id'
                             THEN NULLIF(p_payload->>'sponsor_id','')::uuid
                             ELSE sponsor_id END,
    team_id           = CASE WHEN p_payload ? 'team_id'
                             THEN NULLIF(p_payload->>'team_id','')::uuid
                             ELSE team_id END,
    objective_level   = COALESCE(NULLIF(p_payload->>'objective_level',''), objective_level),
    scope_type        = COALESCE(NULLIF(p_payload->>'scope_type',''), scope_type),
    parent_objective_id = CASE WHEN p_payload ? 'parent_objective_id'
                             THEN NULLIF(p_payload->>'parent_objective_id','')::uuid
                             ELSE parent_objective_id END,
    start_date        = CASE WHEN p_payload ? 'start_date'
                             THEN NULLIF(p_payload->>'start_date','')::date
                             ELSE start_date END,
    end_date          = CASE WHEN p_payload ? 'end_date'
                             THEN NULLIF(p_payload->>'end_date','')::date
                             ELSE end_date END,
    manual_health_override = CASE WHEN p_payload ? 'manual_health_override'
                             THEN NULLIF(p_payload->>'manual_health_override','')
                             ELSE manual_health_override END,
    health_override_reason = CASE WHEN p_payload ? 'health_override_reason'
                             THEN p_payload->>'health_override_reason'
                             ELSE health_override_reason END,
    lock_version      = lock_version + 1,
    version           = version + 1,
    updated_by        = auth.uid(),
    updated_at        = now()
  WHERE id = p_objective_id;

  INSERT INTO public.okr_audit_log
    (objective_id, actor_id, action, payload, created_at)
  VALUES (p_objective_id, auth.uid(), 'objective.updated', p_payload, now())
  ON CONFLICT DO NOTHING;

  RETURN p_objective_id;
END;
$$;

-- 6. RPC publish_okr_objective_v2 ------------------------------------------
CREATE OR REPLACE FUNCTION public.publish_okr_objective_v2(
  p_org_id uuid,
  p_objective_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_owner uuid; v_lifecycle text; v_org uuid; v_cycle_status text;
BEGIN
  PERFORM public._okr_v2_guard(p_org_id, 'okr.edit');

  SELECT o.organization_id, o.owner_id, o.lifecycle_status, c.status
    INTO v_org, v_owner, v_lifecycle, v_cycle_status
  FROM public.okr_objectives o
  LEFT JOIN public.okr_cycles c ON c.id = o.cycle_id
  WHERE o.id = p_objective_id
  FOR UPDATE;

  IF v_org IS NULL OR v_org <> p_org_id THEN
    RAISE EXCEPTION 'OKR_V2_OBJECTIVE_NOT_FOUND' USING ERRCODE = '22023';
  END IF;
  IF v_lifecycle NOT IN ('draft','ready') THEN
    RAISE EXCEPTION 'OKR_V2_OBJECTIVE_ALREADY_PUBLISHED: lifecycle=%', v_lifecycle
      USING ERRCODE = '22023';
  END IF;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'OKR_V2_OWNER_REQUIRED_FOR_PUBLISH' USING ERRCODE = '22023';
  END IF;
  IF v_cycle_status NOT IN ('planning','active') THEN
    RAISE EXCEPTION 'OKR_V2_CYCLE_NOT_OPEN: %', v_cycle_status USING ERRCODE = '22023';
  END IF;

  UPDATE public.okr_objectives SET
    lifecycle_status = 'active',
    published_at     = now(),
    published_by     = auth.uid(),
    lock_version     = lock_version + 1,
    updated_by       = auth.uid(),
    updated_at       = now()
  WHERE id = p_objective_id;

  INSERT INTO public.okr_audit_log
    (objective_id, actor_id, action, payload, created_at)
  VALUES (p_objective_id, auth.uid(), 'objective.published', '{}'::jsonb, now())
  ON CONFLICT DO NOTHING;

  RETURN p_objective_id;
END;
$$;

-- 7. RPC archive_okr_objective_v2 (implementação real) --------------------
CREATE OR REPLACE FUNCTION public.archive_okr_objective_v2(
  p_org_id uuid,
  p_objective_id uuid,
  p_reason text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org uuid; v_lifecycle text;
BEGIN
  PERFORM public._okr_v2_guard(p_org_id, 'okr.archive');

  SELECT organization_id, lifecycle_status INTO v_org, v_lifecycle
  FROM public.okr_objectives WHERE id = p_objective_id FOR UPDATE;

  IF v_org IS NULL OR v_org <> p_org_id THEN
    RAISE EXCEPTION 'OKR_V2_OBJECTIVE_NOT_FOUND' USING ERRCODE = '22023';
  END IF;
  IF v_lifecycle = 'archived' THEN
    RETURN p_objective_id;
  END IF;

  UPDATE public.okr_objectives SET
    lifecycle_status = 'archived',
    archived_at      = now(),
    archived_by      = auth.uid(),
    lock_version     = lock_version + 1,
    updated_by       = auth.uid(),
    updated_at       = now()
  WHERE id = p_objective_id;

  UPDATE public.okr_objective_alignments
    SET archived_at = now(), archived_by = auth.uid()
    WHERE archived_at IS NULL
      AND (source_objective_id = p_objective_id OR target_objective_id = p_objective_id);

  INSERT INTO public.okr_audit_log
    (objective_id, actor_id, action, payload, created_at)
  VALUES (p_objective_id, auth.uid(), 'objective.archived',
          jsonb_build_object('reason', p_reason), now())
  ON CONFLICT DO NOTHING;

  RETURN p_objective_id;
END;
$$;

-- 8. RPC list_okr_objectives_v2 --------------------------------------------
CREATE OR REPLACE FUNCTION public.list_okr_objectives_v2(
  p_org_id uuid,
  p_cycle_id uuid DEFAULT NULL,
  p_include_archived boolean DEFAULT false
) RETURNS TABLE(
  id uuid,
  organization_id uuid,
  cycle_id uuid,
  cycle_code text,
  title text,
  description text,
  team_id uuid,
  team_name text,
  owner_id uuid,
  sponsor_id uuid,
  objective_level text,
  scope_type text,
  parent_objective_id uuid,
  lifecycle_status text,
  status text,
  progress integer,
  calculated_progress numeric,
  calculated_health text,
  start_date date,
  end_date date,
  published_at timestamptz,
  archived_at timestamptz,
  lock_version integer,
  version integer,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public._okr_v2_guard(p_org_id, 'okr.view');

  RETURN QUERY
  SELECT
    o.id, o.organization_id, o.cycle_id, c.code,
    o.title, o.description, o.team_id, t.name,
    o.owner_id, o.sponsor_id, o.objective_level, o.scope_type,
    o.parent_objective_id, o.lifecycle_status, o.status, o.progress,
    o.calculated_progress, o.calculated_health,
    o.start_date, o.end_date, o.published_at, o.archived_at,
    o.lock_version, o.version, o.created_at, o.updated_at
  FROM public.okr_objectives o
  LEFT JOIN public.okr_cycles c ON c.id = o.cycle_id
  LEFT JOIN public.teams t      ON t.id = o.team_id
  WHERE o.organization_id = p_org_id
    AND (p_cycle_id IS NULL OR o.cycle_id = p_cycle_id)
    AND (p_include_archived OR o.lifecycle_status <> 'archived')
  ORDER BY o.lifecycle_status, o.created_at DESC;
END;
$$;

-- 9. Alinhamentos -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_okr_alignment_v1(
  p_org_id uuid,
  p_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_source uuid; v_target uuid; v_type text; v_weight numeric; v_rationale text;
  v_id uuid; v_source_org uuid; v_target_org uuid; v_cycle boolean;
BEGIN
  PERFORM public._okr_v2_guard(p_org_id, 'okr.alignments', 'okr.alignments');

  v_source    := NULLIF(p_payload->>'source_objective_id','')::uuid;
  v_target    := NULLIF(p_payload->>'target_objective_id','')::uuid;
  v_type      := COALESCE(NULLIF(p_payload->>'alignment_type',''), 'contributes_to');
  v_weight    := NULLIF(p_payload->>'contribution_weight','')::numeric;
  v_rationale := p_payload->>'rationale';

  IF v_source IS NULL OR v_target IS NULL THEN
    RAISE EXCEPTION 'OKR_V2_ALIGNMENT_ENDPOINTS_REQUIRED' USING ERRCODE = '22023';
  END IF;
  IF v_source = v_target THEN
    RAISE EXCEPTION 'OKR_V2_ALIGNMENT_SELF' USING ERRCODE = '22023';
  END IF;

  SELECT organization_id INTO v_source_org FROM public.okr_objectives WHERE id = v_source;
  SELECT organization_id INTO v_target_org FROM public.okr_objectives WHERE id = v_target;

  IF v_source_org IS NULL OR v_target_org IS NULL THEN
    RAISE EXCEPTION 'OKR_V2_ALIGNMENT_OBJECTIVE_NOT_FOUND' USING ERRCODE = '22023';
  END IF;
  IF v_source_org <> p_org_id OR v_target_org <> p_org_id THEN
    RAISE EXCEPTION 'OKR_V2_ALIGNMENT_ORG_MISMATCH' USING ERRCODE = '42501';
  END IF;

  -- Detecta ciclo apenas para relações hierárquicas (contributes_to/supports).
  IF v_type IN ('contributes_to','supports') THEN
    WITH RECURSIVE chain AS (
      SELECT target_objective_id AS node
        FROM public.okr_objective_alignments
       WHERE source_objective_id = v_target
         AND archived_at IS NULL
         AND alignment_type IN ('contributes_to','supports')
      UNION
      SELECT a.target_objective_id
        FROM public.okr_objective_alignments a
        JOIN chain c ON c.node = a.source_objective_id
       WHERE a.archived_at IS NULL
         AND a.alignment_type IN ('contributes_to','supports')
    )
    SELECT EXISTS(SELECT 1 FROM chain WHERE node = v_source) INTO v_cycle;
    IF v_cycle THEN
      RAISE EXCEPTION 'OKR_V2_ALIGNMENT_CYCLE' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.okr_objective_alignments
    (organization_id, source_objective_id, target_objective_id,
     alignment_type, contribution_weight, rationale, created_by)
  VALUES (p_org_id, v_source, v_target, v_type, v_weight, v_rationale, auth.uid())
  RETURNING id INTO v_id;

  INSERT INTO public.okr_audit_log
    (objective_id, actor_id, action, payload, created_at)
  VALUES (v_source, auth.uid(), 'alignment.created',
          jsonb_build_object('target', v_target, 'type', v_type, 'weight', v_weight), now())
  ON CONFLICT DO NOTHING;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_okr_alignment_v1(
  p_org_id uuid,
  p_alignment_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_org uuid; v_src uuid;
BEGIN
  PERFORM public._okr_v2_guard(p_org_id, 'okr.alignments', 'okr.alignments');

  SELECT organization_id, source_objective_id INTO v_org, v_src
  FROM public.okr_objective_alignments WHERE id = p_alignment_id FOR UPDATE;

  IF v_org IS NULL OR v_org <> p_org_id THEN
    RAISE EXCEPTION 'OKR_V2_ALIGNMENT_NOT_FOUND' USING ERRCODE = '22023';
  END IF;

  UPDATE public.okr_objective_alignments
     SET archived_at = now(), archived_by = auth.uid()
   WHERE id = p_alignment_id AND archived_at IS NULL;

  INSERT INTO public.okr_audit_log
    (objective_id, actor_id, action, payload, created_at)
  VALUES (v_src, auth.uid(), 'alignment.archived',
          jsonb_build_object('alignment_id', p_alignment_id), now())
  ON CONFLICT DO NOTHING;

  RETURN p_alignment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_okr_alignments_v1(
  p_org_id uuid,
  p_objective_id uuid DEFAULT NULL
) RETURNS TABLE(
  id uuid,
  source_objective_id uuid,
  source_title text,
  target_objective_id uuid,
  target_title text,
  alignment_type text,
  contribution_weight numeric,
  rationale text,
  created_at timestamptz,
  created_by uuid
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public._okr_v2_guard(p_org_id, 'okr.view');

  RETURN QUERY
  SELECT a.id,
         a.source_objective_id, os.title,
         a.target_objective_id, ot.title,
         a.alignment_type, a.contribution_weight, a.rationale,
         a.created_at, a.created_by
  FROM public.okr_objective_alignments a
  JOIN public.okr_objectives os ON os.id = a.source_objective_id
  JOIN public.okr_objectives ot ON ot.id = a.target_objective_id
  WHERE a.organization_id = p_org_id
    AND a.archived_at IS NULL
    AND (p_objective_id IS NULL
         OR a.source_objective_id = p_objective_id
         OR a.target_objective_id = p_objective_id)
  ORDER BY a.created_at DESC;
END;
$$;

-- 10. GRANTS ---------------------------------------------------------------
REVOKE ALL ON FUNCTION public.publish_okr_objective_v2(uuid, uuid)                   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_okr_objectives_v2(uuid, uuid, boolean)            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_okr_alignment_v1(uuid, jsonb)                   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_okr_alignment_v1(uuid, uuid)                   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_okr_alignments_v1(uuid, uuid)                     FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.publish_okr_objective_v2(uuid, uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_okr_objectives_v2(uuid, uuid, boolean)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_okr_alignment_v1(uuid, jsonb)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_okr_alignment_v1(uuid, uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_okr_alignments_v1(uuid, uuid)                  TO authenticated;
