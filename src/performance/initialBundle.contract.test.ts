import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("initial bundle contract", () => {
  it("does not block the first render on the monitoring stack", () => {
    const main = source("src/main.tsx");

    expect(main).not.toContain('import { initMonitoring } from "./lib/monitoring"');
    expect(main).toContain('import("./lib/monitoring")');
    expect(main.indexOf('render(app)')).toBeLessThan(main.indexOf('import("./lib/monitoring")'));
  });

  it("loads Sentry lazily when a global error must be reported", () => {
    const interceptor = source("src/lib/error-interceptor.ts");

    expect(interceptor).not.toMatch(/^import .*@sentry\/react/m);
    expect(interceptor).toContain("import('@sentry/react')");
    expect(interceptor).toContain("withSentry");
  });
});
