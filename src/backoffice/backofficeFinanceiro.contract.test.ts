import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

describe("backoffice financeiro contract", () => {
  const sql = source("supabase/migrations/20260821000000_financeiro_hardening.sql");
  const service = source("src/backoffice/services/backoffice.service.ts");
  const page = source("src/backoffice/pages/BOFinanceiro.tsx");

  it("derives MRR/ARR from active subscriptions instead of invoice history", () => {
    expect(sql).toContain("from public.organization_subscriptions s");
    expect(sql).toContain("join public.saas_plans p on p.id = s.plan_id");
    expect(sql).toContain("where s.status in ('active', 'past_due')");
    expect(sql).toContain("nullif(p.monthly_price, 0)");
    expect(sql).not.toContain("billing_period = 'annual' then amount / 12");
  });

  it("keeps SaaS metrics behind backoffice staff assertion", () => {
    expect(sql).toMatch(
      /create or replace function public\.get_backoffice_saas_metrics\(\)[\s\S]*assert_backoffice_staff\(array\['admin', 'financeiro', 'comercial'\]\)/,
    );
  });

  it("syncs overdue invoices with audit trail", () => {
    expect(sql).toContain("create or replace function public.mark_overdue_invoices()");
    expect(sql).toContain("status = 'pending' and due_date < current_date");
    expect(sql).toContain("'billing_overdue_synced'");
    expect(sql).toContain("public.backoffice_audit_log");
    expect(sql).toContain("assert_backoffice_staff(array['admin', 'financeiro'])");
  });

  it("enforces the billing state machine with terminal states and required reason", () => {
    expect(sql).toContain("p_reason text default null");
    expect(sql).toContain("message = 'billing_reason_required'");
    expect(sql).toContain("message = 'billing_transition_invalid'");
    expect(sql).toContain("(v_current = 'pending' and p_status in ('paid', 'overdue', 'cancelled'))");
    expect(sql).toContain("(v_current = 'overdue' and p_status in ('paid', 'cancelled'))");
    expect(sql).toContain("(v_current = 'paid' and p_status = 'refunded')");
    expect(sql).toContain("when p_status = 'refunded' then paid_at else null end");
    expect(sql).toContain("drop function if exists public.update_backoffice_billing_status(uuid, text)");
  });

  it("generates monthly billing as idempotent bulk with dry-run", () => {
    expect(sql).toContain("p_dry_run boolean default false");
    expect(sql).not.toContain("for v_row in");
    expect(sql).toMatch(/get diagnostics v_count = row_count/);
    expect(sql).toContain("'billing_batch_generated'");
    expect(sql).toContain("drop function if exists public.generate_backoffice_monthly_billing(date, integer)");
  });

  it("revokes public access and grants only authenticated/service_role", () => {
    expect(sql.match(/revoke all on function/g)?.length).toBe(4);
    expect(sql.match(/grant execute on function/g)?.length).toBe(4);
    expect(sql).not.toMatch(/grant execute on function[^\n]*to public/);
    expect(sql).not.toMatch(/grant execute on function[^\n]*\banon\b/);
  });

  it("service layer forwards reason and exposes overdue sync", () => {
    expect(service).toContain('"update_backoffice_billing_status"');
    expect(service).toContain("p_reason:");
    expect(service).toContain('"mark_overdue_invoices"');
  });

  it("financeiro page syncs overdue before loading records", () => {
    expect(page).toContain("markOverdueInvoices()");
    expect(page.indexOf("markOverdueInvoices()")).toBeLessThan(page.indexOf("listBillingRecords()"));
  });
});
