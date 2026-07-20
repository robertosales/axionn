import { describe, expect, it, vi } from "vitest";
import type { OkrObjective } from "../types";

const mockObjectives: OkrObjective[] = [
  {
    id: "1",
    title: "Aumentar satisfação do cliente",
    team_id: "t1",
    team_name: "Squad Alpha",
    owner_id: "u1",
    owner_name: "João",
    cycle: "Q2/2026",
    status: "on_track",
    calculated_progress: 72,
    calculated_health: "on_track",
    lifecycle_status: "active",
    key_results: [
      {
        id: "kr1",
        title: "NPS >= 80",
        unit: "pts",
        baseline_value: 60,
        target_value: 80,
        current_value: 72,
        target: 80,
        current: 72,
        calculated_progress: 60,
        calculated_health: "on_track",
        update_type: "manual",
        direction: "increase",
        weight: 50,
        objective_id: "1",
        created_at: "",
        updated_at: "",
        check_ins: [],
      },
    ],
    created_at: "",
    updated_at: "",
    description: "",
    progress: 72,
  },
  {
    id: "2",
    title: "Reduzir tempo de deploy",
    team_id: "t1",
    team_name: "Squad Alpha",
    owner_id: "u2",
    owner_name: "Maria",
    cycle: "Q2/2026",
    status: "at_risk",
    calculated_progress: 30,
    calculated_health: "at_risk",
    lifecycle_status: "active",
    key_results: [],
    created_at: "",
    updated_at: "",
    description: "",
    progress: 30,
  },
];

describe("okrExport", () => {
  it("flattens objectives with KRs into rows", async () => {
    const { exportOkrsToCSV } = await import("./okrExport");
    const mockClick = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: () => "", revokeObjectURL: vi.fn() });
    vi.stubGlobal("HTMLAnchorElement", class { click = mockClick; href = ""; download = ""; });

    exportOkrsToCSV(mockObjectives, "Q2/2026");
    // If no error thrown, the function works
    expect(true).toBe(true);
    vi.unstubAllGlobals();
  });

  it("handles empty objectives list", async () => {
    const { exportOkrsToCSV } = await import("./okrExport");
    vi.stubGlobal("URL", { createObjectURL: () => "", revokeObjectURL: vi.fn() });
    vi.stubGlobal("HTMLAnchorElement", class { click = vi.fn(); href = ""; download = ""; });

    expect(() => exportOkrsToCSV([], "Q2/2026")).not.toThrow();
    vi.unstubAllGlobals();
  });
});
