import { describe, expect, it } from "vitest";
import type {
  OkrDashboardCycleSummary,
  OkrDashboardTeamSummary,
} from "../types/dashboard";
import {
  compareOkrCycles,
  formatOkrPercent,
  teamsForCycle,
} from "./dashboardAnalytics";

function cycle(
  overrides: Partial<OkrDashboardCycleSummary> = {},
): OkrDashboardCycleSummary {
  return {
    id: "cycle-1",
    code: "Q3/2026",
    name: "Q3 2026",
    status: "active",
    starts_at: "2026-07-01",
    ends_at: "2026-09-30",
    objectives: 10,
    active_objectives: 8,
    average_progress: 62.5,
    on_track: 5,
    attention: 2,
    at_risk: 1,
    no_data: 2,
    key_results: 24,
    stale_key_results: 3,
    ...overrides,
  };
}

describe("dashboardAnalytics", () => {
  it("compares progress, risk and stale measurements", () => {
    expect(
      compareOkrCycles(
        cycle(),
        cycle({
          id: "cycle-2",
          average_progress: 55.2,
          at_risk: 3,
          stale_key_results: 6,
        }),
      ),
    ).toEqual({
      progressDelta: 7.3,
      atRiskDelta: -2,
      staleDelta: -3,
    });
  });

  it("does not convert missing progress into zero", () => {
    expect(
      compareOkrCycles(
        cycle({ average_progress: null }),
        cycle({ id: "cycle-2", average_progress: 40 }),
      )?.progressDelta,
    ).toBeNull();
    expect(formatOkrPercent(null)).toBe("Sem dados");
  });

  it("filters and ranks teams within the selected cycle", () => {
    const teams: OkrDashboardTeamSummary[] = [
      { cycle_id: "a", team_id: "1", team_name: "Alpha", objectives: 2, average_progress: 40, at_risk: 0, stale_key_results: 0 },
      { cycle_id: "b", team_id: "2", team_name: "Beta", objectives: 2, average_progress: 90, at_risk: 0, stale_key_results: 0 },
      { cycle_id: "a", team_id: "3", team_name: "Gamma", objectives: 2, average_progress: 70, at_risk: 0, stale_key_results: 0 },
    ];

    expect(teamsForCycle(teams, "a").map((team) => team.team_name)).toEqual([
      "Gamma",
      "Alpha",
    ]);
  });
});
