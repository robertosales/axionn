import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const validation = readFileSync(
  "supabase/operations/20260730_05_okr_v2_final_cumulative_validation.sql",
  "utf8",
);

describe("OKR final cumulative validation", () => {
  it("is read-only and covers closure, reviews, carry-forward and operations", () => {
    expect(validation).not.toMatch(/\b(insert|update|delete|alter|drop)\b/i);
    for (const contract of [
      "start_okr_cycle_closing_v1",
      "close_okr_cycle_v1",
      "submit_okr_objective_review_v1",
      "approve_okr_objective_review_v1",
      "carry_forward_okr_objective_v1",
      "create_okr_initiative_v1",
      "run_okr_alert_engine_v1",
    ]) {
      expect(validation).toContain(contract);
    }
    expect(validation).toContain("okr_v2_final_cumulative_validation_ok");
    expect(validation).toContain("relrowsecurity");
  });
});
