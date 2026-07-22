-- PR 2 — OKR RBAC, RLS helper e esqueleto de RPCs
-- Idempotente. Nenhuma mutação direta é revogada nesta migration
-- (revogação acontece nos PRs 4-6, junto com a implementação das RPCs canônicas).

-- 1. Catálogo de permissões OKR --------------------------------------------
INSERT INTO public.app_permissions (key, label, group_key) VALUES
  ('okr.view',                'Visualizar OKRs',              'okr'),
  ('okr.create',              'Criar Objectives/KRs',         'okr'),
  ('okr.edit',                'Editar Objectives/KRs',        'okr'),
  ('okr.archive',             'Arquivar Objectives/KRs',      'okr'),
  ('okr.check_in',            'Registrar check-ins',          'okr'),
  ('okr.initiatives',         'Gerenciar iniciativas',        'okr'),
  ('okr.automatic_metrics',   'Configurar métricas automáticas','okr'),
  ('okr.history',             'Consultar histórico/snapshots','okr'),
  ('okr.export',              'Exportar OKRs',                'okr'),
  ('okr.alignments',          'Gerenciar alinhamentos',       'okr'),
  ('okr.cycle_management',    'Gerenciar ciclos',             'okr'),
  ('okr.executive_dashboard', 'Ver dashboard executivo',      'okr'),
  ('okr.advanced_alerts',     'Configurar alertas avançados', 'okr'),
  ('okr.ai_recommendations',  'Ver recomendações de IA',      'okr')
ON CONFLICT (key) DO UPDATE
  SET label = EXCLUDED.label,
      group_key = EXCLUDED.group_key;

-- 2. Mapeamento role → permissão -------------------------------------------
-- admin  : tudo
-- product_owner / scrum_master : criar/editar/arquivar/check-in/iniciativas/histórico/export/alignments
-- developer / analyst / architect / qa_analyst / member : view + check_in + history
INSERT INTO public.role_permissions (role_name, permission_key)
SELECT r, p FROM (VALUES
  ('admin','okr.view'),('admin','okr.create'),('admin','okr.edit'),('admin','okr.archive'),
  ('admin','okr.check_in'),('admin','okr.initiatives'),('admin','okr.automatic_metrics'),
  ('admin','okr.history'),('admin','okr.export'),('admin','okr.alignments'),
  ('admin','okr.cycle_management'),('admin','okr.executive_dashboard'),
  ('admin','okr.advanced_alerts'),('admin','okr.ai_recommendations'),

  ('product_owner','okr.view'),('product_owner','okr.create'),('product_owner','okr.edit'),
  ('product_owner','okr.archive'),('product_owner','okr.check_in'),
  ('product_owner','okr.initiatives'),('product_owner','okr.history'),
  ('product_owner','okr.export'),('product_owner','okr.alignments'),
  ('product_owner','okr.executive_dashboard'),

  ('scrum_master','okr.view'),('scrum_master','okr.create'),('scrum_master','okr.edit'),
  ('scrum_master','okr.archive'),('scrum_master','okr.check_in'),
  ('scrum_master','okr.initiatives'),('scrum_master','okr.history'),
  ('scrum_master','okr.export'),('scrum_master','okr.alignments'),
  ('scrum_master','okr.executive_dashboard'),

  ('developer','okr.view'),('developer','okr.check_in'),('developer','okr.history'),
  ('analyst','okr.view'),('analyst','okr.check_in'),('analyst','okr.history'),
  ('architect','okr.view'),('architect','okr.check_in'),('architect','okr.history'),
  ('qa_analyst','okr.view'),('qa_analyst','okr.check_in'),('qa_analyst','okr.history'),
  ('member','okr.view'),('member','okr.check_in'),('member','okr.history')
) AS v(r,p)
ON CONFLICT DO NOTHING;

-- 3. Helper canônico: has_okr_permission_v2 -------------------------------
-- Verifica se o usuário possui a permissão OKR dentro do escopo da organização.
-- Combina: (a) membership ativa na organização, (b) role com a permissão,
-- (c) entitlement do plano quando aplicável (via check_okr_limit_v1 apenas para
-- capacidades gated; view/create/edit/archive/check_in não exigem entitlement adicional).
CREATE OR REPLACE FUNCTION public.has_okr_permission_v2(
  _user_id uuid,
  _permission text,
  _org_id uuid
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_member boolean := false;
  v_has_role  boolean := false;
BEGIN
  IF _user_id IS NULL OR _permission IS NULL OR _org_id IS NULL THEN
    RETURN false;
  END IF;

  -- (a) usuário deve ser membro ativo da organização
  SELECT public.is_organization_member(_user_id, _org_id) INTO v_is_member;
  IF NOT v_is_member THEN
    RETURN false;
  END IF;

  -- (b) alguma role do usuário (em qualquer time da org) concede a permissão
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.team_members tm ON tm.user_id = ur.user_id
    JOIN public.teams t         ON t.id = tm.team_id
    JOIN public.role_permissions rp ON rp.role_name = ur.role::text
    WHERE ur.user_id = _user_id
      AND rp.permission_key = _permission
      AND COALESCE(t.org_id, public.resolve_team_org_id(t.id)) = _org_id
  ) INTO v_has_role;

  RETURN v_has_role;
END;
$$;

REVOKE ALL ON FUNCTION public.has_okr_permission_v2(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_okr_permission_v2(uuid, text, uuid) TO authenticated, service_role;

-- 4. Esqueleto de RPCs canônicas ------------------------------------------
-- Assinatura estável para uso a partir do frontend. Cada RPC hoje valida
-- permissão + entitlement e sinaliza NOT_IMPLEMENTED; a implementação real
-- entra nos PRs 4-6 (objectives, KRs, check-ins).
CREATE OR REPLACE FUNCTION public._okr_v2_guard(
  _org_id uuid,
  _permission text,
  _entitlement text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'OKR_V2_UNAUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  IF NOT public.has_okr_permission_v2(auth.uid(), _permission, _org_id) THEN
    RAISE EXCEPTION 'OKR_V2_FORBIDDEN: missing permission %', _permission
      USING ERRCODE = '42501';
  END IF;

  IF _entitlement IS NOT NULL THEN
    -- check_okr_limit_v1 valida o entitlement (retorna allowed=false quando faltar).
    IF NOT COALESCE(
      (SELECT allowed FROM public.check_okr_limit_v1(_org_id, _entitlement, 0)),
      false
    ) THEN
      RAISE EXCEPTION 'OKR_V2_ENTITLEMENT_MISSING: %', _entitlement
        USING ERRCODE = '42501';
    END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._okr_v2_guard(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._okr_v2_guard(uuid, text, text) TO authenticated, service_role;

-- --- Objectives -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_okr_objective_v2(
  p_org_id uuid,
  p_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._okr_v2_guard(p_org_id, 'okr.create');
  RAISE EXCEPTION 'OKR_V2_NOT_IMPLEMENTED: create_okr_objective_v2 será implementada no PR 4'
    USING ERRCODE = '0A000';
END;
$$;

CREATE OR REPLACE FUNCTION public.update_okr_objective_v2(
  p_org_id uuid,
  p_objective_id uuid,
  p_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._okr_v2_guard(p_org_id, 'okr.edit');
  RAISE EXCEPTION 'OKR_V2_NOT_IMPLEMENTED: update_okr_objective_v2 será implementada no PR 4'
    USING ERRCODE = '0A000';
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_okr_objective_v2(
  p_org_id uuid,
  p_objective_id uuid,
  p_reason text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._okr_v2_guard(p_org_id, 'okr.archive');
  RAISE EXCEPTION 'OKR_V2_NOT_IMPLEMENTED: archive_okr_objective_v2 será implementada no PR 4'
    USING ERRCODE = '0A000';
END;
$$;

-- --- Key results ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_okr_key_result_v2(
  p_org_id uuid,
  p_objective_id uuid,
  p_payload jsonb,
  p_key_result_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._okr_v2_guard(
    p_org_id,
    CASE WHEN p_key_result_id IS NULL THEN 'okr.create' ELSE 'okr.edit' END
  );
  RAISE EXCEPTION 'OKR_V2_NOT_IMPLEMENTED: upsert_okr_key_result_v2 será implementada no PR 5'
    USING ERRCODE = '0A000';
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_okr_key_result_v2(
  p_org_id uuid,
  p_key_result_id uuid,
  p_reason text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._okr_v2_guard(p_org_id, 'okr.archive');
  RAISE EXCEPTION 'OKR_V2_NOT_IMPLEMENTED: archive_okr_key_result_v2 será implementada no PR 5'
    USING ERRCODE = '0A000';
END;
$$;

-- --- Check-in -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_okr_check_in_v2(
  p_org_id uuid,
  p_key_result_id uuid,
  p_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._okr_v2_guard(p_org_id, 'okr.check_in');
  RAISE EXCEPTION 'OKR_V2_NOT_IMPLEMENTED: record_okr_check_in_v2 será implementada no PR 6'
    USING ERRCODE = '0A000';
END;
$$;

REVOKE ALL ON FUNCTION public.create_okr_objective_v2(uuid, jsonb)             FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_okr_objective_v2(uuid, uuid, jsonb)       FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_okr_objective_v2(uuid, uuid, text)       FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_okr_key_result_v2(uuid, uuid, jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_okr_key_result_v2(uuid, uuid, text)      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_okr_check_in_v2(uuid, uuid, jsonb)        FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_okr_objective_v2(uuid, jsonb)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_okr_objective_v2(uuid, uuid, jsonb)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_okr_objective_v2(uuid, uuid, text)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_okr_key_result_v2(uuid, uuid, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_okr_key_result_v2(uuid, uuid, text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_okr_check_in_v2(uuid, uuid, jsonb)         TO authenticated;

-- 5. Auto-fix: contract_room_teams — remover SELECT aberto a qualquer autenticado
DROP POLICY IF EXISTS crt_members_select ON public.contract_room_teams;
CREATE POLICY crt_members_select ON public.contract_room_teams
  FOR SELECT
  TO authenticated
  USING (
    public.is_team_member(auth.uid(), team_id)
    OR EXISTS (
      SELECT 1 FROM public.contracts c
      WHERE c.id = contract_room_teams.contract_id
        AND public.is_organization_member(auth.uid(), c.org_id)
        AND public.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- 6. Auto-fix: tabelas de sync (git/deploy/risk/incident) — restringir ALL a service_role
DO $$
DECLARE
  t text;
  polrec record;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'deployment_events','git_branches','git_commits','git_merge_requests','hu_git_links',
    'gitlab_job_events','gitlab_deployment_events','gitlab_pipeline_events',
    'incident_events','dora_metrics_snapshots','sprint_risk_events',
    'risk_model_versions','risk_training_data','redmine_issue_links'
  ]) LOOP
    FOR polrec IN
      SELECT polname
      FROM pg_policies pp
      JOIN pg_policy pol ON pol.polname = pp.policyname
      JOIN pg_class c ON c.oid = pol.polrelid
      WHERE pp.schemaname = 'public'
        AND pp.tablename = t
        AND pp.cmd = 'ALL'
        AND 'public' = ANY(pp.roles)
        AND pp.qual = 'true'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', polrec.polname, t);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        polrec.polname, t
      );
    END LOOP;
  END LOOP;
END $$;