-- Axion SaaS — Fase 2A / Lote 2
-- Convites, memberships e permissões de módulo por organização.
-- Aditivo e compatível com organization_members, user_module_roles e o tenancy atual.

alter table public.organization_members
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid;

create table if not exists public.organization_member_modules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  user_id uuid not null,
  module_key text not null check (module_key in ('sala_agil', 'sustentacao', 'rdm')),
  role_name text not null default 'member',
  assigned_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id, module_key),
  foreign key (org_id, user_id)
    references public.organization_members(org_id, user_id)
    on delete cascade
);

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.org_member_role not null default 'member',
  module_keys text[] not null default '{}'::text[],
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  invited_by uuid not null,
  accepted_by uuid,
  accepted_at timestamptz,
  revoked_by uuid,
  revoked_at timestamptz,
  last_sent_at timestamptz not null default now(),
  send_count integer not null default 1 check (send_count > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role::text in ('admin', 'member')),
  check (email = lower(btrim(email)))
);

create unique index if not exists uq_organization_invitations_pending_email
  on public.organization_invitations(org_id, email)
  where status = 'pending';
create index if not exists idx_organization_invitations_org_status
  on public.organization_invitations(org_id, status, created_at desc);
create index if not exists idx_organization_invitations_expires
  on public.organization_invitations(expires_at)
  where status = 'pending';
create index if not exists idx_organization_member_modules_org_user
  on public.organization_member_modules(org_id, user_id);

create table if not exists public.organization_membership_audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid,
  subject_user_id uuid,
  invitation_id uuid references public.organization_invitations(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_org_membership_audit_org_created
  on public.organization_membership_audit_log(org_id, created_at desc);

create or replace function public.touch_organization_membership_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_organization_members_updated_at on public.organization_members;
create trigger trg_organization_members_updated_at
before update on public.organization_members
for each row execute function public.touch_organization_membership_updated_at();

drop trigger if exists trg_organization_member_modules_updated_at on public.organization_member_modules;
create trigger trg_organization_member_modules_updated_at
before update on public.organization_member_modules
for each row execute function public.touch_organization_membership_updated_at();

drop trigger if exists trg_organization_invitations_updated_at on public.organization_invitations;
create trigger trg_organization_invitations_updated_at
before update on public.organization_invitations
for each row execute function public.touch_organization_membership_updated_at();

create or replace function public.my_org_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select array(
    select member.org_id
    from public.organization_members member
    where member.user_id = auth.uid()
      and member.is_active
  );
$$;

create or replace function public.is_organization_member(
  p_org_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin(p_user_id)
    or exists (
      select 1
      from public.organization_members member
      where member.org_id = p_org_id
        and member.user_id = p_user_id
        and member.is_active
    );
$$;

create or replace function public.is_organization_admin(
  p_org_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin(p_user_id)
    or exists (
      select 1
      from public.organization_members member
      where member.org_id = p_org_id
        and member.user_id = p_user_id
        and member.is_active
        and member.role::text in ('owner', 'admin')
    );
$$;

create or replace function public.is_organization_owner(
  p_org_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_platform_admin(p_user_id)
    or exists (
      select 1
      from public.organization_members member
      where member.org_id = p_org_id
        and member.user_id = p_user_id
        and member.is_active
        and member.role::text = 'owner'
    );
$$;

create or replace function public.get_my_organizations_v2()
returns table (
  id uuid,
  name text,
  slug text,
  status public.org_status,
  plan public.org_plan,
  membership_role text,
  is_platform_admin boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with access as (
    select
      organization.id,
      organization.name,
      organization.slug,
      organization.status,
      organization.plan,
      member.role::text as membership_role,
      false as platform_access
    from public.organization_members member
    join public.organizations organization on organization.id = member.org_id
    where member.user_id = auth.uid()
      and member.is_active

    union all

    select
      organization.id,
      organization.name,
      organization.slug,
      organization.status,
      organization.plan,
      'platform_admin'::text,
      true
    from public.organizations organization
    where public.is_platform_admin(auth.uid())
  )
  select distinct on (access.id)
    access.id,
    access.name,
    access.slug,
    access.status,
    access.plan,
    access.membership_role,
    public.is_platform_admin(auth.uid())
  from access
  order by access.id, access.platform_access desc, access.name;
$$;

create or replace function public.create_organization_invitation(
  p_org_id uuid,
  p_email text,
  p_role text,
  p_module_keys text[],
  p_invited_by uuid,
  p_expires_at timestamptz default now() + interval '7 days'
)
returns table (
  invitation_id uuid,
  normalized_email text,
  raw_token text,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_role public.org_member_role;
  v_modules text[];
  v_token text;
  v_invitation_id uuid;
begin
  if not public.is_organization_admin(p_org_id, p_invited_by) then
    raise exception using errcode = '42501', message = 'organization_invitation_forbidden';
  end if;

  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception using errcode = '22023', message = 'organization_invitation_invalid_email';
  end if;

  if p_role not in ('admin', 'member') then
    raise exception using errcode = '22023', message = 'organization_invitation_invalid_role';
  end if;
  v_role := p_role::public.org_member_role;

  select coalesce(array_agg(distinct module_key order by module_key), '{}'::text[])
  into v_modules
  from unnest(coalesce(p_module_keys, '{}'::text[])) module_key
  where module_key in ('sala_agil', 'sustentacao', 'rdm');

  if exists (
    select 1
    from public.organization_members member
    join auth.users user_account on user_account.id = member.user_id
    where member.org_id = p_org_id
      and member.is_active
      and lower(user_account.email) = v_email
  ) then
    raise exception using errcode = '23505', message = 'organization_invitation_existing_member';
  end if;

  update public.organization_invitations invitation
  set status = 'revoked',
      revoked_by = p_invited_by,
      revoked_at = now(),
      metadata = invitation.metadata || jsonb_build_object('revocation_reason', 'replaced')
  where invitation.org_id = p_org_id
    and invitation.email = v_email
    and invitation.status = 'pending';

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.organization_invitations (
    org_id,
    email,
    role,
    module_keys,
    token_hash,
    status,
    expires_at,
    invited_by
  )
  values (
    p_org_id,
    v_email,
    v_role,
    v_modules,
    encode(digest(v_token, 'sha256'), 'hex'),
    'pending',
    greatest(p_expires_at, now() + interval '1 hour'),
    p_invited_by
  )
  returning id into v_invitation_id;

  insert into public.organization_membership_audit_log (
    org_id, actor_id, invitation_id, action, details
  )
  values (
    p_org_id,
    p_invited_by,
    v_invitation_id,
    'invitation_created',
    jsonb_build_object('email', v_email, 'role', p_role, 'module_keys', v_modules)
  );

  return query
  select v_invitation_id, v_email, v_token,
    (select invitation.expires_at from public.organization_invitations invitation where invitation.id = v_invitation_id);
end;
$$;

create or replace function public.resend_organization_invitation(
  p_invitation_id uuid,
  p_actor_id uuid,
  p_expires_at timestamptz default now() + interval '7 days'
)
returns table (
  invitation_id uuid,
  normalized_email text,
  raw_token text,
  expires_at timestamptz,
  org_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.organization_invitations%rowtype;
  v_token text;
begin
  select * into v_invitation
  from public.organization_invitations invitation
  where invitation.id = p_invitation_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'organization_invitation_not_found';
  end if;

  if not public.is_organization_admin(v_invitation.org_id, p_actor_id) then
    raise exception using errcode = '42501', message = 'organization_invitation_forbidden';
  end if;

  if v_invitation.status = 'accepted' then
    raise exception using errcode = '22023', message = 'organization_invitation_already_accepted';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');

  update public.organization_invitations invitation
  set token_hash = encode(digest(v_token, 'sha256'), 'hex'),
      status = 'pending',
      expires_at = greatest(p_expires_at, now() + interval '1 hour'),
      revoked_by = null,
      revoked_at = null,
      last_sent_at = now(),
      send_count = invitation.send_count + 1
  where invitation.id = p_invitation_id
  returning * into v_invitation;

  insert into public.organization_membership_audit_log (
    org_id, actor_id, invitation_id, action, details
  )
  values (
    v_invitation.org_id,
    p_actor_id,
    p_invitation_id,
    'invitation_resent',
    jsonb_build_object('email', v_invitation.email, 'send_count', v_invitation.send_count)
  );

  return query
  select v_invitation.id, v_invitation.email, v_token,
    v_invitation.expires_at, v_invitation.org_id;
end;
$$;

create or replace function public.get_organization_invitation_preview(
  p_token text
)
returns table (
  organization_name text,
  masked_email text,
  invitation_role text,
  expires_at timestamptz,
  invitation_status text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    organization.name,
    regexp_replace(invitation.email, '^(.{1,2}).*(@.*)$', '\1***\2'),
    invitation.role::text,
    invitation.expires_at,
    case
      when invitation.status = 'pending' and invitation.expires_at <= now() then 'expired'
      else invitation.status
    end
  from public.organization_invitations invitation
  join public.organizations organization on organization.id = invitation.org_id
  where invitation.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
  limit 1;
$$;

create or replace function public.accept_organization_invitation(
  p_token text
)
returns table (
  organization_id uuid,
  organization_name text,
  membership_role text,
  accepted boolean,
  result_status text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invitation public.organization_invitations%rowtype;
  v_user_email text;
  v_organization_name text;
  v_module text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'organization_invitation_auth_required';
  end if;

  select lower(user_account.email)
  into v_user_email
  from auth.users user_account
  where user_account.id = auth.uid();

  select * into v_invitation
  from public.organization_invitations invitation
  where invitation.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;

  if not found then
    return query select null::uuid, null::text, null::text, false, 'invalid'::text;
    return;
  end if;

  select organization.name into v_organization_name
  from public.organizations organization
  where organization.id = v_invitation.org_id;

  if v_invitation.status = 'accepted' then
    return query select v_invitation.org_id, v_organization_name,
      v_invitation.role::text, true, 'already_accepted'::text;
    return;
  end if;

  if v_invitation.status = 'revoked' then
    return query select v_invitation.org_id, v_organization_name,
      v_invitation.role::text, false, 'revoked'::text;
    return;
  end if;

  if v_invitation.expires_at <= now() then
    update public.organization_invitations
    set status = 'expired'
    where id = v_invitation.id;

    return query select v_invitation.org_id, v_organization_name,
      v_invitation.role::text, false, 'expired'::text;
    return;
  end if;

  if v_user_email is null or v_user_email <> v_invitation.email then
    raise exception using errcode = '42501', message = 'organization_invitation_email_mismatch';
  end if;

  insert into public.organization_members (
    org_id,
    user_id,
    role,
    invited_by,
    joined_at,
    is_active,
    updated_by
  )
  values (
    v_invitation.org_id,
    auth.uid(),
    v_invitation.role,
    v_invitation.invited_by,
    now(),
    true,
    auth.uid()
  )
  on conflict (org_id, user_id) do update
  set is_active = true,
      role = case
        when organization_members.role::text = 'owner' then organization_members.role
        else excluded.role
      end,
      invited_by = excluded.invited_by,
      updated_by = auth.uid();

  delete from public.organization_member_modules module_access
  where module_access.org_id = v_invitation.org_id
    and module_access.user_id = auth.uid();

  foreach v_module in array v_invitation.module_keys
  loop
    insert into public.organization_member_modules (
      org_id, user_id, module_key, role_name, assigned_by
    )
    values (
      v_invitation.org_id,
      auth.uid(),
      v_module,
      case when v_invitation.role::text = 'admin' then 'admin' else 'member' end,
      v_invitation.invited_by
    )
    on conflict (org_id, user_id, module_key) do nothing;
  end loop;

  update public.organization_invitations
  set status = 'accepted',
      accepted_by = auth.uid(),
      accepted_at = now()
  where id = v_invitation.id;

  insert into public.organization_membership_audit_log (
    org_id, actor_id, subject_user_id, invitation_id, action, details
  )
  values (
    v_invitation.org_id,
    auth.uid(),
    auth.uid(),
    v_invitation.id,
    'invitation_accepted',
    jsonb_build_object('email', v_invitation.email, 'role', v_invitation.role::text)
  );

  return query select v_invitation.org_id, v_organization_name,
    v_invitation.role::text, true, 'accepted'::text;
end;
$$;

create or replace function public.get_organization_members_v2(
  p_org_id uuid
)
returns table (
  user_id uuid,
  display_name text,
  email text,
  membership_role text,
  is_active boolean,
  joined_at timestamptz,
  module_keys text[]
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_organization_admin(p_org_id, auth.uid()) then
    raise exception using errcode = '42501', message = 'organization_members_access_denied';
  end if;

  return query
  select
    member.user_id,
    coalesce(nullif(profile.display_name, ''), user_account.email, 'Usuário'),
    coalesce(profile.email, user_account.email, ''),
    member.role::text,
    member.is_active,
    member.joined_at,
    coalesce(array_agg(module_access.module_key order by module_access.module_key)
      filter (where module_access.module_key is not null), '{}'::text[])
  from public.organization_members member
  left join public.profiles profile on profile.user_id = member.user_id
  left join auth.users user_account on user_account.id = member.user_id
  left join public.organization_member_modules module_access
    on module_access.org_id = member.org_id
   and module_access.user_id = member.user_id
  where member.org_id = p_org_id
  group by member.user_id, profile.display_name, profile.email,
    user_account.email, member.role, member.is_active, member.joined_at
  order by member.is_active desc, member.role::text, display_name;
end;
$$;

create or replace function public.get_organization_invitations_v2(
  p_org_id uuid
)
returns table (
  invitation_id uuid,
  email text,
  invitation_role text,
  module_keys text[],
  invitation_status text,
  expires_at timestamptz,
  invited_by_name text,
  send_count integer,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_organization_admin(p_org_id, auth.uid()) then
    raise exception using errcode = '42501', message = 'organization_invitations_access_denied';
  end if;

  return query
  select
    invitation.id,
    invitation.email,
    invitation.role::text,
    invitation.module_keys,
    case
      when invitation.status = 'pending' and invitation.expires_at <= now() then 'expired'
      else invitation.status
    end,
    invitation.expires_at,
    coalesce(nullif(profile.display_name, ''), inviter.email, 'Administrador'),
    invitation.send_count,
    invitation.created_at
  from public.organization_invitations invitation
  left join public.profiles profile on profile.user_id = invitation.invited_by
  left join auth.users inviter on inviter.id = invitation.invited_by
  where invitation.org_id = p_org_id
  order by invitation.created_at desc;
end;
$$;

create or replace function public.update_organization_member_v2(
  p_org_id uuid,
  p_user_id uuid,
  p_role text default null,
  p_is_active boolean default null,
  p_module_keys text[] default null
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_member public.organization_members%rowtype;
  v_modules text[];
  v_module text;
  v_next_role public.org_member_role;
begin
  if not public.is_organization_admin(p_org_id, v_actor) then
    raise exception using errcode = '42501', message = 'organization_member_update_forbidden';
  end if;

  select * into v_member
  from public.organization_members member
  where member.org_id = p_org_id and member.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'organization_member_not_found';
  end if;

  if p_user_id = v_actor and p_is_active = false then
    raise exception using errcode = '22023', message = 'organization_member_self_deactivation_forbidden';
  end if;

  if p_role is not null and p_role not in ('admin', 'member') then
    raise exception using errcode = '22023', message = 'organization_member_invalid_role';
  end if;

  if v_member.role::text = 'owner'
     and ((p_role is not null and p_role <> 'owner') or p_is_active = false) then
    raise exception using errcode = '22023', message = 'organization_owner_requires_transfer';
  end if;

  if p_role is not null then
    v_next_role := p_role::public.org_member_role;
  else
    v_next_role := v_member.role;
  end if;

  update public.organization_members
  set role = v_next_role,
      is_active = coalesce(p_is_active, is_active),
      updated_by = v_actor
  where org_id = p_org_id and user_id = p_user_id;

  if p_module_keys is not null then
    select coalesce(array_agg(distinct module_key order by module_key), '{}'::text[])
    into v_modules
    from unnest(p_module_keys) module_key
    where module_key in ('sala_agil', 'sustentacao', 'rdm');

    delete from public.organization_member_modules module_access
    where module_access.org_id = p_org_id
      and module_access.user_id = p_user_id;

    foreach v_module in array v_modules
    loop
      insert into public.organization_member_modules (
        org_id, user_id, module_key, role_name, assigned_by
      )
      values (
        p_org_id,
        p_user_id,
        v_module,
        case when v_next_role::text = 'admin' then 'admin' else 'member' end,
        v_actor
      );
    end loop;
  end if;

  insert into public.organization_membership_audit_log (
    org_id, actor_id, subject_user_id, action, details
  )
  values (
    p_org_id,
    v_actor,
    p_user_id,
    'member_updated',
    jsonb_build_object(
      'previous_role', v_member.role::text,
      'role', v_next_role::text,
      'previous_active', v_member.is_active,
      'is_active', coalesce(p_is_active, v_member.is_active),
      'module_keys', p_module_keys
    )
  );

  return true;
end;
$$;

create or replace function public.deactivate_organization_member_v2(
  p_org_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  if not public.is_organization_admin(p_org_id, v_actor) then
    raise exception using errcode = '42501', message = 'organization_member_deactivate_forbidden';
  end if;

  if p_user_id = v_actor then
    raise exception using errcode = '22023', message = 'organization_member_self_deactivation_forbidden';
  end if;

  select member.role::text into v_role
  from public.organization_members member
  where member.org_id = p_org_id and member.user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'organization_member_not_found';
  end if;

  if v_role = 'owner' then
    raise exception using errcode = '22023', message = 'organization_owner_requires_transfer';
  end if;

  update public.organization_members
  set is_active = false, updated_by = v_actor
  where org_id = p_org_id and user_id = p_user_id;

  insert into public.organization_membership_audit_log (
    org_id, actor_id, subject_user_id, action
  )
  values (p_org_id, v_actor, p_user_id, 'member_deactivated');

  return true;
end;
$$;

create or replace function public.transfer_organization_ownership_v2(
  p_org_id uuid,
  p_new_owner_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
begin
  if not public.is_organization_owner(p_org_id, v_actor) then
    raise exception using errcode = '42501', message = 'organization_ownership_transfer_forbidden';
  end if;

  if not exists (
    select 1 from public.organization_members member
    where member.org_id = p_org_id
      and member.user_id = p_new_owner_id
      and member.is_active
  ) then
    raise exception using errcode = '22023', message = 'organization_new_owner_must_be_active_member';
  end if;

  update public.organization_members
  set role = 'admin'::public.org_member_role,
      updated_by = v_actor
  where org_id = p_org_id
    and role::text = 'owner'
    and user_id <> p_new_owner_id;

  update public.organization_members
  set role = 'owner'::public.org_member_role,
      is_active = true,
      updated_by = v_actor
  where org_id = p_org_id
    and user_id = p_new_owner_id;

  insert into public.organization_membership_audit_log (
    org_id, actor_id, subject_user_id, action
  )
  values (p_org_id, v_actor, p_new_owner_id, 'ownership_transferred');

  return true;
end;
$$;

create or replace function public.revoke_organization_invitation_v2(
  p_invitation_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_org_id uuid;
begin
  select invitation.org_id into v_org_id
  from public.organization_invitations invitation
  where invitation.id = p_invitation_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'organization_invitation_not_found';
  end if;

  if not public.is_organization_admin(v_org_id, v_actor) then
    raise exception using errcode = '42501', message = 'organization_invitation_forbidden';
  end if;

  update public.organization_invitations
  set status = 'revoked', revoked_by = v_actor, revoked_at = now()
  where id = p_invitation_id and status in ('pending', 'expired');

  insert into public.organization_membership_audit_log (
    org_id, actor_id, invitation_id, action
  )
  values (v_org_id, v_actor, p_invitation_id, 'invitation_revoked');

  return true;
end;
$$;

alter table public.organization_member_modules enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.organization_membership_audit_log enable row level security;

revoke all on table public.organization_member_modules from public, anon, authenticated;
revoke all on table public.organization_invitations from public, anon, authenticated;
revoke all on table public.organization_membership_audit_log from public, anon, authenticated;
grant select, insert, update, delete on table public.organization_member_modules to service_role;
grant select, insert, update, delete on table public.organization_invitations to service_role;
grant select, insert, update, delete on table public.organization_membership_audit_log to service_role;

revoke all on function public.touch_organization_membership_updated_at() from public, anon, authenticated;
revoke all on function public.is_organization_owner(uuid, uuid) from public, anon;
revoke all on function public.create_organization_invitation(uuid, text, text, text[], uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.resend_organization_invitation(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.get_organization_invitation_preview(text) from public;
revoke all on function public.accept_organization_invitation(text) from public, anon;
revoke all on function public.get_organization_members_v2(uuid) from public, anon;
revoke all on function public.get_organization_invitations_v2(uuid) from public, anon;
revoke all on function public.update_organization_member_v2(uuid, uuid, text, boolean, text[]) from public, anon;
revoke all on function public.deactivate_organization_member_v2(uuid, uuid) from public, anon;
revoke all on function public.transfer_organization_ownership_v2(uuid, uuid) from public, anon;
revoke all on function public.revoke_organization_invitation_v2(uuid) from public, anon;

grant execute on function public.is_organization_owner(uuid, uuid) to authenticated, service_role;
grant execute on function public.create_organization_invitation(uuid, text, text, text[], uuid, timestamptz) to service_role;
grant execute on function public.resend_organization_invitation(uuid, uuid, timestamptz) to service_role;
grant execute on function public.get_organization_invitation_preview(text) to anon, authenticated, service_role;
grant execute on function public.accept_organization_invitation(text) to authenticated, service_role;
grant execute on function public.get_organization_members_v2(uuid) to authenticated, service_role;
grant execute on function public.get_organization_invitations_v2(uuid) to authenticated, service_role;
grant execute on function public.update_organization_member_v2(uuid, uuid, text, boolean, text[]) to authenticated, service_role;
grant execute on function public.deactivate_organization_member_v2(uuid, uuid) to authenticated, service_role;
grant execute on function public.transfer_organization_ownership_v2(uuid, uuid) to authenticated, service_role;
grant execute on function public.revoke_organization_invitation_v2(uuid) to authenticated, service_role;

comment on table public.organization_invitations is
  'Convites de acesso a organizações com token one-time armazenado somente como hash.';
comment on table public.organization_member_modules is
  'Permissões de módulo vinculadas ao membership da organização.';
comment on table public.organization_membership_audit_log is
  'Auditoria de convites, alterações de papel, desativação e transferência de ownership.';
