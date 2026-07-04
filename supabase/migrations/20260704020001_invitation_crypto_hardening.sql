-- Finaliza a resolução de pgcrypto sem manter wrappers no schema public.

alter function public.create_organization_invitation(
  uuid, text, text, text[], uuid, timestamptz
) set search_path = public, extensions, pg_temp;

alter function public.resend_organization_invitation(
  uuid, uuid, timestamptz
) set search_path = public, extensions, pg_temp;

alter function public.accept_organization_invitation(text)
  set search_path = public, extensions, pg_temp;

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

revoke all on function public.get_organization_invitation_preview(text) from public;
grant execute on function public.get_organization_invitation_preview(text)
  to anon, authenticated, service_role;

drop function public.digest(text, text);
