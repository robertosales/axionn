-- Migration: Reativar Time B no módulo GESP3 (sala_agil)
-- Time B: a2b0e481-2d4e-4fef-82f0-faf127b9ca6f
-- Data: 2026-05-25

-- Garante que o registro exista em team_modules
INSERT INTO team_modules (team_id, module)
VALUES ('a2b0e481-2d4e-4fef-82f0-faf127b9ca6f', 'sala_agil')
ON CONFLICT (team_id, module) DO NOTHING;

-- Confirmação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM team_modules
    WHERE team_id = 'a2b0e481-2d4e-4fef-82f0-faf127b9ca6f'
      AND module = 'sala_agil'
  ) THEN
    RAISE EXCEPTION 'FALHA: Time B ainda não aparece em team_modules após a migration.';
  END IF;
  RAISE NOTICE 'OK: Time B reativado com sucesso no módulo sala_agil (GESP3).';
END $$;
