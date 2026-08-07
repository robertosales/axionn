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
    expect(source).toContain('Deno.env.get("COPILOT_PLUGIN_TOKEN")');
    expect(source).toContain("tokenMatches");
  });

  it("does not advertise or return mocked capabilities", () => {
    expect(source).toContain("capability_not_implemented");
    expect(source).toContain('capabilities: []');
    expect(source).not.toMatch(/mockad[oa]|scaffold inicial|dados fictícios foram retornados/i);
    expect(source).not.toContain('answer: `Recebi sua mensagem');
  });

  it("derives tenant context from the active plugin record", () => {
    expect(source).toContain('.from("copilot_plugins")');
    expect(source).toContain('.eq("is_active", true)');
    expect(source).toContain("organizationId: plugin.organization_id");
    expect(source).not.toContain('req.headers.get("x-organization-id")');
    expect(source).not.toContain('req.headers.get("x-project-id")');
  });
});
