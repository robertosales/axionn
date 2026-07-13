import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("supabase/functions/copilot-plugin/index.ts", "utf8");

describe("copilot plugin contract", () => {
  it("exposes a health endpoint and manifest", () => {
    expect(source).toContain("function handleHealth");
    expect(source).toContain("function handleManifest");
    expect(source).toContain("/health");
    expect(source).toContain("/manifest");
  });

  it("requires bearer authentication for protected routes", () => {
    expect(source).toContain("Authorization Bearer token ausente.");
    expect(source).toContain("Token inválido.");
    expect(source).toContain("const expected = Deno.env.get(\"COPILOT_PLUGIN_TOKEN\")");
  });

  it("returns structured responses for chat and metrics actions", () => {
    expect(source).toContain("answer:");
    expect(source).toContain("actions:");
    expect(source).toContain("data:");
  });
});
