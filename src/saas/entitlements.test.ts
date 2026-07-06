import { describe, expect, it } from "vitest";
import {
  ENTITLEMENT_KEYS,
  findEntitlement,
  hasEnabledEntitlement,
  isUnlimitedLimit,
  isWithinEntitlementLimit,
  remainingEntitlementLimit,
  type EffectiveOrganizationEntitlement,
} from "@/saas/entitlements";

const entitlements: EffectiveOrganizationEntitlement[] = [
  {
    orgId: "org-1",
    planCode: "pro",
    subscriptionStatus: "active",
    featureKey: ENTITLEMENT_KEYS.APF_AI_GENERATION,
    enabled: true,
    limitValue: null,
    source: "plan",
  },
  {
    orgId: "org-1",
    planCode: "pro",
    subscriptionStatus: "active",
    featureKey: ENTITLEMENT_KEYS.USERS_MAX,
    enabled: true,
    limitValue: 25,
    source: "organization_override",
  },
];

describe("SaaS entitlement helpers", () => {
  it("finds and evaluates enabled features", () => {
    expect(
      findEntitlement(entitlements, ENTITLEMENT_KEYS.APF_AI_GENERATION),
    ).toBeDefined();
    expect(
      hasEnabledEntitlement(
        entitlements,
        ENTITLEMENT_KEYS.APF_AI_GENERATION,
      ),
    ).toBe(true);
    expect(
      hasEnabledEntitlement(entitlements, ENTITLEMENT_KEYS.AUDIT_ACCESS),
    ).toBe(false);
  });

  it("treats a null limit as unlimited", () => {
    expect(isUnlimitedLimit(null)).toBe(true);
    expect(isWithinEntitlementLimit(10_000, null)).toBe(true);
    expect(remainingEntitlementLimit(10_000, null)).toBeNull();
  });

  it("computes finite limit availability", () => {
    expect(isWithinEntitlementLimit(24, 25)).toBe(true);
    expect(isWithinEntitlementLimit(25, 25)).toBe(false);
    expect(remainingEntitlementLimit(20, 25)).toBe(5);
    expect(remainingEntitlementLimit(30, 25)).toBe(0);
  });
});
