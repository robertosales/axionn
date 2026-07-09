import { supabase } from "@/integrations/supabase/client";

export const PLAN_STATUS_OPTIONS = ["active", "inactive", "archived"] as const;
export const SUBSCRIPTION_STATUS_OPTIONS = [
  "trialing",
  "active",
  "past_due",
  "suspended",
  "canceled",
  "expired",
] as const;

export type PlanStatus = (typeof PLAN_STATUS_OPTIONS)[number];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS_OPTIONS)[number];

export interface PlatformPlanEntitlement {
  id: string;
  featureKey: string;
  enabled: boolean;
  limitValue: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: PlanStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  entitlements: PlatformPlanEntitlement[];
}

export interface OrganizationOverride {
  id: string;
  featureKey: string;
  enabled: boolean | null;
  limitValue: number | null;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformOrganizationSubscription {
  orgId: string;
  orgName: string;
  orgSlug: string;
  orgStatus: string;
  orgPlan: string;
  subscriptionId: string | null;
  planId: string | null;
  planCode: string | null;
  planName: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  startsAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  source: string | null;
  usersUsed: number;
  projectsUsed: number;
  contractsUsed: number;
  overrides: OrganizationOverride[];
}

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeEntitlement(row: Record<string, unknown>): PlatformPlanEntitlement {
  return {
    id: String(row.id),
    featureKey: String(row.feature_key ?? ""),
    enabled: Boolean(row.enabled),
    limitValue: toNullableNumber(row.limit_value),
    metadata: normalizeJsonObject(row.metadata),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function normalizePlan(row: Record<string, unknown>): PlatformPlan {
  const entitlements = Array.isArray(row.entitlements)
    ? row.entitlements
    : [];

  return {
    id: String(row.id),
    code: String(row.code ?? ""),
    name: String(row.name ?? "Plano"),
    description: row.description == null ? null : String(row.description),
    status: String(row.status ?? "inactive") as PlanStatus,
    metadata: normalizeJsonObject(row.metadata),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    entitlements: entitlements.map((item) =>
      normalizeEntitlement(item as Record<string, unknown>),
    ),
  };
}

function normalizeOverride(row: Record<string, unknown>): OrganizationOverride {
  return {
    id: String(row.id),
    featureKey: String(row.feature_key ?? ""),
    enabled: row.enabled == null ? null : Boolean(row.enabled),
    limitValue: toNullableNumber(row.limit_value),
    reason: row.reason == null ? null : String(row.reason),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function normalizeSubscription(
  row: Record<string, unknown>,
): PlatformOrganizationSubscription {
  const overrides = Array.isArray(row.overrides) ? row.overrides : [];

  return {
    orgId: String(row.org_id),
    orgName: String(row.org_name ?? "Organizacao"),
    orgSlug: String(row.org_slug ?? ""),
    orgStatus: String(row.org_status ?? ""),
    orgPlan: String(row.org_plan ?? ""),
    subscriptionId: row.subscription_id == null ? null : String(row.subscription_id),
    planId: row.plan_id == null ? null : String(row.plan_id),
    planCode: row.plan_code == null ? null : String(row.plan_code),
    planName: row.plan_name == null ? null : String(row.plan_name),
    subscriptionStatus:
      row.subscription_status == null
        ? null
        : (String(row.subscription_status) as SubscriptionStatus),
    startsAt: row.starts_at == null ? null : String(row.starts_at),
    trialEndsAt: row.trial_ends_at == null ? null : String(row.trial_ends_at),
    currentPeriodStart:
      row.current_period_start == null ? null : String(row.current_period_start),
    currentPeriodEnd:
      row.current_period_end == null ? null : String(row.current_period_end),
    canceledAt: row.canceled_at == null ? null : String(row.canceled_at),
    source: row.source == null ? null : String(row.source),
    usersUsed: toNumber(row.users_used),
    projectsUsed: toNumber(row.projects_used),
    contractsUsed: toNumber(row.contracts_used),
    overrides: overrides.map((item) =>
      normalizeOverride(item as Record<string, unknown>),
    ),
  };
}

export async function listPlatformPlans(includeArchived = false) {
  const { data, error } = await (supabase as any).rpc(
    "list_platform_saas_plans_v1",
    { p_include_archived: includeArchived },
  );
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(normalizePlan);
}

export async function createPlatformPlan(payload: {
  code: string;
  name: string;
  description: string | null;
  status: PlanStatus;
}) {
  const { data, error } = await (supabase as any).rpc(
    "create_platform_saas_plan_v1",
    {
      p_code: payload.code,
      p_name: payload.name,
      p_description: payload.description,
      p_status: payload.status,
      p_metadata: {},
    },
  );
  if (error) throw error;
  return String(data);
}

export async function updatePlatformPlan(
  plan: Pick<PlatformPlan, "id" | "name" | "description" | "status" | "metadata">,
) {
  const { error } = await (supabase as any).rpc(
    "update_platform_saas_plan_v1",
    {
      p_plan_id: plan.id,
      p_name: plan.name,
      p_description: plan.description,
      p_status: plan.status,
      p_metadata: plan.metadata ?? {},
    },
  );
  if (error) throw error;
}

export async function archivePlatformPlan(planId: string) {
  const { error } = await (supabase as any).rpc(
    "archive_platform_saas_plan_v1",
    { p_plan_id: planId },
  );
  if (error) throw error;
}

export async function upsertPlatformPlanEntitlement(payload: {
  planId: string;
  featureKey: string;
  enabled: boolean;
  limitValue: number | null;
}) {
  const { error } = await (supabase as any).rpc(
    "upsert_platform_plan_entitlement_v1",
    {
      p_plan_id: payload.planId,
      p_feature_key: payload.featureKey,
      p_enabled: payload.enabled,
      p_limit_value: payload.limitValue,
      p_metadata: {},
    },
  );
  if (error) throw error;
}

export async function deletePlatformPlanEntitlement(
  planId: string,
  featureKey: string,
) {
  const { error } = await (supabase as any).rpc(
    "delete_platform_plan_entitlement_v1",
    { p_plan_id: planId, p_feature_key: featureKey },
  );
  if (error) throw error;
}

export async function listPlatformOrganizationSubscriptions() {
  const { data, error } = await (supabase as any).rpc(
    "list_platform_organization_subscriptions_v1",
  );
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(
    normalizeSubscription,
  );
}

export async function setPlatformOrganizationSubscription(payload: {
  orgId: string;
  planId: string;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}) {
  const { error } = await (supabase as any).rpc(
    "set_platform_organization_subscription_v1",
    {
      p_org_id: payload.orgId,
      p_plan_id: payload.planId,
      p_status: payload.status,
      p_trial_ends_at: payload.trialEndsAt,
      p_current_period_start: payload.currentPeriodStart,
      p_current_period_end: payload.currentPeriodEnd,
      p_source: "manual",
    },
  );
  if (error) throw error;
}

export async function upsertPlatformOrganizationOverride(payload: {
  orgId: string;
  featureKey: string;
  enabled: boolean | null;
  limitValue: number | null;
  reason: string | null;
}) {
  const { error } = await (supabase as any).rpc(
    "upsert_platform_organization_entitlement_override_v1",
    {
      p_org_id: payload.orgId,
      p_feature_key: payload.featureKey,
      p_enabled: payload.enabled,
      p_limit_value: payload.limitValue,
      p_reason: payload.reason,
    },
  );
  if (error) throw error;
}

export async function deletePlatformOrganizationOverride(
  orgId: string,
  featureKey: string,
) {
  const { error } = await (supabase as any).rpc(
    "delete_platform_organization_entitlement_override_v1",
    { p_org_id: orgId, p_feature_key: featureKey },
  );
  if (error) throw error;
}
