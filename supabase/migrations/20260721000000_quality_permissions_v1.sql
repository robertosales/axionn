-- Axionn Quality Intelligence — Permissões granulares
-- Corrige: can_manage_quality aceita user_id externo, sem permissões funcionais
-- Executar exclusivamente pelo Lovable

begin;

-- ============================================================
-- 1. CADASTRO DE PERMISSÕES NO CATÁLOGO EXISTENTE
-- ============================================================

INSERT INTO public.app_permissions (key, label, group_key) VALUES
  ('view_quality', 'Visualizar módulo Qualidade', 'quality'),
  ('view_test_cases', 'Visualizar casos de teste', 'quality'),
  ('manage_test_cases', 'Gerenciar casos de teste', 'quality'),
  ('manage_test_suites', 'Gerenciar suítes de teste', 'quality'),
  ('manage_test_plans', 'Gerenciar planos de teste', 'quality'),
  ('execute_tests', 'Executar testes', 'quality'),
  ('manage_test_runs', 'Gerenciar execuções', 'quality'),
  ('manage_quality_findings', 'Gerenciar achados de qualidade', 'quality')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 2. SEED: Mapear permissões para papéis existentes
-- ============================================================

-- qa_analyst: todas as permissões do MVP
INSERT INTO public.role_permissions (role_name, permission_key) VALUES
  ('qa_analyst', 'view_quality'),
  ('qa_analyst', 'view_test_cases'),
  ('qa_analyst', 'manage_test_cases'),
  ('qa_analyst', 'manage_test_suites'),
  ('qa_analyst', 'manage_test_plans'),
  ('qa_analyst', 'execute_tests'),
  ('qa_analyst', 'manage_test_runs'),
  ('qa_analyst', 'manage_quality_findings')
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- product_owner: visualizar, planos, execuções e achados
INSERT INTO public.role_permissions (role_name, permission_key) VALUES
  ('product_owner', 'view_quality'),
  ('product_owner', 'view_test_cases'),
  ('product_owner', 'manage_test_plans'),
  ('product_owner', 'manage_test_runs'),
  ('product_owner', 'manage_quality_findings')
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- scrum_master: visualizar, planos, execuções e achados
INSERT INTO public.role_permissions (role_name, permission_key) VALUES
  ('scrum_master', 'view_quality'),
  ('scrum_master', 'view_test_cases'),
  ('scrum_master', 'manage_test_plans'),
  ('scrum_master', 'manage_test_runs'),
  ('scrum_master', 'manage_quality_findings')
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- developer, analyst, architect: visualizar e executar testes
INSERT INTO public.role_permissions (role_name, permission_key) VALUES
  ('developer', 'view_quality'),
  ('developer', 'view_test_cases'),
  ('developer', 'execute_tests'),
  ('analyst', 'view_quality'),
  ('analyst', 'view_test_cases'),
  ('analyst', 'execute_tests'),
  ('architect', 'view_quality'),
  ('architect', 'view_test_cases'),
  ('architect', 'execute_tests')
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- member: somente visualizar (quando autorizado ao módulo)
INSERT INTO public.role_permissions (role_name, permission_key) VALUES
  ('member', 'view_quality'),
  ('member', 'view_test_cases')
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- ============================================================
-- 3. FUNÇÃO CANÔNICA DE PERMISSÃO
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_quality_permission_v1(
  p_org_id uuid,
  p_permission text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS
$$
  -- bypass: platform admin
  SELECT coalesce(public.is_platform_admin(auth.uid()), false)
  OR coalesce(public.is_organization_admin(p_org_id, auth.uid()), false)
  OR EXISTS (
    SELECT 1
    FROM public.organization_member_modules m
    JOIN public.organization_members om USING(org_id, user_id)
    JOIN public.role_permissions rp ON rp.role_name = m.role_name
    WHERE m.org_id = p_org_id
      AND m.user_id = auth.uid()
      AND m.module_key = 'sala_agil'
      AND om.is_active
      AND rp.permission_key = p_permission
  )
$$;

-- ============================================================
-- 4. FUNÇÃO AUXILIAR PARA RLS
-- ============================================================

CREATE OR REPLACE FUNCTION public.can_read_quality(p_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp AS
$$
  SELECT public.can_quality_permission_v1(p_org_id, 'view_quality')
$$;

-- ============================================================
-- 5. REVOGAR ACESSO DA FUNÇÃO ANTIGA
-- ============================================================

REVOKE ALL ON FUNCTION public.can_manage_quality(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_quality(uuid, uuid) TO service_role;

-- ============================================================
-- 6. GRANTS MÍNIMOS PARA A NOVA FUNÇÃO
-- ============================================================

GRANT EXECUTE ON FUNCTION public.can_quality_permission_v1(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_quality(uuid) TO authenticated;

-- ============================================================
-- 7. RLS — TORNAR SELECT RESTRITIVO (exige view_quality)
-- ============================================================

-- Tabelas com coluna organization_id
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'quality_test_cases', 'quality_test_steps', 'quality_test_case_links',
    'quality_test_case_versions', 'quality_test_suites', 'quality_test_suite_items',
    'quality_test_plans', 'quality_test_plan_items',
    'quality_test_runs', 'quality_test_run_items', 'quality_test_step_results',
    'quality_test_evidences'
  ] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS sel_%s_tenant ON public.%I', t, t
    );
    EXECUTE format(
      'CREATE POLICY sel_%s_tenant ON public.%I FOR SELECT USING (public.can_read_quality(organization_id))',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- 8. COMENTÁRIOS
-- ============================================================

COMMENT ON FUNCTION public.can_quality_permission_v1(uuid, text)
  IS 'Autoridade de permissão de Qualidade. Resolve auth.uid(), nunca aceita user_id externo.';
COMMENT ON FUNCTION public.can_read_quality(uuid)
  IS 'Helper para RLS de leitura em tabelas de Qualidade.';
COMMENT ON FUNCTION public.can_manage_quality(uuid, uuid)
  IS 'OBSOLETO — substituído por can_quality_permission_v1. Mantido apenas para service_role.';

commit;
