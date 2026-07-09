export const BACKOFFICE_ROLES = [
  "admin",
  "financeiro",
  "suporte",
  "comercial",
  "dev",
] as const;

export type BackofficeRole = (typeof BACKOFFICE_ROLES)[number];

export interface BackofficeStaffMember {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  role: BackofficeRole;
  department: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackofficeDashboardSummary {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  suspendedTenants: number;
  staffMembers: number;
  activeStaffMembers: number;
  activeSubscriptions: number;
  pastDueSubscriptions: number;
}

export type BillingStatus = "pending" | "paid" | "overdue" | "cancelled" | "refunded";
export type SupportStatus = "open" | "in_progress" | "waiting_client" | "resolved" | "closed";

export interface BillingRecord {
  id: string;
  tenantId: string | null;
  tenantName: string;
  amount: number;
  status: BillingStatus;
  planType: string;
  billingPeriod: string;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  tenantName: string;
  reporterName: string;
  subject: string;
  category: string;
  priority: string;
  status: SupportStatus;
  slaDeadline: string | null;
  createdAt: string;
}

export interface SaaSMetrics {
  mrr: number;
  arr: number;
  activeTenants: number;
  trialTenants: number;
  churnedTenants: number;
  churnRate: number;
  openTickets: number;
  overdueInvoices: number;
  paidRevenue: number;
}

export interface BackofficePlanPrice {
  id: string;
  code: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  status: string;
}

export interface BillingCustomer {
  orgId: string;
  orgName: string;
  planName: string | null;
  planCode: string | null;
}
