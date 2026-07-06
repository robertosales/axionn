-- Axionn - hotfix de permissões organizacionais
--
-- O runtime organizacional já controla acesso aos módulos, mas o frontend ainda
-- resolve as permissões granulares (create_sprint, edit_backlog, update_tasks,
-- etc.) pelo catálogo legado user_roles/role_permissions. Desligar o fallback
-- antes da migração completa deixa a Sala Ágil em modo somente leitura.
--
-- Este hotfix:
--   1. religa o fallback legado de permissões;
--   2. bloqueia um novo desligamento até que a autorização granular por
--      organização esteja implementada e validada.

begin;

insert into public.saas_runtime_settings (key, value, updated_at, updated_by)
values (
  'organization_legacy_permission_fallback_enabled',
  jsonb_build_object('enabled', true),
  now(),
  auth.uid()
)
on conflict (key) do update
  set value = excluded.value,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by;

create or replace function public.set_organization_legacy_permission_fallback(
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not coalesce(public.is_platform_admin(auth.uid()), false)
     and not (
       auth.uid() is null
       and nullif(current_setting('request.jwt.claim.role', true), '') is null
       and session_user in ('postgres', 'supabase_admin')
     ) then
    raise exception using
      errcode = '42501',
      message = 'organization_legacy_permission_fallback_toggle_denied';
  end if;

  if not p_enabled then
    raise exception using
      errcode = '55000',
      message = 'organization_granular_permissions_not_ready',
      detail = 'O fallback legado não pode ser desligado enquanto o frontend depender de user_roles/role_permissions para permissões granulares.',
      hint = 'Implemente permissões por organização e módulo, valide a regressão da Sala Ágil e publique uma migration que substitua este bloqueio.';
  end if;

  insert into public.saas_runtime_settings (key, value, updated_at, updated_by)
  values (
    'organization_legacy_permission_fallback_enabled',
    jsonb_build_object('enabled', true),
    now(),
    auth.uid()
  )
  on conflict (key) do update
    set value = excluded.value,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by;
end;
$$;

revoke all on function public.set_organization_legacy_permission_fallback(boolean)
  from public, anon;
grant execute on function public.set_organization_legacy_permission_fallback(boolean)
  to authenticated, service_role;

comment on function public.set_organization_legacy_permission_fallback(boolean) is
  'Hotfix: mantém o fallback legado ligado até a conclusão da autorização granular organizacional.';

commit;

select
  public.is_organization_legacy_permission_fallback_enabled() as fallback_enabled,
  public.is_organization_legacy_permission_fallback_enabled() as permission_hotfix_ok;
