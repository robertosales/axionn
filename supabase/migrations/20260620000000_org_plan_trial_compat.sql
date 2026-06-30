-- Compatibilidade transitória para a migration legada 20260620_001.
-- O valor é normalizado para free na migration seguinte.

ALTER TYPE public.org_plan ADD VALUE IF NOT EXISTS 'trial';
