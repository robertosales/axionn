export type UsageLevel = "ok" | "warning" | "reached" | "unlimited";

export function usageLevel(used: number, limit: number | null, warningThreshold = 0.8): UsageLevel {
  if (limit == null) return "unlimited";
  if (used >= limit) return "reached";
  return limit > 0 && used / limit >= warningThreshold ? "warning" : "ok";
}

export function usageRemaining(used: number, limit: number | null) {
  return limit == null ? null : Math.max(limit - used, 0);
}

export function usagePercentage(used: number, limit: number | null) {
  if (limit == null || limit <= 0) return 0;
  return Math.min(100, Math.round(used / limit * 100));
}
