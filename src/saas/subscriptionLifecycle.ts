export type SubscriptionStatus = "pending" | "trialing" | "active" | "past_due" | "suspended" | "canceled" | "expired";

const TRANSITIONS: Record<SubscriptionStatus, readonly SubscriptionStatus[]> = {
  pending: ["trialing", "active", "canceled"],
  trialing: ["active", "expired", "canceled", "suspended"],
  active: ["past_due", "suspended", "canceled", "expired"],
  past_due: ["active", "suspended", "canceled"],
  suspended: ["active", "canceled", "expired"],
  canceled: [],
  expired: ["active"],
};

export function canTransitionSubscription(from: SubscriptionStatus, to: SubscriptionStatus) {
  return from === to || TRANSITIONS[from].includes(to);
}

export interface UsageConflict { code: string; used: number; targetLimit: number | null }

export function evaluateDowngrade(usage: Record<string, number>, targetLimits: Record<string, number | null>): UsageConflict[] {
  return Object.entries(targetLimits).flatMap(([code, limit]) => limit != null && (usage[code] ?? 0) > limit ? [{ code, used: usage[code] ?? 0, targetLimit: limit }] : []);
}

export function isEffectivePeriod(startsAt: string | null, endsAt: string | null, at = new Date()) {
  const time = at.getTime();
  return (!startsAt || new Date(startsAt).getTime() <= time) && (!endsAt || new Date(endsAt).getTime() > time);
}
