import { supabase } from "@/integrations/supabase/client";
import {
  type ApfBillingRequest,
  type ApfBillingRequestStatus,
  type BackofficeDashboardSummary,
  type BackofficeRole,
  type BackofficeStaffMember,
  type BillingRecord,
  type BillingStatus,
  type PlanPriceHistoryEntry,
  type SaaSSnapshot,
  type SaaSMetrics,
  type SupportStatus,
  type SupportTicket,
  type BackofficePlanPrice,
  type BillingCustomer,
} from "@/backoffice/types/backoffice.types";

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function normalizeStaff(row: Record<string, unknown>): BackofficeStaffMember {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    fullName: String(row.full_name ?? "Staff"),
    email: String(row.email ?? ""),
    role: String(row.role ?? "suporte") as BackofficeRole,
    department: row.department == null ? null : String(row.department),
    avatarUrl: row.avatar_url == null ? null : String(row.avatar_url),
    isActive: Boolean(row.is_active),
    lastLoginAt: row.last_login_at == null ? null : String(row.last_login_at),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function normalizeSummary(row: Record<string, unknown>): BackofficeDashboardSummary {
  return {
    totalTenants: toNumber(row.total_tenants),
    activeTenants: toNumber(row.active_tenants),
    trialTenants: toNumber(row.trial_tenants),
    suspendedTenants: toNumber(row.suspended_tenants),
    staffMembers: toNumber(row.staff_members),
    activeStaffMembers: toNumber(row.active_staff_members),
    activeSubscriptions: toNumber(row.active_subscriptions),
    pastDueSubscriptions: toNumber(row.past_due_subscriptions),
  };
}

export async function getMyBackofficeStaffProfile() {
  const { data, error } = await (supabase as any).rpc(
    "get_my_backoffice_staff_profile",
  );
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return row ? normalizeStaff(row as Record<string, unknown>) : null;
}

export async function listBackofficeStaffMembers() {
  const { data, error } = await (supabase as any).rpc(
    "list_backoffice_staff_members",
  );
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(normalizeStaff);
}

export async function upsertBackofficeStaffMember(payload: {
  userId: string;
  fullName: string;
  email: string;
  role: BackofficeRole;
  department: string | null;
  avatarUrl?: string | null;
  isActive: boolean;
}) {
  const { data, error } = await (supabase as any).rpc(
    "upsert_backoffice_staff_member",
    {
      p_user_id: payload.userId,
      p_full_name: payload.fullName,
      p_email: payload.email,
      p_role: payload.role,
      p_department: payload.department,
      p_avatar_url: payload.avatarUrl ?? null,
      p_is_active: payload.isActive,
    },
  );
  if (error) throw error;
  return String(data);
}

export async function deactivateBackofficeStaffMember(staffId: string) {
  const { error } = await (supabase as any).rpc(
    "deactivate_backoffice_staff_member",
    { p_staff_id: staffId },
  );
  if (error) throw error;
}

export async function getBackofficeDashboardSummary() {
  const { data, error } = await (supabase as any).rpc(
    "get_backoffice_dashboard_summary",
  );
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return normalizeSummary((row ?? {}) as Record<string, unknown>);
}

function normalizeBilling(row: Record<string, unknown>): BillingRecord {
  return {
    id: String(row.id),
    tenantId: row.tenant_id == null ? null : String(row.tenant_id),
    tenantName: String(row.tenant_name ?? ""),
    amount: toNumber(row.amount),
    status: String(row.status) as BillingStatus,
    planType: String(row.plan_type ?? ""),
    billingPeriod: String(row.billing_period ?? ""),
    dueDate: String(row.due_date ?? ""),
    paidAt: row.paid_at == null ? null : String(row.paid_at),
    invoiceUrl: row.invoice_url == null ? null : String(row.invoice_url),
    notes: row.notes == null ? null : String(row.notes),
    lastReminderAt: row.last_reminder_at == null ? null : String(row.last_reminder_at),
    createdAt: String(row.created_at ?? ""),
  };
}

export async function listBillingRecords() {
  const { data, error } = await (supabase as any).rpc("list_backoffice_billing_records");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeBilling);
}

export async function updateBillingStatus(id: string, status: BillingStatus, reason?: string) {
  const { error } = await (supabase as any).rpc("update_backoffice_billing_status", {
    p_billing_id: id,
    p_status: status,
    p_reason: reason?.trim() ? reason.trim() : null,
  });
  if (error) throw error;
}

export async function markOverdueInvoices() {
  const { data, error } = await (supabase as any).rpc("mark_overdue_invoices");
  if (error) throw error;
  return toNumber(data);
}

export async function listBackofficePlanPrices(): Promise<BackofficePlanPrice[]> {
  const { data, error } = await (supabase as any).rpc("list_backoffice_plan_prices");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    monthlyPrice: toNumber(row.monthly_price),
    annualPrice: toNumber(row.annual_price),
    currency: String(row.currency ?? "BRL"),
    status: String(row.status),
  }));
}

export async function updateBackofficePlanPrice(plan: BackofficePlanPrice) {
  const { error } = await (supabase as any).rpc("update_backoffice_plan_price", {
    p_plan_id: plan.id,
    p_monthly_price: plan.monthlyPrice,
    p_annual_price: plan.annualPrice,
    p_currency: plan.currency,
  });
  if (error) throw error;
}

export async function listBillingCustomers(): Promise<BillingCustomer[]> {
  const { data, error } = await (supabase as any).rpc("list_backoffice_billing_customers");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[])
    .map((row) => ({
      orgId: String(row.org_id),
      orgName: String(row.org_name),
      planName: row.plan_name == null ? null : String(row.plan_name),
      planCode: row.plan_code == null ? null : String(row.plan_code),
    }));
}

export async function createBillingRecord(payload: {
  tenantId: string; billingPeriod: string; dueDate: string;
  amount: number | null; notes: string | null;
}) {
  const { data, error } = await (supabase as any).rpc("create_backoffice_billing_record", {
    p_tenant_id: payload.tenantId,
    p_billing_period: payload.billingPeriod,
    p_due_date: payload.dueDate,
    p_amount: payload.amount,
    p_notes: payload.notes,
  });
  if (error) throw error;
  return String(data);
}

export async function generateMonthlyBilling(referenceDate: string, dueDay: number) {
  const { data, error } = await (supabase as any).rpc("generate_backoffice_monthly_billing", {
    p_reference_date: referenceDate,
    p_due_day: dueDay,
  });
  if (error) throw error;
  return toNumber(data);
}

export async function updateBillingDetails(id: string, invoiceUrl: string | null, notes: string | null) {
  const { error } = await (supabase as any).rpc("update_backoffice_billing_details", {
    p_billing_id: id,
    p_invoice_url: invoiceUrl,
    p_notes: notes,
  });
  if (error) throw error;
}

export async function listApfBillingRequests(): Promise<ApfBillingRequest[]> {
  const { data: rows, error } = await (supabase as any)
    .from("apf_measurement_billing_requests")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  const list = ((rows ?? []) as Array<Record<string, unknown>>);
  const orgIds = [...new Set(list.map((row) => String(row.organization_id)))];
  const orgNames = new Map<string, string>();
  if (orgIds.length > 0) {
    const { data: orgs, error: orgsError } = await (supabase as any)
      .from("organizations")
      .select("id,name")
      .in("id", orgIds);
    if (orgsError) throw orgsError;
    for (const org of (orgs ?? []) as Array<{ id: string; name: string }>) orgNames.set(org.id, org.name);
  }
  return list.map((row) => ({
    id: String(row.id),
    batchId: String(row.batch_id),
    organizationId: String(row.organization_id),
    organizationName: orgNames.get(String(row.organization_id)) ?? "",
    competence: String(row.competence ?? ""),
    approvedPf: toNumber(row.approved_pf),
    unitPrice: toNumber(row.unit_price),
    grossAmount: toNumber(row.gross_amount),
    currency: String(row.currency ?? "BRL"),
    dueDate: String(row.due_date ?? ""),
    status: String(row.status ?? "submitted") as ApfBillingRequestStatus,
    billingRecordId: row.billing_record_id == null ? null : String(row.billing_record_id),
    note: row.note == null ? null : String(row.note),
    submittedAt: String(row.submitted_at ?? ""),
  }));
}

export async function linkApfBillingRequest(payload: {
  requestId: string; billingRecordId: string; note: string | null; markInvoiced: boolean;
}) {
  const { error } = await (supabase as any).rpc("link_apf_billing_record", {
    p_request_id: payload.requestId,
    p_billing_record_id: payload.billingRecordId,
    p_note: payload.note,
    p_mark_invoiced: payload.markInvoiced,
  });
  if (error) throw error;
}

export async function recordBillingReminder(id: string, note?: string) {
  const { error } = await (supabase as any).rpc("record_billing_reminder", {
    p_billing_id: id,
    p_note: note?.trim() ? note.trim() : null,
  });
  if (error) throw error;
}

export async function listPlanPriceHistory(limit = 50): Promise<PlanPriceHistoryEntry[]> {
  const { data, error } = await (supabase as any).rpc("list_backoffice_plan_price_history", {
    p_limit: limit,
  });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    actionAt: String(row.action_at ?? ""),
    planCode: String(row.plan_code ?? ""),
    planName: String(row.plan_name ?? ""),
    monthlyPrice: toNumber(row.monthly_price),
    annualPrice: toNumber(row.annual_price),
    currency: String(row.currency ?? "BRL"),
    actorName: String(row.actor_name ?? ""),
    actorEmail: String(row.actor_email ?? ""),
  }));
}

export async function listSaasSnapshots(limit = 90): Promise<SaaSSnapshot[]> {
  const { data, error } = await (supabase as any).rpc("list_backoffice_saas_snapshots", {
    p_limit: limit,
  });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    snapshotDate: String(row.snapshot_date ?? ""),
    totalTenants: toNumber(row.total_tenants),
    activeTenants: toNumber(row.active_tenants),
    trialTenants: toNumber(row.trial_tenants),
    churnedTenants: toNumber(row.churned_tenants),
    mrr: toNumber(row.mrr),
    arr: toNumber(row.arr),
    newMrr: toNumber(row.new_mrr),
    churnedMrr: toNumber(row.churned_mrr),
    totalUsers: toNumber(row.total_users),
    activeUsers30d: toNumber(row.active_users_30d),
    openTickets: toNumber(row.open_tickets),
    createdAt: String(row.created_at ?? ""),
  }));
}

function normalizeTicket(row: Record<string, unknown>): SupportTicket {
  return {
    id: String(row.id),
    ticketNumber: String(row.ticket_number ?? ""),
    tenantName: String(row.tenant_name ?? ""),
    reporterName: String(row.reporter_name ?? ""),
    subject: String(row.subject ?? ""),
    category: String(row.category ?? "other"),
    priority: String(row.priority ?? "medium"),
    status: String(row.status) as SupportStatus,
    slaDeadline: row.sla_deadline == null ? null : String(row.sla_deadline),
    createdAt: String(row.created_at ?? ""),
  };
}

export async function listSupportTickets() {
  const { data, error } = await (supabase as any).rpc("list_backoffice_support_tickets");
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeTicket);
}

export async function updateSupportTicketStatus(id: string, status: SupportStatus) {
  const { error } = await (supabase as any).rpc("update_backoffice_support_ticket_status", {
    p_ticket_id: id,
    p_status: status,
  });
  if (error) throw error;
}

export async function getSaaSMetrics(): Promise<SaaSMetrics> {
  const { data, error } = await (supabase as any).rpc("get_backoffice_saas_metrics");
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) ?? {};
  return {
    mrr: toNumber(row.mrr),
    arr: toNumber(row.arr),
    activeTenants: toNumber(row.active_tenants),
    trialTenants: toNumber(row.trial_tenants),
    churnedTenants: toNumber(row.churned_tenants),
    churnRate: toNumber(row.churn_rate),
    openTickets: toNumber(row.open_tickets),
    overdueInvoices: toNumber(row.overdue_invoices),
    paidRevenue: toNumber(row.paid_revenue),
  };
}
