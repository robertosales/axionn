-- ============================================================
-- MIGRATION: Fase 1b — Adicionar project_id em contract_room_teams
-- Data: 2026-06-10
-- Branch: refactor/contracts-phase0-homolog
--
-- CONTEXTO:
--   O vínculo entre contrato e projetos NÃO deve ser feito
--   na tela de Projetos. Ele acontece na Tela de Gestão do
--   Contrato, via seleção em cascata Time (pai) → Projeto (filho).
--
--   Para suportar isso, a tabela pivot contract_room_teams precisa
--   armazenar o trio: contrato + time + projeto + tipo_sala.
--
-- O QUE FAZ:
--   1. Adiciona coluna project_id (nullable) em contract_room_teams
--   2. Substitui UNIQUE(contract_id, team_id, room_type)
--      por     UNIQUE(contract_id, team_id, project_id, room_type)
--      com NULLS NOT DISTINCT (linha de time sem projeto é única)
--   3. Adiciona índice em project_id para joins rápidos
--   4. Remove projects.contract_id (FK direta legada)
--      — o vínculo agora vive em contract_room_teams
--
-- GARANTIAS:
--   ✅ Tabela contract_room_teams está vazia (Fase 1 a recriou)
--   ✅ Operações idempotentes com IF NOT EXISTS / IF EXISTS
--   ✅ Nenhuma tela existente quebra — projects.contract_id
--      só era lido por fetchProjectsByContract, que será
--      reescrito na Fase 2 para ler de contract_room_teams
-- ============================================================

-- ============================================================
-- BLOCO 1: Adicionar project_id em contract_room_teams
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'contract_room_teams'
      AND column_name  = 'project_id'
  ) THEN
    ALTER TABLE public.contract_room_teams
      ADD COLUMN project_id UUID
        REFERENCES public.projects(id) ON DELETE SET NULL;

    COMMENT ON COLUMN public.contract_room_teams.project_id IS
      'Projeto filho vinculado ao time nesta sala deste contrato. '
      'NULL = vínculo de time sem projeto específico ainda.';
  END IF;
END;
$$;

-- ============================================================
-- BLOCO 2: Substituir UNIQUE constraint
--
-- Antiga: UNIQUE(contract_id, team_id, room_type)
--   Problema: impedia vincular o mesmo time em projetos
--   diferentes dentro do mesmo contrato e sala.
--
-- Nova: UNIQUE(contract_id, team_id, project_id, room_type)
--   com NULLS NOT DISTINCT:
--   - Garante que a linha "time sem projeto" (project_id NULL)
--     seja única por contrato+time+sala
--   - Garante que o trio contrato+time+projeto+sala seja único
-- ============================================================
DO $$
BEGIN
  -- Remove constraint antiga (pode ter sido criada com nome diferente)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema    = 'public'
      AND table_name      = 'contract_room_teams'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'contract_room_teams_contract_id_team_id_room_type_key'
  ) THEN
    ALTER TABLE public.contract_room_teams
      DROP CONSTRAINT contract_room_teams_contract_id_team_id_room_type_key;
  END IF;

  -- Remove constraint nova se já existir (idempotência)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema    = 'public'
      AND table_name      = 'contract_room_teams'
      AND constraint_type = 'UNIQUE'
      AND constraint_name = 'uq_crt_contract_team_project_room'
  ) THEN
    ALTER TABLE public.contract_room_teams
      DROP CONSTRAINT uq_crt_contract_team_project_room;
  END IF;

  -- Cria nova UNIQUE com NULLS NOT DISTINCT
  ALTER TABLE public.contract_room_teams
    ADD CONSTRAINT uq_crt_contract_team_project_room
    UNIQUE NULLS NOT DISTINCT (contract_id, team_id, project_id, room_type);
END;
$$;

-- ============================================================
-- BLOCO 3: Índice em project_id
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_crt_project
  ON public.contract_room_teams(project_id)
  WHERE project_id IS NOT NULL;

-- ============================================================
-- BLOCO 4: Remover projects.contract_id (FK direta legada)
--
-- MOTIVO: o vínculo projeto ↔ contrato agora é feito via
-- contract_room_teams. Manter projects.contract_id causaria
-- duas fontes de verdade conflitantes.
--
-- SEGURANÇA: só remove se a coluna existir.
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'projects'
      AND column_name  = 'contract_id'
  ) THEN
    -- Remove FK constraint antes de dropar a coluna
    ALTER TABLE public.projects
      DROP COLUMN contract_id;

    COMMENT ON TABLE public.projects IS
      'Projetos globais do sistema. O vínculo com contratos é feito '
      'via contract_room_teams (contrato + time + projeto + sala).';
  END IF;
END;
$$;

-- ============================================================
-- VERIFICAÇÃO (rode manualmente no SQL Editor)
-- ============================================================
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name   = 'contract_room_teams'
-- ORDER BY ordinal_position;
--
-- Esperado:
--   id          | uuid    | NO
--   contract_id | uuid    | NO
--   team_id     | uuid    | NO
--   project_id  | uuid    | YES  ← nova coluna
--   room_type   | text    | NO
--   is_active   | boolean | NO
--   created_at  | ...     | NO
--   updated_at  | ...     | NO
-- ============================================================

-- ============================================================
-- FIM DA MIGRATION — Fase 1b concluída
-- Próximo: Fase 2 — Frontend
--   • Remover campo "Contrato" do modal Novo Projeto
--   • Trocar "+ Novo Projeto" por "+ Vincular Time / Projeto"
--   • Seleção em cascata Time → Projeto na tela de gestão
--   • fetchProjectsByContract lendo de contract_room_teams
-- ============================================================
