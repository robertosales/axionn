import { describe, expect, it } from "vitest";
import { canTransitionSubscription, evaluateDowngrade, isEffectivePeriod } from "./subscriptionLifecycle";

describe("subscriptionLifecycle", () => {
  it("permite ativação, suspensão e reativação, mas não reabre cancelamento", () => {
    expect(canTransitionSubscription("trialing", "active")).toBe(true);
    expect(canTransitionSubscription("active", "suspended")).toBe(true);
    expect(canTransitionSubscription("suspended", "active")).toBe(true);
    expect(canTransitionSubscription("canceled", "active")).toBe(false);
  });

  it("identifica conflitos de downgrade sem tratar ilimitado como zero", () => {
    expect(evaluateDowngrade({ users: 24, teams: 4 }, { users: 15, teams: null })).toEqual([{ code: "users", used: 24, targetLimit: 15 }]);
  });

  it("respeita a vigência de overrides", () => {
    const at = new Date("2026-07-17T12:00:00Z");
    expect(isEffectivePeriod("2026-07-01", "2026-08-01", at)).toBe(true);
    expect(isEffectivePeriod("2026-08-01", null, at)).toBe(false);
  });
});
