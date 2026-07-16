import { describe, expect, it } from "vitest";
import { legacyMetricsDestination, METRICS_TABS, normalizeMetricsTab } from "./metricsNavigation";

describe("metrics navigation", () => {
  it("exposes only the four metric dimensions", () => {
    expect(METRICS_TABS).toEqual(["individual", "team", "quality", "impediments"]);
    expect(METRICS_TABS).not.toContain("releases");
    expect(METRICS_TABS).not.toContain("reports");
  });

  it("normalizes persisted removed tabs to the default", () => {
    expect(normalizeMetricsTab("reports")).toBe("individual");
    expect(normalizeMetricsTab("releases")).toBe("individual");
    expect(normalizeMetricsTab("quality")).toBe("quality");
  });

  it("redirects legacy destinations to their official modules", () => {
    expect(legacyMetricsDestination("relatorios")).toBe("/sala-agil/relatorios");
    expect(legacyMetricsDestination("reports")).toBe("/sala-agil/relatorios");
    expect(legacyMetricsDestination("releases")).toBe("/sala-agil/releases");
  });
});
