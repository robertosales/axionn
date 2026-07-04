-- Finaliza a resolução de pgcrypto sem manter wrappers no schema public.
-- Também endurece reenvio concorrente e reutilização de token aceito.

alter function public.create_organization_invitation(
  uuid, text, text, text[], uuid, timestamptz
) set search_path = public, extensions, pg_temp;

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
set search_path = public, extensions, pg_temp
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

  -- Garante uma única linha pending por organização/e-mail, inclusive ao
  -- reenviar um convite histórico enquanto outro ainda está pendente.
  update public.organization_invitations invitation
  set status = 'revoked',
      revoked_by = p_actor_id,
      revoked_at = now(),
      metadata = invitation.metadata || jsonb_build_object(
        'revocation_reason', 'replaced_by_resend',
        'replacement_invitation_id', p_invitation_id
      )
  where invitation.org_id = v_invitation.org_id
    and invitation.email = v_invitation.email
    and invitation.status = 'pending'
    and invitation.id <> p_invitation_id;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  update public.organization_invitations invitation
  set token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
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
    jsonb_build_object(
      'email', v_invitation.email,
      'send_count', v_invitation.send_count
    )
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
set search_path = public, extensions, pg_temp
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
  where invitation.token_hash = encode(
    extensions.digest(coalesce(p_token, ''), 'sha256'),
    'hex'
  )
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
set search_path = public, extensions, pg_temp
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
  where invitation.token_hash = encode(
    extensions.digest(coalesce(p_token, ''), 'sha256'),
    'hex'
  )
  for update;

  if not found then
    return query
    select null::uuid, null::text, null::text, false, 'invalid'::text;
    return;
  end if;

  select organization.name into v_organization_name
  from public.organizations organization
  where organization.id = v_invitation.org_id;

  if v_invitation.status = 'accepted' then
    if v_invitation.accepted_by = auth.uid() then
      return query
      select v_invitation.org_id, v_organization_name,
        v_invitation.role::text, true, 'already_accepted'::text;
    else
      return query
      select null::uuid, null::text, null::text, false, 'already_used'::text;
    end if;
    return;
  end if;

  if v_invitation.status = 'revoked' then
    return query
    select v_invitation.org_id, v_organization_name,
      v_invitation.role::text, false, 'revoked'::text;
    return;
  end if;

  if v_invitation.expires_at <= now() then
    update public.organization_invitations
    set status = 'expired'
    where id = v_invitation.id;

    return query
    select v_invitation.org_id, v_organization_name,
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
    jsonb_build_object(
      'email', v_invitation.email,
      'role', v_invitation.role::text
    )
  );

  return query
  select v_invitation.org_id, v_organization_name,
    v_invitation.role::text, true, 'accepted'::text;
end;
$$;

revoke all on function public.resend_organization_invitation(
  uuid, uuid, timestamptz
) from public, anon, authenticated;
revoke all on function public.get_organization_invitation_preview(text) from public;
revoke all on function public.accept_organization_invitation(text) from public, anon;

grant execute on function public.resend_organization_invitation(
  uuid, uuid, timestamptz
) to service_role;
grant execute on function public.get_organization_invitation_preview(text)
  to anon, authenticated, service_role;
grant execute on function public.accept_organization_invitation(text)
  to authenticated, service_role;

drop function public.digest(text, text);
