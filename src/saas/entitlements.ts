export const ENTITLEMENT_KEYS = {
  USERS_MAX: "users.max",
  PROJECTS_MAX: "projects.max",
  CONTRACTS_MAX: "contracts.max",
  APF_COUNTINGS_MONTHLY: "apf.countings.monthly",
  AI_CALLS_MONTHLY: "ai.calls.monthly",
  APF_AI_GENERATION: "apf.ai_generation",
  REPORTS_ADVANCED: "reports.advanced",
  AUDIT_ACCESS: "audit.access",
} as const;

export type OrganizationEntitlementKey =
  (typeof ENTITLEMENT_KEYS)[keyof typeof ENTITLEMENT_KEYS];

export type OrganizationSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "canceled"
  | "expired";

export interface EffectiveOrganizationEntitlement {
  orgId: string;
  planCode: string;
  subscriptionStatus: OrganizationSubscriptionStatus;
  featureKey: OrganizationEntitlementKey | string;
  enabled: boolean;
  limitValue: number | null;
  source: "plan" | "organization_override" | "missing" | string;
}

export interface OrganizationUsageSummary {
  organizationId: string;
  planCode: string;
  subscriptionStatus: OrganizationSubscriptionStatus;
  usersUsed: number;
  usersLimit: number | null;
  projectsUsed: number;
  projectsLimit: number | null;
  contractsUsed: number;
  contractsLimit: number | null;
  apfCountingsUsed: number;
  apfCountingsLimit: number | null;
  aiCallsUsed: number;
  aiCallsLimit: number | null;
  quotaResetAt: string | null;
}

export function findEntitlement(
  entitlements: EffectiveOrganizationEntitlement[],
  featureKey: OrganizationEntitlementKey | string,
) {
  return entitlements.find(
    (entitlement) => entitlement.featureKey === featureKey,
  );
}

export function hasEnabledEntitlement(
  entitlements: EffectiveOrganizationEntitlement[],
  featureKey: OrganizationEntitlementKey | string,
) {
  return findEntitlement(entitlements, featureKey)?.enabled === true;
}

export function isUnlimitedLimit(limitValue: number | null | undefined) {
  return limitValue == null;
}

export function isWithinEntitlementLimit(
  used: number,
  limitValue: number | null | undefined,
) {
  return isUnlimitedLimit(limitValue) || used < limitValue;
}

export function remainingEntitlementLimit(
  used: number,
  limitValue: number | null | undefined,
) {
  if (isUnlimitedLimit(limitValue)) return null;
  return Math.max((limitValue ?? 0) - used, 0);
}
