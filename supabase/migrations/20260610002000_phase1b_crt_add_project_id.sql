-- Fase 1b — adicionar project_id em contract_room_teams.
-- projects.contract_id permanece durante a transição porque views e código posterior ainda dependem dele.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contract_room_teams'
      AND column_name = 'project_id'
  ) THEN
    ALTER TABLE public.contract_room_teams
      ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'contract_room_teams'
      AND constraint_name = 'contract_room_teams_contract_id_team_id_room_type_key'
  ) THEN
    ALTER TABLE public.contract_room_teams
      DROP CONSTRAINT contract_room_teams_contract_id_team_id_room_type_key;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'contract_room_teams'
      AND constraint_name = 'uq_crt_contract_team_project_room'
  ) THEN
    ALTER TABLE public.contract_room_teams
      DROP CONSTRAINT uq_crt_contract_team_project_room;
  END IF;

  ALTER TABLE public.contract_room_teams
    ADD CONSTRAINT uq_crt_contract_team_project_room
    UNIQUE NULLS NOT DISTINCT (contract_id, team_id, project_id, room_type);
END;
$$;

CREATE INDEX IF NOT EXISTS idx_crt_project
  ON public.contract_room_teams(project_id)
  WHERE project_id IS NOT NULL;

COMMENT ON TABLE public.projects IS
  'Projetos globais do sistema. O vínculo com contratos pode existir via projects.contract_id e via contract_room_teams durante a transição.';
