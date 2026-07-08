import { supabase } from "@/integrations/supabase/client";
import {
  type BackofficeDashboardSummary,
  type BackofficeRole,
  type BackofficeStaffMember,
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
