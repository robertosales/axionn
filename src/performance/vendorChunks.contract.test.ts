import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const config = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");

describe("stable vendor chunk contract", () => {
  it("keeps framework and data runtimes independently cacheable", () => {
    for (const chunk of [
      "vendor-react",
      "vendor-supabase",
      "vendor-query",
    ]) {
      expect(config).toContain(`return "${chunk}"`);
    }
    expect(config).toContain("manualChunks: stableVendorChunk");
  });

  it("retains a 500 KB warning budget", () => {
    expect(config).toContain("chunkSizeWarningLimit: 500");
  });

  it("keeps monitoring outside manually preloaded vendor groups", () => {
    expect(config).not.toContain('return "vendor-monitoring"');
    expect(config).not.toContain('return "vendor-ui"');
  });

  it("does not collapse every dependency into a single vendor chunk", () => {
    expect(config).not.toContain('return "vendor"');
    expect(config).toContain("return undefined");
  });
});
