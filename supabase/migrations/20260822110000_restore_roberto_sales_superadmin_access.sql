-- Restaura de forma idempotente a autoridade total da conta proprietaria.
-- Os tres catalogos sao intencionalmente separados: aplicacao legada,
-- administracao global da plataforma e equipe interna do backoffice.

begin;

select pg_advisory_xact_lock(
  hashtext('axionn:20260822:restore_roberto_sales_superadmin_access')
);

do $$
declare
  v_email constant text := 'roberto.sales@gmail.com';
  v_user_id uuid;
begin
  if to_regclass('auth.users') is null
     or to_regclass('public.profiles') is null
     or to_regclass('public.user_roles') is null
     or to_regclass('public.user_module_roles') is null
     or to_regclass('public.platform_user_roles') is null
     or to_regclass('public.owner_staff_members') is null then
    raise exception 'Dependencias de identidade e autorizacao ausentes';
  end if;

  select account.id
    into v_user_id
  from auth.users account
  where lower(btrim(account.email)) = v_email
  order by account.created_at
  limit 1;

  if v_user_id is null then
    raise exception 'Usuario % nao encontrado em auth.users', v_email;
  end if;

  insert into public.profiles (
    user_id,
    display_name,
    full_name,
    email,
    module_access,
    is_active,
    must_change_password
  )
  select
    account.id,
    coalesce(nullif(btrim(account.raw_user_meta_data ->> 'full_name'), ''), 'Roberto Sales'),
    coalesce(nullif(btrim(account.raw_user_meta_data ->> 'full_name'), ''), 'Roberto Sales'),
    v_email,
    'admin',
    true,
    false
  from auth.users account
  where account.id = v_user_id
  on conflict (user_id) do update
    set display_name = case
          when btrim(public.profiles.display_name) = '' then excluded.display_name
          else public.profiles.display_name
        end,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        email = excluded.email,
        module_access = 'admin',
        is_active = true,
        updated_at = now();

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'admin'::public.app_role)
  on conflict (user_id, role) do nothing;

  insert into public.user_module_roles (user_id, module, role_name)
  values
    (v_user_id, 'sala_agil', 'admin'),
    (v_user_id, 'sustentacao', 'admin'),
    (v_user_id, 'rdm', 'admin')
  on conflict (user_id, module) do update
    set role_name = 'admin';

  insert into public.platform_user_roles (user_id, role, created_by)
  values (v_user_id, 'platform_admin', v_user_id)
  on conflict (user_id, role) do nothing;

  insert into public.owner_staff_members (
    user_id,
    full_name,
    email,
    role,
    department,
    is_active
  )
  values (
    v_user_id,
    'Roberto Sales',
    v_email,
    'admin',
    'Diretoria',
    true
  )
  on conflict (user_id) do update
    set email = excluded.email,
        role = 'admin',
        department = coalesce(public.owner_staff_members.department, excluded.department),
        is_active = true,
        updated_at = now();

  if not exists (
    select 1
    from public.user_roles role
    where role.user_id = v_user_id
      and role.role = 'admin'::public.app_role
  ) then
    raise exception 'Falha ao conceder o papel admin legado para %', v_email;
  end if;

  if not exists (
    select 1
    from public.platform_user_roles role
    where role.user_id = v_user_id
      and role.role = 'platform_admin'
  ) then
    raise exception 'Falha ao conceder platform_admin para %', v_email;
  end if;

  if not exists (
    select 1
    from public.owner_staff_members staff
    where staff.user_id = v_user_id
      and staff.role = 'admin'
      and staff.is_active
  ) then
    raise exception 'Falha ao ativar o administrador de backoffice %', v_email;
  end if;
end
$$;

commit;
