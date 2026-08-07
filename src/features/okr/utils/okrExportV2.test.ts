import { describe, expect, it } from "vitest";
import type { OkrExportRowV2 } from "../types/dashboard";
import { buildOkrExportCsv } from "./okrExportV2";

const row: OkrExportRowV2 = {
  cycle_code: "Q3/2026",
  cycle_name: "Q3 2026",
  team_name: "Time Alpha",
  objective_title: "Melhorar previsibilidade",
  objective_level: "team",
  objective_lifecycle: "active",
  objective_health: "on_track",
  objective_progress: 64.5,
  key_result_title: "Reduzir lead time",
  key_result_unit: "dias",
  key_result_direction: "decrease",
  key_result_baseline: 12,
  key_result_target: 7,
  key_result_current: 9,
  key_result_progress: 60,
  key_result_health: "attention",
  measurement_quality: "verified",
  last_measured_at: "2026-07-30T12:00:00Z",
};

describe("buildOkrExportCsv", () => {
  it("builds a UTF-8 CSV with the complete governed export row", () => {
    const csv = buildOkrExportCsv([row]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Q3/2026"');
    expect(csv).toContain('"Reduzir lead time"');
    expect(csv).toContain('"64.5"');
  });

  it("neutralizes spreadsheet formula injection", () => {
    const csv = buildOkrExportCsv([
      { ...row, objective_title: "=HYPERLINK(\"https://example.invalid\")" },
    ]);
    expect(csv).toContain('"\'=HYPERLINK(""https://example.invalid"")"');
  });
});
