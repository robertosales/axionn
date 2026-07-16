import { describe, expect, it } from "vitest";
import { usageLevel, usagePercentage, usageRemaining } from "./usageStatus";

describe("usageStatus", () => {
  it("diferencia ilimitado, alerta e limite atingido", () => {
    expect(usageLevel(100, null)).toBe("unlimited");
    expect(usageLevel(8, 10)).toBe("warning");
    expect(usageLevel(10, 10)).toBe("reached");
  });
  it("não apresenta restante ou percentual negativo", () => {
    expect(usageRemaining(12, 10)).toBe(0);
    expect(usagePercentage(12, 10)).toBe(100);
  });
});
