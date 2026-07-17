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
  {
    orgId: "org-1",
    planCode: "pro",
    subscriptionStatus: "active",
    featureKey: ENTITLEMENT_KEYS.OKR_VIEW,
    enabled: true,
    limitValue: null,
    source: "plan",
  },
  {
    orgId: "org-1",
    planCode: "pro",
    subscriptionStatus: "active",
    featureKey: ENTITLEMENT_KEYS.OKR_AUTOMATIC_METRICS,
    enabled: false,
    limitValue: null,
    source: "plan",
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

  it("includes OKR entitlement keys in type union", () => {
    const okrKeys: (typeof ENTITLEMENT_KEYS)[keyof typeof ENTITLEMENT_KEYS][] = [
      ENTITLEMENT_KEYS.OKR_VIEW,
      ENTITLEMENT_KEYS.OKR_CREATE,
      ENTITLEMENT_KEYS.OKR_EDIT,
      ENTITLEMENT_KEYS.OKR_ARCHIVE,
      ENTITLEMENT_KEYS.OKR_CHECK_IN,
      ENTITLEMENT_KEYS.OKR_INITIATIVES,
      ENTITLEMENT_KEYS.OKR_AUTOMATIC_METRICS,
      ENTITLEMENT_KEYS.OKR_HISTORY,
      ENTITLEMENT_KEYS.OKR_EXPORT,
      ENTITLEMENT_KEYS.OKR_AI_RECOMMENDATIONS,
    ];
    expect(okrKeys.length).toBe(10);
    expect(okrKeys.every((k) => typeof k === "string")).toBe(true);
  });

  it("evaluates OKR entitlements correctly", () => {
    expect(hasEnabledEntitlement(entitlements, ENTITLEMENT_KEYS.OKR_VIEW)).toBe(true);
    expect(hasEnabledEntitlement(entitlements, ENTITLEMENT_KEYS.OKR_AUTOMATIC_METRICS)).toBe(false);
    expect(findEntitlement(entitlements, ENTITLEMENT_KEYS.OKR_VIEW)?.enabled).toBe(true);
    expect(findEntitlement(entitlements, ENTITLEMENT_KEYS.OKR_AUTOMATIC_METRICS)?.enabled).toBe(false);
  });
});
