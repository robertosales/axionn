-- ============================================================
-- MIGRATION: Fase 1 — Contratos Foundation
-- ============================================================

DROP FUNCTION IF EXISTS public.fn_check_sla_status(uuid, uuid, varchar, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.fn_get_team_contract(uuid);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.contract_room_teams) = 0 THEN
    DROP POLICY IF EXISTS projects_insert ON public.projects;
    DROP POLICY IF EXISTS contracts_select ON public.contracts;
    DROP POLICY IF EXISTS contract_slas_select_team_members ON public.contract_slas;
    DROP POLICY IF EXISTS "Admins manage contract_room_teams" ON public.contract_room_teams;
    DROP POLICY IF EXISTS "Members view contract_room_teams" ON public.contract_room_teams;

    DROP TABLE public.contract_room_teams CASCADE;

    CREATE TABLE public.contract_room_teams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
      team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
      room_type text NOT NULL CHECK (room_type IN ('agil', 'sustentacao')),
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (contract_id, team_id, room_type)
    );

    CREATE INDEX idx_crt_contract ON public.contract_room_teams(contract_id);
    CREATE INDEX idx_crt_team ON public.contract_room_teams(team_id);
    CREATE INDEX idx_crt_active ON public.contract_room_teams(is_active)
      WHERE is_active = true;

    ALTER TABLE public.contract_room_teams ENABLE ROW LEVEL SECURITY;

    CREATE POLICY crt_admin_all
      ON public.contract_room_teams FOR ALL
      USING (public.is_admin())
      WITH CHECK (public.is_admin());

    CREATE POLICY crt_members_select
      ON public.contract_room_teams FOR SELECT
      USING (auth.uid() IS NOT NULL);

    DROP TRIGGER IF EXISTS trg_crt_updated_at ON public.contract_room_teams;
    CREATE TRIGGER trg_crt_updated_at
      BEFORE UPDATE ON public.contract_room_teams
      FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

    DROP POLICY IF EXISTS projects_insert ON public.projects;
    CREATE POLICY projects_insert
      ON public.projects FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');

    DROP POLICY IF EXISTS contracts_select ON public.contracts;
    CREATE POLICY contracts_select
      ON public.contracts FOR SELECT
      USING (auth.role() = 'authenticated');

    DROP POLICY IF EXISTS contract_slas_select_team_members ON public.contract_slas;
    CREATE POLICY contract_slas_select_team_members
      ON public.contract_slas FOR SELECT
      USING (
        auth.role() = 'authenticated'
        AND (
          public.is_admin()
          OR EXISTS (
            SELECT 1
            FROM public.contract_room_teams relation
            JOIN public.team_members member ON member.team_id = relation.team_id
            WHERE relation.contract_id = contract_slas.contract_id
              AND member.user_id = auth.uid()
          )
        )
      );
  END IF;
END;
$$;

DROP TABLE IF EXISTS _phase1_team_contract_map;

CREATE TEMP TABLE _phase1_team_contract_map (
  team_id uuid,
  contract_id uuid,
  room_type text
);

WITH teams_sem_contrato AS (
  SELECT
    team.id AS team_id,
    team.name AS team_name,
    CASE
      WHEN coalesce(team.module::text, '') = 'agil' THEN 'agil'
      ELSE 'sustentacao'
    END AS room_type
  FROM public.teams team
  WHERE team.contract_id IS NULL
),
contratos_inseridos AS (
  INSERT INTO public.contracts (name, description, status, room_mode)
  SELECT
    source.team_name,
    'Contrato gerado automaticamente pela migração Fase 1 a partir do time: ' || source.team_name,
    'active',
    source.room_type
  FROM teams_sem_contrato source
  ON CONFLICT DO NOTHING
  RETURNING id, name
)
INSERT INTO _phase1_team_contract_map (team_id, contract_id, room_type)
SELECT
  source.team_id,
  contract.id,
  source.room_type
FROM teams_sem_contrato source
JOIN contratos_inseridos contract ON contract.name = source.team_name;

UPDATE public.teams team
SET
  contract_id = map.contract_id,
  team_type = CASE map.room_type
    WHEN 'agil' THEN 'agile'
    WHEN 'sustentacao' THEN 'sustenance'
    ELSE 'sustenance'
  END
FROM _phase1_team_contract_map map
WHERE team.id = map.team_id
  AND team.contract_id IS NULL;

INSERT INTO public.contract_slas (
  contract_id,
  priority,
  response_time_minutes,
  resolution_time_minutes,
  business_hours_only
)
SELECT
  contract.id,
  sla.priority,
  sla.response_time_minutes,
  sla.resolution_time_minutes,
  true
FROM public.contracts contract
CROSS JOIN (
  VALUES
    ('urgent', 60, 240),
    ('high', 120, 480),
    ('medium', 240, 1440),
    ('low', 480, 2880)
) AS sla(priority, response_time_minutes, resolution_time_minutes)
ON CONFLICT (contract_id, priority) DO NOTHING;

INSERT INTO public.contract_room_teams (contract_id, team_id, room_type)
SELECT
  team.contract_id,
  team.id,
  CASE team.team_type
    WHEN 'agile' THEN 'agil'
    WHEN 'sustenance' THEN 'sustentacao'
    ELSE 'sustentacao'
  END
FROM public.teams team
WHERE team.contract_id IS NOT NULL
ON CONFLICT (contract_id, team_id, room_type) DO NOTHING;

DROP TABLE IF EXISTS _phase1_team_contract_map;
