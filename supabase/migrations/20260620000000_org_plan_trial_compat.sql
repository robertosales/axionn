-- Compatibilidade transitória para a migration legada 20260620_001.
-- O valor trial é normalizado para free na migration seguinte.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type type
    JOIN pg_namespace namespace ON namespace.oid = type.typnamespace
    WHERE namespace.nspname = 'public'
      AND type.typname = 'org_plan'
  ) THEN
    CREATE TYPE public.org_plan AS ENUM ('free', 'pro', 'enterprise', 'trial');
  ELSE
    ALTER TYPE public.org_plan ADD VALUE IF NOT EXISTS 'trial';
  END IF;
END;
$$;
