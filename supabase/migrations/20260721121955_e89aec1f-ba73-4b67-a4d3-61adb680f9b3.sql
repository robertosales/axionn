ALTER TABLE public.commercial_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commercial_audit_logs FROM anon, authenticated;
GRANT SELECT ON public.commercial_audit_logs TO authenticated;
GRANT ALL ON public.commercial_audit_logs TO service_role;

DROP POLICY IF EXISTS "commercial_audit_logs_select_platform_admin" ON public.commercial_audit_logs;
CREATE POLICY "commercial_audit_logs_select_platform_admin"
  ON public.commercial_audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "commercial_audit_logs_service_role_all" ON public.commercial_audit_logs;
CREATE POLICY "commercial_audit_logs_service_role_all"
  ON public.commercial_audit_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.organization_entitlement_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.organization_entitlement_cache FROM anon, authenticated;
GRANT SELECT ON public.organization_entitlement_cache TO authenticated;
GRANT ALL ON public.organization_entitlement_cache TO service_role;

DROP POLICY IF EXISTS "organization_entitlement_cache_select_members" ON public.organization_entitlement_cache;
CREATE POLICY "organization_entitlement_cache_select_members"
  ON public.organization_entitlement_cache FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = public.organization_entitlement_cache.org_id
        AND m.user_id = auth.uid()
        AND coalesce(m.is_active, true)
    )
  );

DROP POLICY IF EXISTS "organization_entitlement_cache_service_role_all" ON public.organization_entitlement_cache;
CREATE POLICY "organization_entitlement_cache_service_role_all"
  ON public.organization_entitlement_cache FOR ALL TO service_role
  USING (true) WITH CHECK (true);