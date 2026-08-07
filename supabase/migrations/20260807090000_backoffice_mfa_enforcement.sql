-- Backoffice MFA enforcement
-- A UI pode identificar que o usuário é staff em AAL1 para apresentar o
-- enrolamento TOTP, mas nenhuma operação privilegiada é autorizada sem AAL2.

create or replace function public.is_backoffice_staff(
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (auth.jwt() ->> 'aal') = 'aal2'
    and exists (
      select 1
      from public.owner_staff_members staff
      where staff.user_id = p_user_id
        and staff.is_active
    );
$$;

create or replace function public.is_backoffice_admin(
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (auth.jwt() ->> 'aal') = 'aal2'
    and exists (
      select 1
      from public.owner_staff_members staff
      where staff.user_id = p_user_id
        and staff.role = 'admin'
        and staff.is_active
    );
$$;

create or replace function public.assert_backoffice_staff(
  p_allowed_roles text[] default null
)
returns public.owner_staff_members
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_staff public.owner_staff_members;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'backoffice_staff_required';
  end if;

  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception using errcode = '42501', message = 'backoffice_mfa_required';
  end if;

  select *
  into v_staff
  from public.owner_staff_members staff
  where staff.user_id = auth.uid()
    and staff.is_active
  limit 1;

  if v_staff.id is null then
    raise exception using errcode = '42501', message = 'backoffice_staff_required';
  end if;

  if p_allowed_roles is not null and not (v_staff.role = any(p_allowed_roles)) then
    raise exception using errcode = '42501', message = 'backoffice_role_forbidden';
  end if;

  return v_staff;
end;
$$;

-- Esta é deliberadamente a única operação de backoffice permitida em AAL1:
-- retorna somente o registro do próprio usuário para decidir se o gate MFA
-- deve ser exibido. Não aceita IDs externos nem expõe dados de outros membros.
create or replace function public.get_my_backoffice_staff_profile()
returns table (
  id uuid,
  user_id uuid,
  full_name text,
  email text,
  role text,
  department text,
  avatar_url text,
  is_active boolean,
  last_login_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    staff.id,
    staff.user_id,
    staff.full_name,
    staff.email,
    staff.role,
    staff.department,
    staff.avatar_url,
    staff.is_active,
    staff.last_login_at,
    staff.created_at,
    staff.updated_at
  from public.owner_staff_members staff
  where staff.user_id = auth.uid()
    and staff.is_active
  limit 1;
$$;

revoke all on function public.is_backoffice_staff(uuid) from public, anon;
revoke all on function public.is_backoffice_admin(uuid) from public, anon;
revoke all on function public.assert_backoffice_staff(text[]) from public, anon, authenticated;
revoke all on function public.get_my_backoffice_staff_profile() from public, anon;

grant execute on function public.is_backoffice_staff(uuid) to authenticated, service_role;
grant execute on function public.is_backoffice_admin(uuid) to authenticated, service_role;
grant execute on function public.get_my_backoffice_staff_profile() to authenticated, service_role;

comment on function public.assert_backoffice_staff(text[]) is
  'Autoridade central do backoffice: exige staff ativo, papel permitido e JWT AAL2.';
