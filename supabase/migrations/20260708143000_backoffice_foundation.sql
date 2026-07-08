-- Axionn Backoffice - fundacao de staff interno Roberto Sales LTDA.
-- O backoffice e isolado do console de organizacao e usa roles proprias.

create table if not exists public.owner_staff_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null check (role in ('admin', 'financeiro', 'suporte', 'comercial', 'dev')),
  department text,
  avatar_url text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id),
  unique (email)
);

create table if not exists public.backoffice_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_staff_id uuid references public.owner_staff_members(id) on delete set null,
  actor_user_id uuid,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  before_values jsonb not null default '{}'::jsonb,
  after_values jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_owner_staff_members_user
  on public.owner_staff_members(user_id);
create index if not exists idx_owner_staff_members_role
  on public.owner_staff_members(role)
  where is_active;
create index if not exists idx_backoffice_audit_created
  on public.backoffice_audit_log(created_at desc);

create or replace function public.touch_backoffice_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_owner_staff_members_updated_at on public.owner_staff_members;
create trigger trg_owner_staff_members_updated_at
before update on public.owner_staff_members
for each row execute function public.touch_backoffice_updated_at();

create or replace function public.is_backoffice_staff(
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
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
  select exists (
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
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_staff public.owner_staff_members;
begin
  v_staff := public.assert_backoffice_staff(null);

  update public.owner_staff_members staff
  set last_login_at = now()
  where staff.id = v_staff.id;

  return query
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
  where staff.id = v_staff.id;
end;
$$;

create or replace function public.list_backoffice_staff_members()
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
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_backoffice_staff(array['admin']);

  return query
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
  order by staff.is_active desc, staff.full_name;
end;
$$;

create or replace function public.upsert_backoffice_staff_member(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_role text,
  p_department text,
  p_avatar_url text,
  p_is_active boolean
)
returns uuid
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.owner_staff_members;
  v_staff_id uuid;
  v_role text := lower(trim(p_role));
  v_email text := lower(trim(p_email));
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'backoffice_admin_required';
  end if;

  select *
  into v_actor
  from public.owner_staff_members staff
  where staff.user_id = auth.uid()
    and staff.role = 'admin'
    and staff.is_active
  limit 1;

  if v_actor.id is null and not coalesce(public.is_platform_admin(auth.uid()), false) then
    raise exception using errcode = '42501', message = 'backoffice_admin_required';
  end if;

  if p_user_id is null then
    raise exception using errcode = '22023', message = 'staff_user_required';
  end if;

  if nullif(trim(p_full_name), '') is null then
    raise exception using errcode = '22023', message = 'staff_name_required';
  end if;

  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception using errcode = '22023', message = 'staff_email_invalid';
  end if;

  if v_role not in ('admin', 'financeiro', 'suporte', 'comercial', 'dev') then
    raise exception using errcode = '22023', message = 'staff_role_invalid';
  end if;

  insert into public.owner_staff_members (
    user_id,
    full_name,
    email,
    role,
    department,
    avatar_url,
    is_active
  )
  values (
    p_user_id,
    trim(p_full_name),
    v_email,
    v_role,
    nullif(trim(p_department), ''),
    nullif(trim(p_avatar_url), ''),
    coalesce(p_is_active, true)
  )
  on conflict (user_id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role,
    department = excluded.department,
    avatar_url = excluded.avatar_url,
    is_active = excluded.is_active
  returning id into v_staff_id;

  insert into public.backoffice_audit_log (
    actor_staff_id,
    actor_user_id,
    action,
    resource_type,
    resource_id,
    after_values
  )
  values (
    v_actor.id,
    auth.uid(),
    'staff_member_upserted',
    'owner_staff_member',
    v_staff_id,
    jsonb_build_object(
      'user_id', p_user_id,
      'email', v_email,
      'role', v_role,
      'is_active', coalesce(p_is_active, true)
    )
  );

  return v_staff_id;
end;
$$;

create or replace function public.deactivate_backoffice_staff_member(
  p_staff_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.owner_staff_members;
begin
  v_actor := public.assert_backoffice_staff(array['admin']);

  update public.owner_staff_members
  set is_active = false
  where id = p_staff_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'staff_member_not_found';
  end if;

  insert into public.backoffice_audit_log (
    actor_staff_id,
    actor_user_id,
    action,
    resource_type,
    resource_id
  )
  values (
    v_actor.id,
    auth.uid(),
    'staff_member_deactivated',
    'owner_staff_member',
    p_staff_id
  );
end;
$$;

create or replace function public.get_backoffice_dashboard_summary()
returns table (
  total_tenants bigint,
  active_tenants bigint,
  trial_tenants bigint,
  suspended_tenants bigint,
  staff_members bigint,
  active_staff_members bigint,
  active_subscriptions bigint,
  past_due_subscriptions bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_backoffice_staff(array['admin', 'financeiro', 'suporte', 'comercial', 'dev']);

  return query
  select
    (select count(*) from public.organizations)::bigint,
    (select count(*) from public.organizations where status::text = 'active')::bigint,
    (select count(*) from public.organizations where status::text = 'trial')::bigint,
    (select count(*) from public.organizations where status::text = 'suspended')::bigint,
    (select count(*) from public.owner_staff_members)::bigint,
    (select count(*) from public.owner_staff_members where is_active)::bigint,
    (select count(*) from public.organization_subscriptions where status = 'active')::bigint,
    (select count(*) from public.organization_subscriptions where status = 'past_due')::bigint;
end;
$$;

alter table public.owner_staff_members enable row level security;
alter table public.backoffice_audit_log enable row level security;

drop policy if exists owner_staff_members_own_select on public.owner_staff_members;
create policy owner_staff_members_own_select
on public.owner_staff_members
for select to authenticated
using (auth.uid() = user_id or public.is_backoffice_admin(auth.uid()));

drop policy if exists backoffice_audit_admin_select on public.backoffice_audit_log;
create policy backoffice_audit_admin_select
on public.backoffice_audit_log
for select to authenticated
using (public.is_backoffice_admin(auth.uid()));

revoke all on table public.owner_staff_members from public, anon, authenticated;
revoke all on table public.backoffice_audit_log from public, anon, authenticated;
grant select on table public.owner_staff_members to authenticated;
grant select on table public.backoffice_audit_log to authenticated;
grant select, insert, update, delete on table public.owner_staff_members to service_role;
grant select, insert on table public.backoffice_audit_log to service_role;

revoke all on function public.touch_backoffice_updated_at() from public, anon, authenticated;
revoke all on function public.is_backoffice_staff(uuid) from public, anon;
revoke all on function public.is_backoffice_admin(uuid) from public, anon;
revoke all on function public.assert_backoffice_staff(text[]) from public, anon, authenticated;
revoke all on function public.get_my_backoffice_staff_profile() from public, anon;
revoke all on function public.list_backoffice_staff_members() from public, anon;
revoke all on function public.upsert_backoffice_staff_member(uuid, text, text, text, text, text, boolean) from public, anon;
revoke all on function public.deactivate_backoffice_staff_member(uuid) from public, anon;
revoke all on function public.get_backoffice_dashboard_summary() from public, anon;

grant execute on function public.is_backoffice_staff(uuid) to authenticated, service_role;
grant execute on function public.is_backoffice_admin(uuid) to authenticated, service_role;
grant execute on function public.get_my_backoffice_staff_profile() to authenticated, service_role;
grant execute on function public.list_backoffice_staff_members() to authenticated, service_role;
grant execute on function public.upsert_backoffice_staff_member(uuid, text, text, text, text, text, boolean) to authenticated, service_role;
grant execute on function public.deactivate_backoffice_staff_member(uuid) to authenticated, service_role;
grant execute on function public.get_backoffice_dashboard_summary() to authenticated, service_role;

insert into public.owner_staff_members (
  user_id,
  full_name,
  email,
  role,
  department,
  is_active
)
select
  user_account.id,
  coalesce(user_account.raw_user_meta_data ->> 'full_name', user_account.email, 'Roberto Sales'),
  coalesce(user_account.email, 'roberto@robertosales.com.br'),
  'admin',
  'Diretoria',
  true
from auth.users user_account
where user_account.id = '3c472f37-eabb-4a95-a859-1a1cf89f5d37'::uuid
on conflict (user_id) do nothing;

comment on table public.owner_staff_members is
  'Funcionarios internos da Roberto Sales LTDA autorizados a acessar o Backoffice Axionn.';
comment on table public.backoffice_audit_log is
  'Auditoria de acoes administrativas do Backoffice Axionn.';
