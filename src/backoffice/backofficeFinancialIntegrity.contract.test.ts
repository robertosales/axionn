import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260822010000_financeiro_integrity.sql",
  "utf8",
).replace(/\r\n/g, "\n");

describe("backoffice financial integrity contract", () => {
  it("enforces monetary, currency, period and paid-at invariants", () => {
    expect(sql).toContain("billing_records_amount_positive_check");
    expect(sql).toContain("amount <> 'NaN'::numeric and amount > 0");
    expect(sql).toContain("billing_records_currency_format_check");
    expect(sql).toContain("currency ~ '^[A-Z]{3}$'");
    expect(sql).toContain("billing_records_period_bounds_check");
    expect(sql).toContain("period_end >= period_start");
    expect(sql).toContain("billing_records_status_paid_at_check");
    expect(sql).toContain("status in ('paid', 'refunded') and paid_at is not null");
    expect(sql.match(/not valid;/g)?.length).toBeGreaterThanOrEqual(10);
  });

  it("keeps dynamic plan codes while rejecting blank snapshots", () => {
    expect(sql).toContain("billing_records_plan_type_format_check");
    expect(sql).toContain("length(plan_type) between 1 and 64");
    expect(sql).not.toContain("plan_type in ('starter'");
    expect(sql).toContain("'pending', trim(v_plan.code)");
  });

  it("validates and serializes plan price updates with complete audit rows", () => {
    expect(sql).toContain("p_monthly_price = 'NaN'::numeric");
    expect(sql).toContain("message = 'billing_currency_invalid'");
    expect(sql).toMatch(/from public\.saas_plans p[\s\S]*for update/);
    expect(sql).toContain("v_before := to_jsonb(v_plan)");
    expect(sql).toContain("returning to_jsonb(p) into v_after");
  });

  it("creates invoices only from billable active plans with valid inputs", () => {
    expect(sql).toContain("message = 'billing_due_date_required'");
    expect(sql).toContain("s.status in ('active', 'past_due', 'trialing')");
    expect(sql).toContain("p.status = 'active'");
    expect(sql).toContain("message = 'billable_subscription_plan_not_found'");
    expect(sql).toContain("v_amount = 'NaN'::numeric");
    expect(sql).toContain("returning b.id, to_jsonb(b) into v_id, v_after");
  });

  it("makes concurrent monthly generation conflict-safe and audits each invoice", () => {
    expect(sql).toMatch(/on conflict \(tenant_id, period_start, billing_period\)[\s\S]*do nothing/);
    expect(sql).toMatch(/with inserted as \([\s\S]*returning \*/);
    expect(sql).toContain("'billing_record_created', 'billing_record', i.id, to_jsonb(i)");
    expect(sql).toContain("get diagnostics v_count = row_count");
    expect(sql).toContain("'billing_batch_generated'");
  });

  it("protects APF amount formula and mandatory link state", () => {
    expect(sql).toContain("apf_billing_amount_formula_check");
    expect(sql).toContain("gross_amount = round(approved_pf * unit_price, 2)");
    expect(sql).toContain("apf_billing_link_status_check");
    expect(sql).toContain("status not in ('linked', 'invoiced') or billing_record_id is not null");
  });

  it("locks and reconciles APF links before a monotonic transition", () => {
    expect(sql).toMatch(/from public\.apf_measurement_billing_requests r[\s\S]*for update/);
    expect(sql).toMatch(/from public\.billing_records b[\s\S]*for update/);
    expect(sql).toContain("message = 'apf_billing_transition_invalid'");
    expect(sql).toContain("message = 'apf_billing_organization_mismatch'");
    expect(sql).toContain("message = 'apf_billing_record_status_invalid'");
    expect(sql).toContain("message = 'apf_billing_currency_mismatch'");
    expect(sql).toContain("message = 'apf_billing_due_date_mismatch'");
    expect(sql).toContain("message = 'apf_billing_amount_exceeds_invoice'");
    expect(sql).toContain("v_allocated_amount + v_request.gross_amount > v_billing.amount");
    expect(sql).toContain("r.status in ('linked', 'invoiced')");
    expect(sql).toContain("returning to_jsonb(r) into v_after");
  });

  it("exposes a staff-only report for legacy violations", () => {
    expect(sql).toContain("get_backoffice_financial_integrity_violations()");
    expect(sql).toContain("assert_backoffice_staff(array['admin', 'financeiro'])");
    expect(sql).toContain("'billing_amount_positive'::text");
    expect(sql).toContain("'billing_plan_type_format'");
    expect(sql).toContain("'billing_status_paid_at'");
    expect(sql).toContain("'apf_amount_formula'");
    expect(sql).toContain("'apf_currency_format'");
    expect(sql).toContain("'apf_link_state'");
    expect(sql).toContain("'apf_link_reconciliation'");
    expect(sql).toContain("'apf_allocated_amount'");
  });

  it("preserves least-privilege execution grants", () => {
    expect(sql.match(/revoke all on function/g)?.length).toBe(5);
    expect(sql.match(/grant execute on function/g)?.length).toBe(5);
    expect(sql).not.toMatch(/grant execute on function[^\n]*to public/);
    expect(sql).not.toMatch(/grant execute on function[^\n]*\banon\b/);
  });
});
