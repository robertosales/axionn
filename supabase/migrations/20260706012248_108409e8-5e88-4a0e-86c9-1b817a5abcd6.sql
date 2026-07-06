CREATE OR REPLACE FUNCTION public.get_organization_members_v2(p_org_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  email text,
  membership_role text,
  is_active boolean,
  joined_at timestamptz,
  module_keys text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR NOT COALESCE(public.is_organization_admin(p_org_id, auth.uid()), false) THEN
    RAISE EXCEPTION USING errcode = '42501', message = 'organization_members_access_denied';
  END IF;

  RETURN QUERY
  WITH member_modules AS (
    SELECT
      module_access.org_id,
      module_access.user_id,
      array_agg(module_access.module_key::text ORDER BY module_access.module_key::text)::text[] AS module_keys
    FROM public.organization_member_modules module_access
    GROUP BY module_access.org_id, module_access.user_id
  )
  SELECT
    member.user_id::uuid,
    COALESCE(NULLIF(profile.display_name::text, ''), user_account.email::text, 'Usuário')::text,
    COALESCE(NULLIF(profile.email::text, ''), user_account.email::text, '')::text,
    member.role::text,
    member.is_active::boolean,
    member.created_at::timestamptz AS joined_at,
    COALESCE(member_modules.module_keys, '{}'::text[])::text[]
  FROM public.organization_members member
  LEFT JOIN public.profiles profile ON profile.user_id = member.user_id
  LEFT JOIN auth.users user_account ON user_account.id = member.user_id
  LEFT JOIN member_modules
    ON member_modules.org_id = member.org_id
   AND member_modules.user_id = member.user_id
  WHERE member.org_id = p_org_id
  ORDER BY
    member.is_active DESC,
    CASE member.role::text WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
    lower(COALESCE(NULLIF(profile.display_name::text, ''), user_account.email::text, 'Usuário'));
END;
$$;

REVOKE ALL ON FUNCTION public.get_organization_members_v2(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_organization_members_v2(uuid) TO authenticated, service_role;

SELECT pg_notify('pgrst', 'reload schema');