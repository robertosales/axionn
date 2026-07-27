import type { OkrSnapshot } from "../types";

export type OkrTrend = "improving" | "stable" | "worsening" | "insufficient_data";

export function calculateOkrTrend(snapshots: OkrSnapshot[]): { trend: OkrTrend; delta: number | null } {
  const ordered = [...snapshots]
    .filter((snapshot) => snapshot.calculated_progress != null)
    .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime());
  if (ordered.length < 2) return { trend: "insufficient_data", delta: null };
  const delta = ordered.at(-1)!.calculated_progress! - ordered.at(-2)!.calculated_progress!;
  if (Math.abs(delta) < 1) return { trend: "stable", delta };
  return { trend: delta > 0 ? "improving" : "worsening", delta };
}
