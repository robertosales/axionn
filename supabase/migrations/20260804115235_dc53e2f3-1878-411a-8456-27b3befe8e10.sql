GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
GRANT SELECT ON public.app_roles TO authenticated;
GRANT ALL ON public.app_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_connections TO authenticated;
GRANT ALL ON public.meeting_connections TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_meetings TO authenticated;
GRANT ALL ON public.external_meetings TO service_role;