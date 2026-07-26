-- OKR V2 - hardening aditivo dos grants das RPCs de Objective.
-- As funcoes SECURITY DEFINER foram criadas antes deste ajuste; nao editar a
-- migration possivelmente aplicada. A regra e deny-by-default para anon/public.

begin;

revoke all on function public.create_okr_objective_v2(uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.update_okr_objective_v2(uuid, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function public.archive_okr_objective_v2(uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.create_okr_objective_v2(uuid, jsonb)
  to authenticated, service_role;
grant execute on function public.update_okr_objective_v2(uuid, uuid, jsonb)
  to authenticated, service_role;
grant execute on function public.archive_okr_objective_v2(uuid, uuid, text)
  to authenticated, service_role;

comment on function public.create_okr_objective_v2(uuid, jsonb) is
  'Cria Objective V2 via boundary autenticada; acesso publico e anonimo revogado.';
comment on function public.update_okr_objective_v2(uuid, uuid, jsonb) is
  'Atualiza Objective V2 via boundary autenticada; acesso publico e anonimo revogado.';
comment on function public.archive_okr_objective_v2(uuid, uuid, text) is
  'Arquiva Objective V2 via boundary autenticada; acesso publico e anonimo revogado.';

commit;
