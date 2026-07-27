import { describe, expect, it } from "vitest";
import { commercialPlanCode, getProductFeature, PRODUCT_FEATURES } from "./productCatalog";

describe("productCatalog", () => {
  it("mantém códigos de funcionalidades únicos", () => {
    expect(new Set(PRODUCT_FEATURES.map((feature) => feature.code)).size).toBe(PRODUCT_FEATURES.length);
  });

  it("resolve aliases comerciais sem quebrar códigos desconhecidos", () => {
    expect(commercialPlanCode("starter")).toBe("core");
    expect(commercialPlanCode("pro")).toBe("intelligence");
    expect(commercialPlanCode("custom")).toBe("custom");
  });

  it("localiza a definição central de uma funcionalidade", () => {
    expect(getProductFeature("okr.automatic_metrics")?.moduleCode).toBe("okr");
    expect(getProductFeature("missing")).toBeNull();
  });
});
