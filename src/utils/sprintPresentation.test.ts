import { describe, expect, it } from "vitest";
import { formatSprintDate, formatSprintPeriod, formatSprintPoints, getSprintDisplayName } from "./sprintPresentation";

describe("sprintPresentation", () => {
  it("separates an external numeric reference from the sprint name", () => {
    expect(getSprintDisplayName("25042-Sprint 3 Release 5 GESP 3 TIME G2")).toEqual({
      title: "Sprint 3 Release 5 GESP 3 TIME G2",
      reference: "#25042",
    });
  });

  it("preserves names that do not contain an external reference", () => {
    expect(getSprintDisplayName("Sprint 03 Release 04")).toEqual({ title: "Sprint 03 Release 04", reference: null });
  });

  it("formats date-only values without a timezone shift or escaped unicode", () => {
    expect(formatSprintDate("2026-04-07")).toBe("07/04/2026");
    expect(formatSprintPeriod("2026-04-07", "2026-05-14")).toBe("07/04/2026 — 14/05/2026");
  });

  it("uses a meaningful empty state when no points were estimated", () => {
    expect(formatSprintPoints(0, 0)).toBe("Sem pontos estimados");
    expect(formatSprintPoints(8, 13)).toBe("8 / 13 pts");
  });
});
