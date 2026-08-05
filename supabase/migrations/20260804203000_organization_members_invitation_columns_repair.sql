-- Repair schema drift caused by organization_members having been created by the
-- reduced fallback definition before the invitation feature was installed.
-- accept_organization_invitation() persists both fields below.

alter table public.organization_members
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists joined_at timestamptz not null default now();

comment on column public.organization_members.invited_by is
  'User that issued the invitation which created or reactivated this membership.';

comment on column public.organization_members.joined_at is
  'Timestamp at which the user joined the organization.';
