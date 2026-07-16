import { describe, expect, it } from "vitest";
import { calculateOkrTrend } from "./okrTrend";

const snapshot = (progress: number, measured_at: string) => ({ id: measured_at, key_result_id: "kr", measured_value: progress, raw_progress: progress, calculated_progress: progress, health: "on_track", measurement_quality: "reliable", source: "test", formula_version: "1", measured_at, period_start: null, period_end: null, items_considered: 1, calculation_metadata: {} });
describe("calculateOkrTrend", () => {
  it("requires two measurements", () => expect(calculateOkrTrend([snapshot(10, "2026-01-01")]).trend).toBe("insufficient_data"));
  it("classifies improvement, stability and worsening", () => {
    expect(calculateOkrTrend([snapshot(10, "2026-01-01"), snapshot(20, "2026-02-01")]).trend).toBe("improving");
    expect(calculateOkrTrend([snapshot(20, "2026-01-01"), snapshot(20.5, "2026-02-01")]).trend).toBe("stable");
    expect(calculateOkrTrend([snapshot(20, "2026-01-01"), snapshot(10, "2026-02-01")]).trend).toBe("worsening");
  });
});
