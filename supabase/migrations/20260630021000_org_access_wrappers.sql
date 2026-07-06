-- Axion SaaS — Fase 1
-- Endurecimento das funções internas de autorização.
--
-- As assinaturas foram criadas anteriormente com auth.uid() como valor default.
-- PostgreSQL não permite remover esse default por CREATE OR REPLACE sem derrubar
-- a função e suas dependências. Em vez de usar CASCADE, mantemos as assinaturas
-- estáveis e retiramos sua execução direta do papel authenticated.
-- O frontend obtém o estado de acesso pelas RPCs tenant-scoped, como
-- get_my_organizations_v2(), sem informar user_id arbitrário.

revoke all on function public.is_platform_admin(uuid)
  from public, anon, authenticated;
revoke all on function public.is_organization_member(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.is_organization_admin(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.is_platform_admin(uuid) to service_role;
grant execute on function public.is_organization_member(uuid, uuid) to service_role;
grant execute on function public.is_organization_admin(uuid, uuid) to service_role;

comment on function public.is_platform_admin(uuid) is
  'Função interna de autorização. O usuário atual é resolvido pelas RPCs públicas tenant-scoped.';
comment on function public.is_organization_member(uuid, uuid) is
  'Função interna de membership; não aceita execução direta do frontend.';
comment on function public.is_organization_admin(uuid, uuid) is
  'Função interna de administração organizacional; não aceita execução direta do frontend.';
