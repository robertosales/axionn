-- Axionn Quality Intelligence — Invariantes de integridade cross-tenant
-- Protege contra INSERT/UPDATE que misturam organization_id de tabelas pai/filho.
-- Executar exclusivamente pelo Lovable.

begin;

-- ============================================================
-- 1. FUNÇÃO GENÉRICA DE VALIDAÇÃO CROSS-TENANT
-- ============================================================

CREATE OR REPLACE FUNCTION public.assert_quality_parent_org_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp AS
$$
DECLARE
  v_parent_org uuid;
BEGIN
  -- resolution logic: checa coluna organization_id da tabela pai via join implícito
  -- Tabelas filhas: qualidade_test_steps → quality_test_cases
  IF TG_TABLE_NAME = 'quality_test_steps' THEN
    SELECT organization_id INTO v_parent_org
      FROM public.quality_test_cases WHERE id = NEW.test_case_id;
    IF v_parent_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION USING
        errcode = '23514',
        message = 'quality_tenant_mismatch: parent organization_id ≠ child organization_id';
    END IF;

  ELSIF TG_TABLE_NAME = 'quality_test_case_links' THEN
    SELECT organization_id INTO v_parent_org
      FROM public.quality_test_cases WHERE id = NEW.test_case_id;
    IF v_parent_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION USING
        errcode = '23514',
        message = 'quality_tenant_mismatch: test_case organization mismatch';
    END IF;

  ELSIF TG_TABLE_NAME = 'quality_test_case_versions' THEN
    SELECT organization_id INTO v_parent_org
      FROM public.quality_test_cases WHERE id = NEW.test_case_id;
    IF v_parent_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION USING
        errcode = '23514',
        message = 'quality_tenant_mismatch: test_case organization mismatch';
    END IF;

  ELSIF TG_TABLE_NAME = 'quality_test_suite_items' THEN
    SELECT organization_id INTO v_parent_org
      FROM public.quality_test_suites WHERE id = NEW.suite_id;
    IF v_parent_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION USING
        errcode = '23514',
        message = 'quality_tenant_mismatch: suite organization mismatch';
    END IF;

  ELSIF TG_TABLE_NAME = 'quality_test_plan_items' THEN
    SELECT organization_id INTO v_parent_org
      FROM public.quality_test_plans WHERE id = NEW.test_plan_id;
    IF v_parent_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION USING
        errcode = '23514',
        message = 'quality_tenant_mismatch: test_plan organization mismatch';
    END IF;

  ELSIF TG_TABLE_NAME = 'quality_test_run_items' THEN
    SELECT organization_id INTO v_parent_org
      FROM public.quality_test_runs WHERE id = NEW.test_run_id;
    IF v_parent_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION USING
        errcode = '23514',
        message = 'quality_tenant_mismatch: test_run organization mismatch';
    END IF;

  ELSIF TG_TABLE_NAME = 'quality_test_step_results' THEN
    SELECT organization_id INTO v_parent_org
      FROM public.quality_test_run_items WHERE id = NEW.run_item_id;
    IF v_parent_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION USING
        errcode = '23514',
        message = 'quality_tenant_mismatch: run_item organization mismatch';
    END IF;

  ELSIF TG_TABLE_NAME = 'quality_test_evidences' THEN
    SELECT organization_id INTO v_parent_org
      FROM public.quality_test_run_items WHERE id = NEW.run_item_id;
    IF v_parent_org IS DISTINCT FROM NEW.organization_id THEN
      RAISE EXCEPTION USING
        errcode = '23514',
        message = 'quality_tenant_mismatch: run_item organization mismatch';
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. APLICAR TRIGGERS EM TODAS AS TABELAS FILHAS
-- ============================================================

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'quality_test_steps',
    'quality_test_case_links',
    'quality_test_case_versions',
    'quality_test_suite_items',
    'quality_test_plan_items',
    'quality_test_run_items',
    'quality_test_step_results',
    'quality_test_evidences'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_quality_parent_org_%s ON public.%I', tbl, tbl
    );
    EXECUTE format(
      'CREATE TRIGGER trg_quality_parent_org_%s BEFORE INSERT OR UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.assert_quality_parent_org_match()',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ============================================================
-- 3. CORREÇÃO: completed_at SÓ EM STATUS TERMINAIS
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalculate_quality_run_item_v1(
  p_org_id uuid, p_run_item_id uuid
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS
$$
DECLARE
  v_status text;
  v_total int;
  v_done int;
  v_run_id uuid;
  v_is_terminal boolean;
BEGIN
  SELECT test_run_id INTO v_run_id
    FROM public.quality_test_run_items
    WHERE id = p_run_item_id AND organization_id = p_org_id;
  IF v_run_id IS NULL THEN
    RAISE EXCEPTION USING errcode='42501', message='quality_run_item_not_found';
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE status <> 'not_run'),
    CASE
      WHEN bool_or(status = 'failed')   THEN 'failed'
      WHEN bool_or(status = 'blocked')  THEN 'blocked'
      WHEN bool_and(status = 'passed')  THEN 'passed'
      WHEN bool_and(status = 'skipped') THEN 'skipped'
      WHEN bool_or(status <> 'not_run') THEN 'in_progress'
      ELSE 'not_run'
    END
  INTO v_total, v_done, v_status
  FROM public.quality_test_step_results
  WHERE run_item_id = p_run_item_id;

  v_is_terminal := v_status IN ('passed','failed','blocked','skipped','invalid');

  UPDATE public.quality_test_run_items
  SET status       = coalesce(v_status, 'not_run'),
      started_at   = CASE WHEN v_done > 0 THEN coalesce(started_at, now()) ELSE started_at END,
      completed_at = CASE WHEN v_total > 0 AND v_is_terminal THEN now() ELSE null END,
      executed_by  = CASE WHEN v_done > 0 THEN auth.uid() ELSE executed_by END,
      updated_at   = now()
  WHERE id = p_run_item_id;

  RETURN coalesce(v_status, 'not_run');
END;
$$;

-- ============================================================
-- 4. CONSTRAINT: status só em valores válidos
-- ============================================================

DO $$
BEGIN
  -- quality_test_step_results
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_step_result_status_valid'
  ) THEN
    ALTER TABLE public.quality_test_step_results
      ADD CONSTRAINT chk_step_result_status_valid
      CHECK (status IN ('not_run','in_progress','passed','failed','blocked','skipped','invalid','retest'));
  END IF;

  -- quality_test_run_items
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_run_item_status_valid'
  ) THEN
    ALTER TABLE public.quality_test_run_items
      ADD CONSTRAINT chk_run_item_status_valid
      CHECK (status IN ('not_run','in_progress','passed','failed','blocked','skipped','invalid'));
  END IF;

  -- quality_test_runs
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_test_run_status_valid'
  ) THEN
    ALTER TABLE public.quality_test_runs
      ADD CONSTRAINT chk_test_run_status_valid
      CHECK (status IN ('draft','planned','in_progress','completed','cancelled','archived'));
  END IF;
END $$;

commit;
