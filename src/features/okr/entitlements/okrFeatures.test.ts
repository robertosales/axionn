import { describe, expect, it } from "vitest";
import {
  OKR_FEATURE_KEYS,
  isWithinOkrLimit,
  makeMissingResolution,
  parseOkrLimitError,
  remainingOkrLimit,
} from "./okrFeatures";

describe("okrFeatures — PR 1", () => {
  it("contém as 14 features canônicas do plano mestre", () => {
    expect(OKR_FEATURE_KEYS).toHaveLength(14);
    expect(OKR_FEATURE_KEYS).toContain("okr.cycle_management");
    expect(OKR_FEATURE_KEYS).toContain("okr.alignments");
    expect(OKR_FEATURE_KEYS).toContain("okr.executive_dashboard");
    expect(OKR_FEATURE_KEYS).toContain("okr.advanced_alerts");
  });

  it("makeMissingResolution retorna desabilitado com source=missing", () => {
    const r = makeMissingResolution("okr.export");
    expect(r.enabled).toBe(false);
    expect(r.source).toBe("missing");
    expect(r.limitValue).toBeNull();
  });

  it("isWithinOkrLimit aceita ilimitado (null)", () => {
    expect(isWithinOkrLimit(9999, null)).toBe(true);
  });

  it("isWithinOkrLimit respeita o teto", () => {
    expect(isWithinOkrLimit(0, 3)).toBe(true);
    expect(isWithinOkrLimit(2, 3)).toBe(true);
    expect(isWithinOkrLimit(3, 3)).toBe(false);
    expect(isWithinOkrLimit(10, 3)).toBe(false);
  });

  it("remainingOkrLimit calcula saldo", () => {
    expect(remainingOkrLimit(0, null)).toBeNull();
    expect(remainingOkrLimit(2, 3)).toBe(1);
    expect(remainingOkrLimit(5, 3)).toBe(0);
  });

  it("parseOkrLimitError decodifica erros do check_okr_limit_v1", () => {
    expect(parseOkrLimitError(undefined)).toEqual({ kind: "unknown" });
    expect(parseOkrLimitError("okr_entitlement_disabled:okr.export")).toEqual({
      kind: "disabled",
      featureKey: "okr.export",
    });
    expect(
      parseOkrLimitError("okr_entitlement_limit_reached:okr.cycle_management:3"),
    ).toEqual({
      kind: "limit_reached",
      featureKey: "okr.cycle_management",
      limit: 3,
    });
  });
});