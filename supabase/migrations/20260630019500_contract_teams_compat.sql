-- Compatibilidade para instalações em que o vínculo legado contract_teams
-- não foi criado pelas migrations históricas.

DO $$
BEGIN
  IF to_regclass('public.contract_teams') IS NULL THEN
    CREATE TABLE public.contract_teams (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
      team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT contract_teams_contract_id_team_id_key UNIQUE (contract_id, team_id)
    );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_contract_teams_contract_id
  ON public.contract_teams(contract_id);

CREATE INDEX IF NOT EXISTS idx_contract_teams_team_id
  ON public.contract_teams(team_id);

ALTER TABLE public.contract_teams ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.contract_teams IS
  'Vínculo compatível entre contratos e times, preservado durante a consolidação multi-tenant.';
