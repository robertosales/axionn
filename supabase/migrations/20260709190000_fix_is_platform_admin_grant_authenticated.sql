-- Migration: fix is_platform_admin GRANT
-- Problema: HTTP 403 ao chamar /rest/v1/rpc/is_platform_admin
--   code: '42501' - permission denied for function is_platform_admin
-- Causa: em algum ponto do historico de migrations/operations o GRANT
--   para o role 'authenticated' foi removido ou nao aplicado.
-- Solucao: regarantir o GRANT de forma idempotente.

REVOKE ALL ON FUNCTION public.is_platform_admin(uuid)
  FROM public, anon;

GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid)
  TO authenticated, service_role;
