-- Repair get_organization_members_v2 runtime ambiguity and normalize return types.

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
  if auth.uid() is null
     or not coalesce(public.is_organization_admin(p_org_id, auth.uid()), false) then
    raise exception using
      errcode = '42501',
      message = 'organization_members_access_denied';
  end if;

  return query
  with member_modules as (
    select
      module_access.org_id,
      module_access.user_id,
      array_agg(
        module_access.module_key::text
        order by module_access.module_key::text
      )::text[] as module_keys
    from public.organization_member_modules module_access
    group by module_access.org_id, module_access.user_id
  )
  select
    member.user_id::uuid,
    coalesce(
      nullif(profile.display_name::text, ''),
      user_account.email::text,
      'Usuário'::text
    )::text as resolved_display_name,
    coalesce(
      nullif(profile.email::text, ''),
      user_account.email::text,
      ''::text
    )::text as resolved_email,
    member.role::text as resolved_membership_role,
    member.is_active::boolean,
    member.joined_at::timestamptz,
    coalesce(member_modules.module_keys, '{}'::text[])::text[]
  from public.organization_members member
  left join public.profiles profile
    on profile.user_id = member.user_id
  left join auth.users user_account
    on user_account.id = member.user_id
  left join member_modules
    on member_modules.org_id = member.org_id
   and member_modules.user_id = member.user_id
  where member.org_id = p_org_id
  order by
    member.is_active desc,
    case member.role::text
      when 'owner' then 0
      when 'admin' then 1
      else 2
    end,
    lower(
      coalesce(
        nullif(profile.display_name::text, ''),
        user_account.email::text,
        'Usuário'::text
      )
    );
end;
$$;

revoke all on function public.get_organization_members_v2(uuid)
  from public, anon;
grant execute on function public.get_organization_members_v2(uuid)
  to authenticated, service_role;

select pg_notify('pgrst', 'reload schema');
