-- ============================================================
-- MIGRATION: Fase 1 — Contratos Foundation (Produção-Safe)
-- Data: 2026-06-10
-- Branch: refactor/contracts-phase0-homolog
--
-- O QUE FAZ:
--   1. Remove RPCs órfãs nunca chamadas pelo frontend
--   2. Recria contract_room_teams com estrutura limpa
--   3. Cria 1 contrato por time existente (sustentacao/agil)
--   4. Popula teams.contract_id e teams.team_type
--   5. Popula contract_slas com os valores hardcoded do frontend
--   6. Popula contract_room_teams a partir dos times reais
--
-- GARANTIAS:
--   ✅ Todas as operações são ON CONFLICT DO NOTHING ou idempotentes
--   ✅ Nenhuma coluna existente é alterada
--   ✅ Sistema legado continua funcionando durante e após a migration
--   ✅ Seguro para rodar múltiplas vezes sem efeitos colaterais
-- ============================================================

-- ============================================================
-- BLOCO 1: LIMPEZA — Remove RPCs nunca usadas pelo frontend
-- ============================================================
DROP FUNCTION IF EXISTS public.fn_check_sla_status(UUID, UUID, VARCHAR, TIMESTAMPTZ, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.fn_get_team_contract(UUID);

-- ============================================================
-- BLOCO 2: RECRIAR contract_room_teams (estrutura limpa)
-- CASCADE remove policies dependentes em projects, contracts
-- e contract_slas que referenciam esta tabela — todas são
-- recriadas logo abaixo com implementação correta.
-- ============================================================
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.contract_room_teams) = 0 THEN

    DROP POLICY IF EXISTS "projects_insert"                   ON public.projects;
    DROP POLICY IF EXISTS "contracts_select"                  ON public.contracts;
    DROP POLICY IF EXISTS "contract_slas_select_team_members" ON public.contract_slas;
    DROP POLICY IF EXISTS "Admins manage contract_room_teams" ON public.contract_room_teams;
    DROP POLICY IF EXISTS "Members view contract_room_teams"  ON public.contract_room_teams;

    DROP TABLE public.contract_room_teams CASCADE;

    CREATE TABLE public.contract_room_teams (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      contract_id UUID        NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
      team_id     UUID        NOT NULL REFERENCES public.teams(id)     ON DELETE CASCADE,
      room_type   TEXT        NOT NULL CHECK (room_type IN ('agil', 'sustentacao')),
      is_active   BOOLEAN     NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (contract_id, team_id, room_type)
    );

    CREATE INDEX idx_crt_contract ON public.contract_room_teams(contract_id);
    CREATE INDEX idx_crt_team     ON public.contract_room_teams(team_id);
    CREATE INDEX idx_crt_active   ON public.contract_room_teams(is_active) WHERE is_active = true;

    ALTER TABLE public.contract_room_teams ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "crt_admin_all"
      ON public.contract_room_teams FOR ALL
      USING (public.is_admin());

    CREATE POLICY "crt_members_select"
      ON public.contract_room_teams FOR SELECT
      USING (auth.uid() IS NOT NULL);

    DROP TRIGGER IF EXISTS trg_crt_updated_at ON public.contract_room_teams;
    CREATE TRIGGER trg_crt_updated_at
      BEFORE UPDATE ON public.contract_room_teams
      FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

    COMMENT ON TABLE public.contract_room_teams IS
      'Vínculo N:N entre contratos, times e tipos de sala (agil/sustentacao). '
      'Permite que o mesmo time opere em múltiplas modalidades de um contrato (híbrido).';

    -- Recriar policies removidas pelo CASCADE
    DROP POLICY IF EXISTS "projects_insert" ON public.projects;
    CREATE POLICY "projects_insert"
      ON public.projects FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');

    DROP POLICY IF EXISTS "contracts_select" ON public.contracts;
    CREATE POLICY "contracts_select"
      ON public.contracts FOR SELECT
      USING (auth.role() = 'authenticated');

    DROP POLICY IF EXISTS "contract_slas_select_team_members" ON public.contract_slas;
    CREATE POLICY "contract_slas_select_team_members"
      ON public.contract_slas FOR SELECT
      USING (
        auth.role() = 'authenticated'
        AND (
          public.is_admin()
          OR EXISTS (
            SELECT 1
            FROM   public.contract_room_teams crt
            JOIN   public.team_members tm ON tm.team_id = crt.team_id
            WHERE  crt.contract_id = contract_slas.contract_id
              AND  tm.user_id      = auth.uid()
          )
        )
      );

  END IF;
END;
$$;

-- ============================================================
-- BLOCO 3: CRIAR CONTRATOS a partir dos times existentes
-- 1 contrato por time ainda sem contract_id
-- ============================================================
DROP TABLE IF EXISTS _phase1_team_contract_map;

CREATE TEMP TABLE _phase1_team_contract_map (
  team_id     UUID,
  contract_id UUID,
  room_type   TEXT
);

WITH teams_sem_contrato AS (
  SELECT
    t.id   AS team_id,
    t.name AS team_name,
    CASE
      WHEN COALESCE(t.module::TEXT, '') = 'agil' THEN 'agil'
      ELSE 'sustentacao'
    END    AS room_type
  FROM public.teams t
  WHERE t.contract_id IS NULL        -- só times ainda sem contrato
),
contratos_inseridos AS (
  INSERT INTO public.contracts (name, description, status, room_mode)
  SELECT
    t.team_name,
    'Contrato gerado automaticamente pela migração Fase 1 a partir do time: ' || t.team_name,
    'active',
    t.room_type
  FROM teams_sem_contrato t
  ON CONFLICT DO NOTHING
  RETURNING id, name
)
INSERT INTO _phase1_team_contract_map (team_id, contract_id, room_type)
SELECT
  ts.team_id,
  ci.id,
  ts.room_type
FROM teams_sem_contrato ts
JOIN contratos_inseridos ci ON ci.name = ts.team_name;

-- ============================================================
-- BLOCO 4: ATUALIZAR teams.contract_id e teams.team_type
-- ============================================================
UPDATE public.teams t
SET
  contract_id = m.contract_id,
  team_type   = CASE m.room_type
                  WHEN 'agil'        THEN 'agile'
                  WHEN 'sustentacao' THEN 'sustenance'
                  ELSE 'sustenance'
                END
FROM _phase1_team_contract_map m
WHERE t.id = m.team_id
  AND t.contract_id IS NULL;

-- ============================================================
-- BLOCO 5: POPULAR contract_slas
-- Valores hardcoded extraídos do frontend:
--   urgent : 60 min resposta  | 240 min resolução
--   high   : 120 min          | 480 min
--   medium : 240 min          | 1440 min (1 dia útil)
--   low    : 480 min          | 2880 min (2 dias úteis)
-- ============================================================
INSERT INTO public.contract_slas
  (contract_id, priority, response_time_minutes, resolution_time_minutes, business_hours_only)
SELECT
  c.id,
  sla.priority,
  sla.response_time_minutes,
  sla.resolution_time_minutes,
  true
FROM public.contracts c
CROSS JOIN (
  VALUES
    ('urgent', 60,  240),
    ('high',   120, 480),
    ('medium', 240, 1440),
    ('low',    480, 2880)
) AS sla(priority, response_time_minutes, resolution_time_minutes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.contract_slas cs
  WHERE cs.contract_id = c.id
    AND cs.priority    = sla.priority
)
ON CONFLICT ON CONSTRAINT unique_contract_priority DO NOTHING;

-- ============================================================
-- BLOCO 6: POPULAR contract_room_teams
-- ============================================================
INSERT INTO public.contract_room_teams (contract_id, team_id, room_type)
SELECT
  t.contract_id,
  t.id,
  CASE t.team_type
    WHEN 'agile'      THEN 'agil'
    WHEN 'sustenance' THEN 'sustentacao'
    ELSE 'sustentacao'
  END
FROM public.teams t
WHERE t.contract_id IS NOT NULL
ON CONFLICT (contract_id, team_id, room_type) DO NOTHING;

-- ============================================================
-- BLOCO 7: LIMPEZA
-- ============================================================
DROP TABLE IF EXISTS _phase1_team_contract_map;

-- ============================================================
-- VERIFICAÇÃO (rode manualmente no SQL Editor para confirmar)
-- ============================================================
-- SELECT c.name, c.room_mode, c.status,
--        COUNT(DISTINCT cs.id) AS sla_rules,
--        COUNT(DISTINCT crt.id) AS team_links
-- FROM public.contracts c
-- LEFT JOIN public.contract_slas cs ON cs.contract_id = c.id
-- LEFT JOIN public.contract_room_teams crt ON crt.contract_id = c.id
-- GROUP BY c.id, c.name, c.room_mode, c.status
-- ORDER BY c.name;

-- ============================================================
-- FIM DA MIGRATION — Fase 1 concluída
-- Próximo: 20260610_phase2_projects_contract_link.sql
-- ============================================================
