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
