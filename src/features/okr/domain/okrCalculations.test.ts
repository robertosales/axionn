import { describe, expect, it } from "vitest";
import { calculateKrProgress, calculateObjectiveHealth, calculateObjectiveProgress } from "./okrCalculations";

describe("calculateKrProgress", () => {
  it("calculates increase targets", () => {
    expect(calculateKrProgress({ baseline: 60, current: 70, target: 85, direction: "increase" }).progress).toBe(40);
  });
  it("calculates decrease targets", () => {
    expect(calculateKrProgress({ baseline: 10.6, current: 8.8, target: 7, direction: "decrease" }).progress).toBeCloseTo(50);
  });
  it("supports range targets", () => {
    expect(calculateKrProgress({ baseline: 70, current: 85, targetMin: 80, targetMax: 90, direction: "range" }).progress).toBe(100);
  });
  it("keeps raw overachievement and caps consolidated progress", () => {
    const result = calculateKrProgress({ baseline: 0, current: 112, target: 100, direction: "increase" });
    expect(result.rawProgress).toBeCloseTo(112);
    expect(result.progress).toBe(100);
  });
  it("caps deterioration at zero", () => {
    expect(calculateKrProgress({ baseline: 60, current: 50, target: 80, direction: "increase" }).progress).toBe(0);
  });
  it("returns no data instead of zero for a missing measurement", () => {
    expect(calculateKrProgress({ baseline: 60, current: null, target: 80, direction: "increase" })).toEqual({ rawProgress: null, progress: null, reason: "Sem dados suficientes" });
  });
  it("handles baseline equal to target without division by zero", () => {
    expect(calculateKrProgress({ baseline: 10, current: 10, target: 10, direction: "increase" }).progress).toBe(100);
  });
});

describe("calculateObjectiveProgress", () => {
  it("uses a simple average by default", () => {
    expect(calculateObjectiveProgress([{ progress: 30 }, { progress: 50 }, { progress: 55 }]).progress).toBe(45);
  });
  it("uses validated weights", () => {
    expect(calculateObjectiveProgress([{ progress: 80, weight: 50 }, { progress: 50, weight: 30 }, { progress: 25, weight: 20 }]).progress).toBe(60);
  });
  it("rejects an invalid weight sum", () => {
    expect(calculateObjectiveProgress([{ progress: 80, weight: 50 }, { progress: 50, weight: 20 }]).progress).toBeNull();
  });
  it("ignores archived KRs and returns no data when nothing is measured", () => {
    expect(calculateObjectiveProgress([{ progress: 100, active: false }, { progress: null }]).progress).toBeNull();
  });
});

describe("calculateObjectiveHealth", () => {
  it("explains on-track, attention and risk states", () => {
    expect(calculateObjectiveHealth({ progress: 65, cycleElapsed: 70 }).health).toBe("on_track");
    expect(calculateObjectiveHealth({ progress: 50, cycleElapsed: 70 }).health).toBe("attention");
    const risk = calculateObjectiveHealth({ progress: 40, cycleElapsed: 70 });
    expect(risk.health).toBe("at_risk");
    expect(risk.reason).toContain("70% do ciclo");
  });
  it("does not disguise missing data as risk", () => {
    expect(calculateObjectiveHealth({ progress: null, cycleElapsed: 70 }).health).toBe("no_data");
  });
});
