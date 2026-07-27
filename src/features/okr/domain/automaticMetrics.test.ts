import { describe, expect, it } from "vitest";
import { calculateOperationalMetric, cycleDateRange, isCompletedStory } from "./automaticMetrics";

const stories = [
  { id: "1", status: "pronto_para_publicacao", story_points: 8 },
  { id: "2", status: "done", story_points: 5 },
  { id: "3", status: "em_desenvolvimento", story_points: 3 },
];

describe("automatic OKR metrics", () => {
  it("uses the same completed statuses as operational metrics", () => {
    expect(isCompletedStory("Concluído")).toBe(true);
    expect(isCompletedStory("em_desenvolvimento")).toBe(false);
  });
  it("calculates velocity from completed story points", () => {
    expect(calculateOperationalMetric("velocity", stories, []).value).toBe(13);
  });
  it("calculates commitment from completed versus planned HUs", () => {
    expect(calculateOperationalMetric("sprint_commitment", stories, []).value).toBeCloseTo(66.6667, 3);
  });
  it("calculates throughput", () => {
    expect(calculateOperationalMetric("throughput", stories, []).value).toBe(2);
  });
  it("calculates current open impediments", () => {
    expect(calculateOperationalMetric("impediments_open", [], [{ id: "a", resolved_at: null }, { id: "b", resolved_at: "2026-01-01" }]).value).toBe(1);
  });
  it("returns no data for velocity and commitment without planned HUs", () => {
    expect(calculateOperationalMetric("velocity", [], []).value).toBeNull();
    expect(calculateOperationalMetric("sprint_commitment", [], []).value).toBeNull();
  });
  it("derives a quarter independently from active sprint/release", () => {
    expect(cycleDateRange("Q1/2026")).toEqual({ start: "2026-01-01", end: "2026-03-31" });
  });
});
