-- ============================================================
-- FASE 2B: Policies RLS permissivas por contrato
-- Alinhada ao schema canônico e tolerante às relações legadas opcionais.
-- ============================================================

DROP POLICY IF EXISTS "contract_members_can_select_contract" ON public.contracts;
CREATE POLICY "contract_members_can_select_contract"
  ON public.contracts AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_contract_member(auth.uid(), id));

DROP POLICY IF EXISTS "contract_members_can_select_teams" ON public.teams;
CREATE POLICY "contract_members_can_select_teams"
  ON public.teams AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_contract_member(auth.uid(), contract_id));

DROP POLICY IF EXISTS "contract_members_can_select_sprints" ON public.sprints;
CREATE POLICY "contract_members_can_select_sprints"
  ON public.sprints AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_team_in_user_contracts(auth.uid(), team_id));

DROP POLICY IF EXISTS "contract_members_can_select_epics" ON public.epics;
CREATE POLICY "contract_members_can_select_epics"
  ON public.epics AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_team_in_user_contracts(auth.uid(), team_id));

DROP POLICY IF EXISTS "contract_members_can_select_demandas" ON public.demandas;
CREATE POLICY "contract_members_can_select_demandas"
  ON public.demandas AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_team_in_user_contracts(auth.uid(), team_id));

-- Relação legada opcional: só instala a policy quando a tabela e a coluna existem.
DO $$
BEGIN
  IF to_regclass('public.comentarios') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'comentarios'
         AND column_name = 'demanda_id'
     ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "contract_members_can_select_comentarios" ON public.comentarios';
    EXECUTE $policy$
      CREATE POLICY "contract_members_can_select_comentarios"
        ON public.comentarios AS PERMISSIVE FOR SELECT TO authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.demandas demand
            WHERE demand.id = comentarios.demanda_id
              AND public.is_team_in_user_contracts(auth.uid(), demand.team_id)
          )
        )
    $policy$;
  END IF;
END;
$$;

-- Schema canônico: attachments possui team_id direto.
DROP POLICY IF EXISTS "contract_members_can_select_attachments" ON public.attachments;
CREATE POLICY "contract_members_can_select_attachments"
  ON public.attachments AS PERMISSIVE FOR SELECT TO authenticated
  USING (public.is_team_in_user_contracts(auth.uid(), team_id));
