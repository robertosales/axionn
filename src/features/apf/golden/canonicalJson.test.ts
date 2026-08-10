import { describe, expect, it } from "vitest";
import {
  canonicalDecimal,
  canonicalJson,
  canonicalJsonSha256,
  canonicalTimestamp,
} from "./canonicalJson";

const VECTORS = [
  {
    name: "ordena propriedades, preserva null e ignora metadados voláteis",
    input: {
      z: null,
      created_at: "2026-08-10T10:00:00-03:00",
      nested: { beta: true, alpha: "ação" },
      a: 1,
    },
    canonical: '{"a":1,"nested":{"alpha":"ação","beta":true},"z":null}',
    sha256: "0310097cc699d452e9cad452ec5919f9dc38cd2dae67d233f2c6878fafbba200",
  },
  {
    name: "normaliza Unicode para NFC e preserva a ordem semântica dos arrays",
    input: { values: ["ac\u0327a\u0303o", "AÇÃO", null], version: 1 },
    canonical: '{"values":["ação","AÇÃO",null],"version":1}',
    sha256: "4e195783c6a29d6ce9a7cb70171a3a17aab144ccaaec435d0a6d3511020bed72",
  },
] as const;

describe("APF canonical JSON v1", () => {
  it.each(VECTORS)("$name", async (vector) => {
    const result = await canonicalJsonSha256(vector.input);
    expect(result).toEqual({ canonical: vector.canonical, sha256: vector.sha256 });
  });

  it("normaliza decimais e timestamps antes de incluí-los no documento", () => {
    expect(canonicalDecimal("-00012.3400")).toBe("-12.34");
    expect(canonicalDecimal("-0.000")).toBe("0");
    expect(canonicalTimestamp("2026-08-10T10:00:00-03:00"))
      .toBe("2026-08-10T13:00:00.000Z");
  });

  it("rejeita números fracionários para evitar divergência TS/PostgreSQL", () => {
    expect(() => canonicalJson({ financial: 2.76 })).toThrow(/financial decimals must be strings/);
  });
});
