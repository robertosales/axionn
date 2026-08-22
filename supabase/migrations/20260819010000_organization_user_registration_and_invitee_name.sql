-- Cadastro administrativo direto e nome do destinatario no convite.

create or replace function public.create_organization_invitation_with_name(
  p_org_id uuid,
  p_email text,
  p_role text,
  p_module_keys text[],
  p_invited_by uuid,
  p_display_name text,
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
set search_path = public, extensions, pg_temp
as $$
declare
  v_name text := nullif(btrim(coalesce(p_display_name, '')), '');
  v_invitation record;
begin
  if v_name is null or length(v_name) > 120 then
    raise exception using errcode = '22023', message = 'organization_invitation_invalid_display_name';
  end if;

  select * into v_invitation
  from public.create_organization_invitation(
    p_org_id, p_email, p_role, p_module_keys, p_invited_by, p_expires_at
  );

  update public.organization_invitations
  set metadata = metadata || jsonb_build_object('recipient_name', v_name)
  where id = v_invitation.invitation_id;

  return query select
    v_invitation.invitation_id,
    v_invitation.normalized_email,
    v_invitation.raw_token,
    v_invitation.expires_at;
end;
$$;

drop function if exists public.get_organization_invitations_v3(uuid);
create function public.get_organization_invitations_v3(p_org_id uuid)
returns table (
  invitation_id uuid,
  email text,
  recipient_name text,
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
set search_path = public, extensions, pg_temp
as $$
begin
  if not public.is_organization_admin(p_org_id, auth.uid()) then
    raise exception using errcode = '42501', message = 'organization_invitations_access_denied';
  end if;

  return query
  select
    invitation.id,
    invitation.email,
    nullif(invitation.metadata ->> 'recipient_name', ''),
    invitation.role::text,
    invitation.module_keys,
    case when invitation.status = 'pending' and invitation.expires_at <= now()
      then 'expired' else invitation.status end,
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

create or replace function public.sync_accepted_invitation_recipient_name()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := nullif(btrim(new.metadata ->> 'recipient_name'), '');
begin
  if new.status = 'accepted' and old.status is distinct from new.status
     and v_name is not null and new.accepted_by is not null then
    update public.profiles
    set display_name = v_name, updated_at = now()
    where user_id = new.accepted_by;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_accepted_invitation_recipient_name on public.organization_invitations;
create trigger trg_sync_accepted_invitation_recipient_name
after update of status on public.organization_invitations
for each row execute function public.sync_accepted_invitation_recipient_name();

create or replace function public.provision_organization_user(
  p_org_id uuid,
  p_user_id uuid,
  p_email text,
  p_display_name text,
  p_role text,
  p_module_keys text[],
  p_actor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := nullif(btrim(coalesce(p_display_name, '')), '');
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_module text;
begin
  if not public.is_organization_admin(p_org_id, p_actor_id) then
    raise exception using errcode = '42501', message = 'organization_user_creation_forbidden';
  end if;
  if v_name is null or length(v_name) > 120 then
    raise exception using errcode = '22023', message = 'organization_user_invalid_display_name';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception using errcode = '22023', message = 'organization_user_invalid_role';
  end if;
  if exists (select 1 from public.organization_members where org_id = p_org_id and user_id = p_user_id) then
    raise exception using errcode = '23505', message = 'organization_user_already_member';
  end if;

  update public.profiles
  set display_name = v_name, email = v_email, updated_at = now()
  where user_id = p_user_id;

  insert into public.organization_members (org_id, user_id, role, invited_by, joined_at, is_active, updated_by)
  values (p_org_id, p_user_id, p_role::public.org_member_role, p_actor_id, now(), true, p_actor_id);

  foreach v_module in array coalesce(p_module_keys, '{}'::text[])
  loop
    if v_module in ('sala_agil', 'sustentacao', 'rdm') then
      insert into public.organization_member_modules (org_id, user_id, module_key, role_name, assigned_by)
      values (p_org_id, p_user_id, v_module, case when p_role = 'admin' then 'admin' else 'member' end, p_actor_id)
      on conflict (org_id, user_id, module_key) do nothing;
    end if;
  end loop;

  return true;
end;
$$;
