-- PR 3 (OKR v2) — Ciclos: entidade, lifecycle, backfill e RPCs. Idempotente.
BEGIN;

CREATE TABLE IF NOT EXISTS public.okr_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  code text NOT NULL,
  name text NOT NULL,
  cycle_type text NOT NULL DEFAULT 'quarterly',
  starts_at date NOT NULL,
  ends_at date NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  status text NOT NULL DEFAULT 'planning',
  check_in_frequency text NOT NULL DEFAULT 'weekly',
  check_in_weekday smallint,
  check_in_grace_days integer NOT NULL DEFAULT 1,
  recommended_objectives_min integer,
  recommended_objectives_max integer,
  recommended_krs_min integer,
  recommended_krs_max integer,
  scoring_method text NOT NULL DEFAULT 'weighted_or_average',
  allow_overachievement boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closing_started_at timestamptz,
  closing_started_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  closed_at timestamptz,
  closed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancellation_reason text,
  archived_at timestamptz,
  archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT okr_cycles_dates_chk CHECK (starts_at <= ends_at),
  CONSTRAINT okr_cycles_status_chk CHECK (status IN ('planning','active','closing','closed','archived','cancelled')),
  CONSTRAINT okr_cycles_type_chk CHECK (cycle_type IN ('quarterly','annual','custom','monthly','biannual')),
  CONSTRAINT okr_cycles_cadence_chk CHECK (check_in_frequency IN ('daily','weekly','biweekly','monthly')),
  CONSTRAINT okr_cycles_scoring_chk CHECK (scoring_method IN ('weighted_or_average','simple_average','weighted_average')),
  CONSTRAINT okr_cycles_code_org_uk UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_okr_cycles_org_status ON public.okr_cycles(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_okr_cycles_org_period ON public.okr_cycles(organization_id, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_okr_cycles_active ON public.okr_cycles(organization_id) WHERE status = 'active';

GRANT SELECT ON public.okr_cycles TO authenticated;
GRANT ALL ON public.okr_cycles TO service_role;

ALTER TABLE public.okr_cycles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS okr_cycles_org_member_select ON public.okr_cycles;
CREATE POLICY okr_cycles_org_member_select ON public.okr_cycles
  FOR SELECT TO authenticated
  USING (public.is_organization_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS okr_cycles_service_all ON public.okr_cycles;
CREATE POLICY okr_cycles_service_all ON public.okr_cycles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.tg_okr_cycles_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_okr_cycles_touch ON public.okr_cycles;
CREATE TRIGGER trg_okr_cycles_touch BEFORE UPDATE ON public.okr_cycles
  FOR EACH ROW EXECUTE FUNCTION public.tg_okr_cycles_touch();

ALTER TABLE public.okr_objectives
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS cycle_id uuid REFERENCES public.okr_cycles(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_okr_objectives_org ON public.okr_objectives(organization_id);
CREATE INDEX IF NOT EXISTS idx_okr_objectives_cycle_id ON public.okr_objectives(cycle_id);

SET LOCAL session_replication_role = 'replica';

UPDATE public.okr_objectives o
   SET organization_id = COALESCE(t.org_id, public.resolve_team_org_id(t.id))
  FROM public.teams t
 WHERE o.team_id = t.id
   AND o.organization_id IS NULL
   AND COALESCE(t.org_id, public.resolve_team_org_id(t.id)) IS NOT NULL;

CREATE OR REPLACE FUNCTION public._okr_cycle_derive_period(_code text)
RETURNS TABLE(starts_at date, ends_at date, cycle_type text, display_name text)
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  q int; y int; m_ini int; m_fim int;
  norm text := upper(regexp_replace(coalesce(_code,''), '\s+', '', 'g'));
BEGIN
  IF norm ~ '^Q[1-4][/-][0-9]{4}$' THEN
    q := substring(norm from 2 for 1)::int;
    y := substring(norm from 4 for 4)::int;
    m_ini := (q - 1) * 3 + 1;
    m_fim := m_ini + 2;
    starts_at := make_date(y, m_ini, 1);
    ends_at := (make_date(y, m_fim, 1) + interval '1 month - 1 day')::date;
    cycle_type := 'quarterly';
    display_name := format('Q%s %s', q, y);
    RETURN NEXT;
  ELSIF norm ~ '^[0-9]{4}$' THEN
    y := norm::int;
    starts_at := make_date(y, 1, 1);
    ends_at := make_date(y, 12, 31);
    cycle_type := 'annual';
    display_name := norm;
    RETURN NEXT;
  ELSE
    starts_at := current_date;
    ends_at := current_date + 90;
    cycle_type := 'custom';
    display_name := coalesce(_code, 'Ciclo');
    RETURN NEXT;
  END IF;
END; $$;

DO $$
DECLARE r record; v_period record; v_cycle_id uuid; v_status text; v_code text;
BEGIN
  FOR r IN
    SELECT DISTINCT organization_id, cycle AS raw_code
      FROM public.okr_objectives
     WHERE organization_id IS NOT NULL AND cycle IS NOT NULL AND cycle_id IS NULL
  LOOP
    v_code := upper(regexp_replace(r.raw_code,'\s+','','g'));
    SELECT * INTO v_period FROM public._okr_cycle_derive_period(r.raw_code);
    v_status := CASE
      WHEN v_period.ends_at < current_date THEN 'closed'
      WHEN v_period.starts_at > current_date THEN 'planning'
      ELSE 'active'
    END;

    INSERT INTO public.okr_cycles(
      organization_id, code, name, cycle_type,
      starts_at, ends_at, status, published_at, closed_at
    ) VALUES (
      r.organization_id, v_code, v_period.display_name, v_period.cycle_type,
      v_period.starts_at, v_period.ends_at, v_status,
      CASE WHEN v_status IN ('active','closed') THEN now() END,
      CASE WHEN v_status = 'closed' THEN now() END
    ) ON CONFLICT (organization_id, code) DO NOTHING;

    SELECT id INTO v_cycle_id FROM public.okr_cycles
     WHERE organization_id = r.organization_id AND code = v_code;

    UPDATE public.okr_objectives
       SET cycle_id = v_cycle_id
     WHERE organization_id = r.organization_id AND cycle_id IS NULL
       AND upper(regexp_replace(cycle,'\s+','','g')) = v_code;
  END LOOP;
END; $$;

SET LOCAL session_replication_role = 'origin';

CREATE OR REPLACE FUNCTION public.tg_okr_objectives_sync_cycle_text()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_code text;
BEGIN
  IF NEW.cycle_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.cycle_id IS DISTINCT FROM OLD.cycle_id) THEN
    SELECT code INTO v_code FROM public.okr_cycles WHERE id = NEW.cycle_id;
    IF v_code IS NOT NULL THEN NEW.cycle := v_code; END IF;
  END IF;
  IF NEW.organization_id IS NULL AND NEW.team_id IS NOT NULL THEN
    SELECT COALESCE(t.org_id, public.resolve_team_org_id(t.id))
      INTO NEW.organization_id FROM public.teams t WHERE t.id = NEW.team_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_okr_objectives_sync_cycle_text ON public.okr_objectives;
CREATE TRIGGER trg_okr_objectives_sync_cycle_text
  BEFORE INSERT OR UPDATE OF cycle_id, organization_id, team_id ON public.okr_objectives
  FOR EACH ROW EXECUTE FUNCTION public.tg_okr_objectives_sync_cycle_text();

CREATE OR REPLACE FUNCTION public.create_okr_cycle_v1(p_org_id uuid, p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_code text := upper(regexp_replace(coalesce(p_payload->>'code',''), '\s+', '', 'g'));
  v_starts date := (p_payload->>'starts_at')::date;
  v_ends date := (p_payload->>'ends_at')::date;
BEGIN
  PERFORM public._okr_v2_guard(p_org_id, 'okr.cycle_management', 'okr.cycle_management');
  IF v_code = '' THEN RAISE EXCEPTION 'OKR_CYCLE_CODE_REQUIRED' USING ERRCODE='22023'; END IF;
  IF v_starts IS NULL OR v_ends IS NULL OR v_ends < v_starts THEN
    RAISE EXCEPTION 'OKR_CYCLE_INVALID_DATES' USING ERRCODE='22023';
  END IF;

  INSERT INTO public.okr_cycles(
    organization_id, code, name, cycle_type, starts_at, ends_at, timezone,
    check_in_frequency, check_in_weekday, check_in_grace_days,
    recommended_objectives_min, recommended_objectives_max,
    recommended_krs_min, recommended_krs_max,
    scoring_method, allow_overachievement, settings,
    status, created_by, updated_by
  ) VALUES (
    p_org_id, v_code, coalesce(p_payload->>'name', v_code),
    coalesce(p_payload->>'cycle_type', 'quarterly'), v_starts, v_ends,
    coalesce(p_payload->>'timezone', 'America/Sao_Paulo'),
    coalesce(p_payload->>'check_in_frequency', 'weekly'),
    (p_payload->>'check_in_weekday')::smallint,
    coalesce((p_payload->>'check_in_grace_days')::int, 1),
    (p_payload->>'recommended_objectives_min')::int,
    (p_payload->>'recommended_objectives_max')::int,
    (p_payload->>'recommended_krs_min')::int,
    (p_payload->>'recommended_krs_max')::int,
    coalesce(p_payload->>'scoring_method', 'weighted_or_average'),
    coalesce((p_payload->>'allow_overachievement')::boolean, true),
    coalesce(p_payload->'settings', '{}'::jsonb),
    'planning', auth.uid(), auth.uid()
  ) RETURNING id INTO v_id;

  INSERT INTO public.okr_audit_log(action, actor_id, metadata)
  VALUES ('cycle_created', auth.uid(), jsonb_build_object('cycle_id', v_id, 'organization_id', p_org_id, 'code', v_code));
  RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION public.update_okr_cycle_v1(p_cycle_id uuid, p_payload jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_before public.okr_cycles;
BEGIN
  SELECT * INTO v_before FROM public.okr_cycles WHERE id = p_cycle_id;
  IF v_before.id IS NULL THEN RAISE EXCEPTION 'OKR_CYCLE_NOT_FOUND' USING ERRCODE='02000'; END IF;
  PERFORM public._okr_v2_guard(v_before.organization_id, 'okr.cycle_management', 'okr.cycle_management');
  IF v_before.status NOT IN ('planning','active') THEN
    RAISE EXCEPTION 'OKR_CYCLE_LOCKED' USING ERRCODE='55000';
  END IF;

  UPDATE public.okr_cycles SET
    name = coalesce(p_payload->>'name', name),
    cycle_type = coalesce(p_payload->>'cycle_type', cycle_type),
    starts_at = coalesce((p_payload->>'starts_at')::date, starts_at),
    ends_at = coalesce((p_payload->>'ends_at')::date, ends_at),
    timezone = coalesce(p_payload->>'timezone', timezone),
    check_in_frequency = coalesce(p_payload->>'check_in_frequency', check_in_frequency),
    check_in_weekday = coalesce((p_payload->>'check_in_weekday')::smallint, check_in_weekday),
    check_in_grace_days = coalesce((p_payload->>'check_in_grace_days')::int, check_in_grace_days),
    recommended_objectives_min = coalesce((p_payload->>'recommended_objectives_min')::int, recommended_objectives_min),
    recommended_objectives_max = coalesce((p_payload->>'recommended_objectives_max')::int, recommended_objectives_max),
    recommended_krs_min = coalesce((p_payload->>'recommended_krs_min')::int, recommended_krs_min),
    recommended_krs_max = coalesce((p_payload->>'recommended_krs_max')::int, recommended_krs_max),
    scoring_method = coalesce(p_payload->>'scoring_method', scoring_method),
    allow_overachievement = coalesce((p_payload->>'allow_overachievement')::boolean, allow_overachievement),
    settings = coalesce(p_payload->'settings', settings),
    updated_by = auth.uid()
  WHERE id = p_cycle_id;

  INSERT INTO public.okr_audit_log(action, actor_id, metadata)
  VALUES ('cycle_updated', auth.uid(), jsonb_build_object('cycle_id', p_cycle_id));
END; $$;

CREATE OR REPLACE FUNCTION public.publish_okr_cycle_v1(p_cycle_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.okr_cycles;
BEGIN
  SELECT * INTO v_row FROM public.okr_cycles WHERE id = p_cycle_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'OKR_CYCLE_NOT_FOUND' USING ERRCODE='02000'; END IF;
  PERFORM public._okr_v2_guard(v_row.organization_id, 'okr.cycle_management', 'okr.cycle_management');
  IF v_row.status <> 'planning' THEN
    RAISE EXCEPTION 'OKR_CYCLE_INVALID_TRANSITION: publish requires planning (current=%)', v_row.status USING ERRCODE='55000';
  END IF;
  UPDATE public.okr_cycles SET status='active', published_at=now(), published_by=auth.uid(), updated_by=auth.uid() WHERE id = p_cycle_id;
  INSERT INTO public.okr_audit_log(action, actor_id, metadata) VALUES ('cycle_published', auth.uid(), jsonb_build_object('cycle_id', p_cycle_id));
END; $$;

CREATE OR REPLACE FUNCTION public.start_okr_cycle_closing_v1(p_cycle_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.okr_cycles;
BEGIN
  SELECT * INTO v_row FROM public.okr_cycles WHERE id = p_cycle_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'OKR_CYCLE_NOT_FOUND' USING ERRCODE='02000'; END IF;
  PERFORM public._okr_v2_guard(v_row.organization_id, 'okr.close_cycle', 'okr.cycle_management');
  IF v_row.status <> 'active' THEN
    RAISE EXCEPTION 'OKR_CYCLE_INVALID_TRANSITION: start_closing requires active (current=%)', v_row.status USING ERRCODE='55000';
  END IF;
  UPDATE public.okr_cycles SET status='closing', closing_started_at=now(), closing_started_by=auth.uid(), updated_by=auth.uid() WHERE id = p_cycle_id;
  INSERT INTO public.okr_audit_log(action, actor_id, metadata) VALUES ('cycle_closing_started', auth.uid(), jsonb_build_object('cycle_id', p_cycle_id));
END; $$;

CREATE OR REPLACE FUNCTION public.close_okr_cycle_v1(p_cycle_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.okr_cycles; v_open int;
BEGIN
  SELECT * INTO v_row FROM public.okr_cycles WHERE id = p_cycle_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'OKR_CYCLE_NOT_FOUND' USING ERRCODE='02000'; END IF;
  PERFORM public._okr_v2_guard(v_row.organization_id, 'okr.close_cycle', 'okr.cycle_management');
  IF v_row.status <> 'closing' THEN
    RAISE EXCEPTION 'OKR_CYCLE_INVALID_TRANSITION: close requires closing (current=%)', v_row.status USING ERRCODE='55000';
  END IF;
  SELECT count(*) INTO v_open FROM public.okr_objectives
   WHERE cycle_id = p_cycle_id AND coalesce(lifecycle_status,'active') IN ('active','under_review','paused');
  IF v_open > 0 THEN
    RAISE EXCEPTION 'OKR_CYCLE_HAS_OPEN_OBJECTIVES: % em aberto', v_open USING ERRCODE='55000';
  END IF;
  UPDATE public.okr_cycles SET status='closed', closed_at=now(), closed_by=auth.uid(), updated_by=auth.uid() WHERE id = p_cycle_id;
  INSERT INTO public.okr_audit_log(action, actor_id, metadata) VALUES ('cycle_closed', auth.uid(), jsonb_build_object('cycle_id', p_cycle_id));
END; $$;

CREATE OR REPLACE FUNCTION public.archive_okr_cycle_v1(p_cycle_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.okr_cycles;
BEGIN
  SELECT * INTO v_row FROM public.okr_cycles WHERE id = p_cycle_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'OKR_CYCLE_NOT_FOUND' USING ERRCODE='02000'; END IF;
  PERFORM public._okr_v2_guard(v_row.organization_id, 'okr.cycle_management', 'okr.cycle_management');
  IF v_row.status NOT IN ('closed','cancelled') THEN
    RAISE EXCEPTION 'OKR_CYCLE_INVALID_TRANSITION: archive requires closed/cancelled (current=%)', v_row.status USING ERRCODE='55000';
  END IF;
  UPDATE public.okr_cycles SET status='archived', archived_at=now(), archived_by=auth.uid(), updated_by=auth.uid() WHERE id = p_cycle_id;
  INSERT INTO public.okr_audit_log(action, actor_id, metadata) VALUES ('cycle_archived', auth.uid(), jsonb_build_object('cycle_id', p_cycle_id));
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_okr_cycle_v1(p_cycle_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row public.okr_cycles;
BEGIN
  SELECT * INTO v_row FROM public.okr_cycles WHERE id = p_cycle_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'OKR_CYCLE_NOT_FOUND' USING ERRCODE='02000'; END IF;
  PERFORM public._okr_v2_guard(v_row.organization_id, 'okr.cycle_management', 'okr.cycle_management');
  IF v_row.status NOT IN ('planning','active') THEN
    RAISE EXCEPTION 'OKR_CYCLE_INVALID_TRANSITION: cancel requires planning/active (current=%)', v_row.status USING ERRCODE='55000';
  END IF;
  IF coalesce(trim(p_reason),'') = '' THEN
    RAISE EXCEPTION 'OKR_CYCLE_CANCELLATION_REASON_REQUIRED' USING ERRCODE='22023';
  END IF;
  UPDATE public.okr_cycles SET status='cancelled', cancelled_at=now(), cancelled_by=auth.uid(),
    cancellation_reason=p_reason, updated_by=auth.uid() WHERE id = p_cycle_id;
  INSERT INTO public.okr_audit_log(action, actor_id, metadata)
  VALUES ('cycle_cancelled', auth.uid(), jsonb_build_object('cycle_id', p_cycle_id, 'reason', p_reason));
END; $$;

CREATE OR REPLACE FUNCTION public.list_okr_cycles_v1(p_org_id uuid)
RETURNS TABLE(
  id uuid, code text, name text, cycle_type text, status text,
  starts_at date, ends_at date, timezone text,
  check_in_frequency text, scoring_method text,
  published_at timestamptz, closed_at timestamptz, archived_at timestamptz,
  objectives_count bigint, created_at timestamptz, updated_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_organization_member(auth.uid(), p_org_id) THEN
    RAISE EXCEPTION 'OKR_V2_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  RETURN QUERY
    SELECT c.id, c.code, c.name, c.cycle_type, c.status, c.starts_at, c.ends_at,
           c.timezone, c.check_in_frequency, c.scoring_method,
           c.published_at, c.closed_at, c.archived_at,
           (SELECT count(*) FROM public.okr_objectives o WHERE o.cycle_id = c.id),
           c.created_at, c.updated_at
      FROM public.okr_cycles c
     WHERE c.organization_id = p_org_id
     ORDER BY c.starts_at DESC, c.created_at DESC;
END; $$;

REVOKE ALL ON FUNCTION public.create_okr_cycle_v1(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_okr_cycle_v1(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_okr_cycle_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.start_okr_cycle_closing_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.close_okr_cycle_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_okr_cycle_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_okr_cycle_v1(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_okr_cycles_v1(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_okr_cycle_v1(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_okr_cycle_v1(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.publish_okr_cycle_v1(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.start_okr_cycle_closing_v1(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_okr_cycle_v1(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.archive_okr_cycle_v1(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_okr_cycle_v1(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_okr_cycles_v1(uuid) TO authenticated, service_role;

COMMIT;