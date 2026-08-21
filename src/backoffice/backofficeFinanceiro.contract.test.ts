import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

describe("backoffice financeiro contract", () => {
  const sql = source("supabase/migrations/20260821000000_financeiro_hardening.sql");
  const sqlDetails = source("supabase/migrations/20260821010000_financeiro_invoice_details.sql");
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

  it("uses pt-BR labels and only valid status transitions", () => {
    const types = source("src/backoffice/types/backoffice.types.ts");
    expect(types).toContain("BILLING_STATUS_LABELS");
    expect(types).toContain('pending: "Pendente"');
    expect(page).toContain("BILLING_STATUS_TRANSITIONS[record.status].length === 0");
    expect(page).not.toMatch(/<SelectItem[^>]*value=\{status\}>\{status\}/);
    expect(page).not.toContain('const statuses: BillingStatus[]');
  });

  it("requires a reason for terminal status changes", () => {
    expect(page).toContain("billingReasonSchema.safeParse");
    expect(page).toContain('status === "cancelled" || status === "refunded"');
  });

  it("paginates the invoice table", () => {
    expect(page).toContain("PAGE_SIZE = 10");
    expect(page).toContain("Página {currentPage} de {totalPages}");
  });

  it("exports csv through the shared utility with BOM", () => {
    expect(page).toContain('from "@/lib/exportToCsv"');
    expect(page).not.toContain("new Blob(");
    const util = source("src/lib/exportToCsv.ts");
    expect(util).toContain("\\uFEFF");
  });

  it("validates forms with zod schemas", () => {
    const schema = source("src/backoffice/schemas/billing.schema.ts");
    expect(page).toContain('from "@/backoffice/schemas/billing.schema"');
    expect(page).toContain("invoiceFormSchema.safeParse");
    expect(schema).toContain(".uuid(");
    expect(schema).toContain("parseBRLInput");
    expect(schema).toContain("planPriceSchema");
  });

  it("formats money through the shared currency util", () => {
    expect(source("src/lib/currency.ts")).toContain('new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })');
    expect(page).toContain("formatCurrencyBRL(");
    expect(page).not.toContain("new Intl.NumberFormat");
    expect(source("src/backoffice/pages/BOAnalitico.tsx")).toContain("formatCurrencyBRL(");
    expect(source("src/backoffice/pages/BOAnalitico.tsx")).not.toContain("new Intl.NumberFormat");
    expect(source("src/features/apf/components/dossier/ApfDossierAudit.tsx")).toContain('from "@/lib/currency"');
  });

  it("keeps price saving dirty-tracked to changed plans only", () => {
    expect(page).toContain("priceBaseline.current");
    expect(page).toContain("priceChanges.map(updateBackofficePlanPrice)");
  });

  it("renders shared empty and error states with retry", () => {
    expect(page).toContain('from "@/shared/components/common/EmptyState"');
    expect(page).toContain('from "@/shared/components/common/ErrorState"');
    expect(page).toContain("onRetry={() => void load()}");
  });

  it("exposes the APF billing bridge through service functions", () => {
    expect(service).toContain('from("apf_measurement_billing_requests")');
    expect(service).toContain('"link_apf_billing_record"');
    expect(service).toContain("p_mark_invoiced");
  });

  it("keeps invoice details update staff-only and audited", () => {
    expect(sqlDetails).toContain("assert_backoffice_staff(array['admin', 'financeiro'])");
    expect(sqlDetails).toContain("'billing_details_updated'");
    expect(sqlDetails).toContain("public.backoffice_audit_log");
    expect(sqlDetails).toMatch(/revoke all on function public\.update_backoffice_billing_details\(uuid, text, text\) from public, anon/);
    expect(sqlDetails).toMatch(/grant execute on function public\.update_backoffice_billing_details\(uuid, text, text\) to authenticated, service_role/);
  });

  it("service maps invoice_url and notes into billing records", () => {
    expect(service).toContain("invoiceUrl:");
    const types = source("src/backoffice/types/backoffice.types.ts");
    expect(types).toContain("invoiceUrl: string | null");
    expect(types).toContain("notes: string | null");
  });

  it("renders the APF tab with link flow", () => {
    expect(page).toContain('from "@/components/ui/tabs"');
    expect(page).toContain("Cobranças APF");
    expect(page).toContain("listApfBillingRequests()");
    expect(page).toContain("linkApfBillingRequest({");
    expect(page).toContain("APF_BILLING_STATUS_LABELS[request.status]");
  });

  it("offers quick payment and details editing on invoice rows", () => {
    expect(page).toContain('title="Marcar como pago"');
    expect(page).toContain('title="Editar detalhes"');
    expect(page).toContain("updateBillingDetails(detailsTarget.id");
    expect(service).toContain('"update_backoffice_billing_details"');
  });

  it("shows upcoming 30-day invoices card", () => {
    expect(page).toContain('{ label: "Próximos 30 dias"');
    expect(totalsUpcoming(page)).toBe(true);
  });
});

function totalsUpcoming(source: string): boolean {
  return source.includes("upcomingTotal") && source.includes("upcomingCount");
}
