-- Backfill específico da organização GlobalWeb.
-- Bancos novos sem os usuários-alvo ignoram esta etapa.

DO $$
DECLARE
  v_org_id uuid;
  v_existing_users integer;
  v_roberto uuid := '3c472f37-eabb-4a95-a859-1a1cf89f5d37';
  v_raphael uuid := '0c7d35c3-cff5-40a2-bb9e-2c3138fec1e3';
  v_mayla uuid := 'cea65112-ea4b-4a7e-ae53-c380e25f6a42';
  v_eduardo uuid := '2e6a06bb-a047-4933-8b70-bb4d40e5bb48';
  v_contrato_pf uuid := 'd59ab6dc-421f-41b4-b415-ae0bc072ebd4';
  v_contrato_detran uuid := 'fd7424d2-dc34-43c6-bda0-adebec335d6c';
  v_session_teste uuid := '5844becc-1ae8-4bb6-99ec-d6f95d31a06a';
BEGIN
  SELECT count(*)
    INTO v_existing_users
    FROM auth.users
   WHERE id IN (v_roberto, v_raphael, v_mayla, v_eduardo);

  IF v_existing_users = 0 THEN
    RAISE NOTICE 'Backfill GlobalWeb ignorado: nenhum usuário-alvo existe neste ambiente.';
    RETURN;
  END IF;

  INSERT INTO public.organizations (
    name,
    slug,
    plan,
    status,
    contact_email,
    contact_name,
    max_projects,
    max_users,
    max_countings_per_month
  )
  VALUES (
    'GlobalWeb',
    'globalweb',
    'enterprise',
    'active',
    'roberto.sales@gmail.com',
    'Roberto Sales',
    100,
    50,
    500
  )
  ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name,
        plan = EXCLUDED.plan,
        status = EXCLUDED.status,
        updated_at = now()
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (org_id, user_id, role)
  SELECT
    v_org_id,
    candidate.user_id,
    candidate.role::public.org_member_role
  FROM (
    VALUES
      (v_roberto, 'owner'),
      (v_raphael, 'admin'),
      (v_mayla, 'member'),
      (v_eduardo, 'member')
  ) AS candidate(user_id, role)
  JOIN auth.users app_user ON app_user.id = candidate.user_id
  ON CONFLICT (org_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members member
    WHERE member.org_id = v_org_id
      AND member.role IN ('owner', 'admin')
  ) THEN
    UPDATE public.organization_members member
       SET role = 'admin'
     WHERE member.id = (
       SELECT first_member.id
       FROM public.organization_members first_member
       WHERE first_member.org_id = v_org_id
       ORDER BY first_member.joined_at, first_member.id
       LIMIT 1
     );
  END IF;

  UPDATE public.contracts
     SET org_id = v_org_id
   WHERE id IN (v_contrato_pf, v_contrato_detran)
     AND org_id IS NULL;

  DELETE FROM public.apf_counting_sessions
   WHERE id = v_session_teste;
END;
$$;
