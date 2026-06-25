-- ============================================================
-- MIGRATION: 006 — Organization GlobalWeb + vínculo de contratos
-- Branch:    feat/multi-tenancy-apf-engine
-- Data:      2026-06-20
-- Descrição:
--   1. Cria a organization GlobalWeb (tenant principal)
--   2. Define roberto.sales como owner
--   3. Adiciona usuários @globalweb.com.br como members
--   4. Vincula os 2 contratos existentes à org
--   5. Remove a sessão de teste criada durante validação
-- ============================================================

DO $$
DECLARE
  v_org_id      UUID;

  -- Usuários
  v_roberto     UUID := '3c472f37-eabb-4a95-a859-1a1cf89f5d37';
  v_raphael     UUID := '0c7d35c3-cff5-40a2-bb9e-2c3138fec1e3';
  v_mayla       UUID := 'cea65112-ea4b-4a7e-ae53-c380e25f6a42';
  v_eduardo     UUID := '2e6a06bb-a047-4933-8b70-bb4d40e5bb48';

  -- Contratos
  v_contrato_pf      UUID := 'd59ab6dc-421f-41b4-b415-ae0bc072ebd4';
  v_contrato_detran  UUID := 'fd7424d2-dc34-43c6-bda0-adebec335d6c';

  -- Sessão de teste
  v_session_teste UUID := '5844becc-1ae8-4bb6-99ec-d6f95d31a06a';

BEGIN

  -- --------------------------------------------------------
  -- 1. Criar organization GlobalWeb
  -- --------------------------------------------------------
  INSERT INTO public.organizations (
    id,
    name,
    slug,
    plan,
    status,
    contact_email,
    contact_name,
    max_projects,
    max_users,
    max_countings_per_month
  ) VALUES (
    gen_random_uuid(),
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
    SET
      name   = EXCLUDED.name,
      plan   = EXCLUDED.plan,
      status = EXCLUDED.status,
      updated_at = now()
  RETURNING id INTO v_org_id;

  RAISE NOTICE 'Organization GlobalWeb: %', v_org_id;

  -- --------------------------------------------------------
  -- 2. Membros da org
  -- --------------------------------------------------------

  -- Owner: roberto.sales
  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (v_org_id, v_roberto, 'owner')
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'owner';

  -- Admin: raphael.santos@globalweb.com.br
  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (v_org_id, v_raphael, 'admin')
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'admin';

  -- Member: maylanesn@globalweb.com.br
  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (v_org_id, v_mayla, 'member')
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'member';

  -- Member: eduardo.ventura@globalweb.com.br
  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (v_org_id, v_eduardo, 'member')
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'member';

  RAISE NOTICE 'Membros inseridos: owner + 1 admin + 2 members';

  -- --------------------------------------------------------
  -- 3. Vincular contratos à org
  -- --------------------------------------------------------
  UPDATE public.contracts
  SET org_id = v_org_id
  WHERE id IN (v_contrato_pf, v_contrato_detran)
    AND org_id IS NULL;

  RAISE NOTICE 'Contratos vinculados à org %', v_org_id;

  -- --------------------------------------------------------
  -- 4. Limpar sessão de teste (itens e gray_zones em cascade)
  -- --------------------------------------------------------
  DELETE FROM public.apf_counting_sessions
  WHERE id = v_session_teste;

  RAISE NOTICE 'Sessão de teste % removida', v_session_teste;

END;
$$;

-- --------------------------------------------------------
-- Verificação final (retorna estado pós-migration)
-- --------------------------------------------------------
SELECT
  o.name          AS org_name,
  o.slug,
  o.plan,
  o.status,
  COUNT(om.id)    AS total_members,
  COUNT(c.id)     AS total_contracts
FROM public.organizations o
LEFT JOIN public.organization_members om ON om.org_id = o.id
LEFT JOIN public.contracts c             ON c.org_id  = o.id
WHERE o.slug = 'globalweb'
GROUP BY o.id, o.name, o.slug, o.plan, o.status;
