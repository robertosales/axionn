import { describe, expect, it } from "vitest";
import { getOkrMetric, OKR_METRIC_CATALOG } from "./metricCatalog";

describe("OKR metric catalog", () => {
  it("publishes only metrics with source, formula and version", () => {
    expect(OKR_METRIC_CATALOG.length).toBeGreaterThan(0);
    OKR_METRIC_CATALOG.forEach((metric) => {
      expect(metric.source).toBeTruthy();
      expect(metric.formula).toBeTruthy();
      expect(metric.formulaVersion).toBe("1.0");
    });
  });
  it("resolves supported metrics and rejects unknown codes", () => {
    expect(getOkrMetric("sprint_commitment")?.unit).toBe("%");
    expect(getOkrMetric("invented_metric")).toBeNull();
  });
});
