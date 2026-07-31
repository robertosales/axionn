-- Corrige o contrato entre o guard compartilhado do OKR V2 e o resolvedor
-- canônico de entitlements. check_okr_limit_v1 retorna void e sinaliza
-- bloqueios por exceção; portanto, o chamador deve usar PERFORM.

begin;

create or replace function public._okr_v2_guard(
  _org_id uuid,
  _permission text,
  _entitlement text default null
) returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'OKR_V2_UNAUTHENTICATED' using errcode = '28000';
  end if;

  if not public.has_okr_permission_v2(auth.uid(), _permission, _org_id) then
    raise exception 'OKR_V2_FORBIDDEN: missing permission %', _permission
      using errcode = '42501';
  end if;

  if _entitlement is not null then
    perform public.check_okr_limit_v1(_org_id, _entitlement, 0);
  end if;
end;
$$;

revoke all on function public._okr_v2_guard(uuid, text, text)
  from public, anon;
grant execute on function public._okr_v2_guard(uuid, text, text)
  to authenticated, service_role;

comment on function public._okr_v2_guard(uuid, text, text) is
  'Valida autenticação, RBAC e entitlement OKR; check_okr_limit_v1 sinaliza bloqueios por exceção.';

notify pgrst, 'reload schema';

commit;
