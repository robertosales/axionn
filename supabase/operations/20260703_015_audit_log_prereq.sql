-- One-off production prerequisite: install the generic audit_log foundation.
-- Run manually in Lovable Cloud SQL Editor before Operation 2 only when
-- public.audit_log and public.audit_log_trigger_fn() are absent.
-- This keeps the scope minimal: it creates the table, indexes, RLS, and the
-- corrected trigger function, but does not attach new audit triggers.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('axionn:20260703:015_audit_log_prereq'));

DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(object_name, ', ' ORDER BY object_name)
    INTO v_missing
  FROM (
    VALUES
      ('function auth.uid()', to_regprocedure('auth.uid()') IS NOT NULL),
      ('function public.is_admin()', to_regprocedure('public.is_admin()') IS NOT NULL),
      ('table auth.users', to_regclass('auth.users') IS NOT NULL)
  ) AS required(object_name, present)
  WHERE NOT present;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing required audit dependencies: %', v_missing;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text,
  table_name text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  record_id text,
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  user_agent text
);

COMMENT ON TABLE public.audit_log IS
  'Registro imutavel de alteracoes em tabelas criticas. Gravado por triggers SECURITY DEFINER.';

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies policy
    WHERE policy.schemaname = 'public'
      AND policy.tablename = 'audit_log'
      AND policy.policyname = 'audit_log_admin_select'
  ) THEN
    CREATE POLICY "audit_log_admin_select"
    ON public.audit_log FOR SELECT
    USING (public.is_admin());
  END IF;
END;
$$;

REVOKE ALL ON public.audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.audit_log TO service_role;

CREATE OR REPLACE FUNCTION public.audit_log_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_email text;
  v_record_id text;
  v_old_data jsonb;
  v_new_data jsonb;
BEGIN
  BEGIN
    v_actor_id := auth.uid();
  EXCEPTION WHEN others THEN
    v_actor_id := NULL;
  END;

  IF v_actor_id IS NOT NULL THEN
    SELECT email
      INTO v_actor_email
      FROM auth.users
     WHERE id = v_actor_id;
  END IF;

  IF tg_op = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
    v_record_id := coalesce(v_old_data ->> 'id', v_old_data ->> 'user_id');
  ELSIF tg_op = 'INSERT' THEN
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
    v_record_id := coalesce(v_new_data ->> 'id', v_new_data ->> 'user_id');
  ELSE
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
    v_record_id := coalesce(v_new_data ->> 'id', v_new_data ->> 'user_id');
  END IF;

  v_old_data := v_old_data - 'password' - 'encrypted_password' - 'must_change_password';
  v_new_data := v_new_data - 'password' - 'encrypted_password' - 'must_change_password';

  INSERT INTO public.audit_log (
    actor_id,
    actor_email,
    table_name,
    operation,
    record_id,
    old_data,
    new_data
  ) VALUES (
    v_actor_id,
    v_actor_email,
    tg_table_name,
    tg_op,
    v_record_id,
    v_old_data,
    v_new_data
  );

  RETURN coalesce(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.audit_log_trigger_fn() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_log_trigger_fn() TO service_role;

CREATE INDEX IF NOT EXISTS idx_audit_log_actor_id
  ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_table_operation
  ON public.audit_log(table_name, operation);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_record_id
  ON public.audit_log(record_id);

DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NULL THEN
    RAISE EXCEPTION 'Post-validation failed: public.audit_log was not created.';
  END IF;

  IF to_regprocedure('public.audit_log_trigger_fn()') IS NULL THEN
    RAISE EXCEPTION 'Post-validation failed: public.audit_log_trigger_fn() was not created.';
  END IF;

  IF has_table_privilege('anon', 'public.audit_log', 'SELECT')
     OR has_table_privilege('authenticated', 'public.audit_log', 'SELECT')
     OR has_table_privilege('anon', 'public.audit_log', 'INSERT')
     OR has_table_privilege('authenticated', 'public.audit_log', 'INSERT') THEN
    RAISE EXCEPTION 'Post-validation failed: client roles have direct audit_log access.';
  END IF;

  IF has_function_privilege('anon', 'public.audit_log_trigger_fn()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.audit_log_trigger_fn()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Post-validation failed: client roles can execute audit_log_trigger_fn().';
  END IF;
END;
$$;

COMMIT;

SELECT
  to_regclass('public.audit_log') IS NOT NULL AS audit_log_table_ok,
  to_regprocedure('public.audit_log_trigger_fn()') IS NOT NULL AS audit_log_trigger_fn_ok,
  has_table_privilege('service_role', 'public.audit_log', 'INSERT') AS service_role_can_insert_audit_log,
  NOT has_table_privilege('authenticated', 'public.audit_log', 'INSERT') AS authenticated_cannot_insert_audit_log,
  NOT has_function_privilege('authenticated', 'public.audit_log_trigger_fn()', 'EXECUTE') AS authenticated_cannot_execute_audit_fn,
  true AS audit_log_prereq_ok;
