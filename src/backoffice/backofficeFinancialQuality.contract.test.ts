import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

describe("backoffice financial quality gate", () => {
  const pgTap = source("supabase/tests/database/22_backoffice_financial_integrity.test.sql");
  const workflow = source(".github/workflows/database-tests.yml");
  const preflight = source("supabase/operations/20260822_01_financeiro_preflight.sql");
  const postValidation = source("supabase/operations/20260822_02_financeiro_post_validation.sql");
  const constraintValidation = source("supabase/operations/20260822_03_financeiro_validate_constraints.sql");
  const runbook = source("docs/financeiro-rollout-runbook.md");
  const generatedTypes = source("src/integrations/supabase/types.ts");

  it("ships an atomic pgTAP financial suite", () => {
    expect(pgTap).toContain("select plan(29)");
    expect(pgTap).toContain("billing_records_amount_positive_check");
    expect(pgTap).toContain("apf_billing_amount_formula_check");
    expect(pgTap).toContain("zero amount is rejected");
    expect(pgTap).toContain("NaN amount is rejected");
    expect(pgTap).toContain("APF reconciliation checks the accumulated allocated amount");
    expect(pgTap.trimEnd()).toMatch(/rollback;$/);
  });

  it("includes the financial contract in the static database CI gate", () => {
    expect(workflow).toContain("src/backoffice/backofficeFinancialIntegrity.contract.test.ts");
    expect(workflow).not.toMatch(/supabase (link|db push|db reset|migration repair)/);
  });

  it("keeps preflight and post-validation read-only and transactional", () => {
    for (const operation of [preflight, postValidation]) {
      expect(operation).toContain("set transaction read only");
      expect(operation.trimEnd()).toMatch(/rollback;$/);
    }
    expect(preflight).toContain("financeiro_preflight_missing_dependencies");
    expect(postValidation).toContain("financeiro_post_validation_function_hardening_missing");
    expect(postValidation).toContain("'aal', 'aal2'");
  });

  it("validates constraints only behind a zero-violation atomic gate", () => {
    expect(constraintValidation).toContain("pg_advisory_xact_lock");
    expect(constraintValidation).toContain("if v_violations <> 0 then");
    expect(constraintValidation.match(/validate constraint/g)?.length).toBe(11);
    expect(constraintValidation).toContain("financeiro_constraint_validation_incomplete");
    expect(constraintValidation).toMatch(/commit;[\s\S]*financial_constraints_validated/);
  });

  it("documents ordered rollout, smoke, evidence and forward-fix rollback", () => {
    expect(runbook.indexOf("20260822000000_financeiro_status_concurrency.sql")).toBeLessThan(
      runbook.indexOf("20260822010000_financeiro_integrity.sql"),
    );
    expect(runbook).toContain("## Smoke funcional");
    expect(runbook).toContain("## Rollback");
    expect(runbook).toContain("## Evidencias obrigatorias");
    expect(runbook).toContain("nova migration forward-fix");
    expect(runbook).toContain("resultado pgTAP com 29 testes financeiros");
  });

  it("keeps generated RPC types aligned with the financial schema", () => {
    expect(generatedTypes).toContain("get_backoffice_financial_integrity_violations:");
    expect(generatedTypes).toContain("invariant_name: string");
    expect(generatedTypes).toContain("violation_count: number");
    expect(generatedTypes).toMatch(
      /generate_backoffice_monthly_billing:[\s\S]*p_dry_run\?: boolean[\s\S]*Returns: number/,
    );
  });
});
