import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("production configuration contract", () => {
  it("does not embed or select a fallback Supabase project in Vite config", () => {
    const config = source("vite.config.ts");

    expect(config).not.toContain("FALLBACK_SUPABASE");
    expect(config).not.toMatch(/supabase\.co/);
    expect(config).not.toContain('"import.meta.env.VITE_SUPABASE_URL"');
    expect(config).not.toContain('"import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"');
  });

  it("fails closed outside tests when Supabase configuration is absent", () => {
    const client = source("src/integrations/supabase/client.ts");

    expect(client).toContain('import.meta.env.MODE === "test"');
    expect(client).toContain("if (!configuredUrl || !configuredKey)");
    expect(client).toContain("devem estar configuradas");
    expect(client).not.toMatch(/https:\/\/[^\s"']+\.supabase\.co/);
  });

  it("limits the public production recovery config to canonical hostnames", async () => {
    const { getCanonicalProductionSupabaseConfig } = await import(
      "@/config/supabasePublicConfig"
    );

    expect(getCanonicalProductionSupabaseConfig("axionn.app")).toMatchObject({
      url: "https://rgikyyazotqapaxijwui.supabase.co",
    });
    expect(getCanonicalProductionSupabaseConfig("www.axionn.app")).toBeDefined();
    expect(getCanonicalProductionSupabaseConfig("preview.axionn.app")).toBeUndefined();
    expect(getCanonicalProductionSupabaseConfig("localhost")).toBeUndefined();
    expect(getCanonicalProductionSupabaseConfig("axionn.app.attacker.example")).toBeUndefined();
  });

  it("documents the required production variables", () => {
    const example = source(".env.production.example");

    expect(example).toContain("VITE_SUPABASE_URL=");
    expect(example).toContain("VITE_SUPABASE_PUBLISHABLE_KEY=");
  });
});
