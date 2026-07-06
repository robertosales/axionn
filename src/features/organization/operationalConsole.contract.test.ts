import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("operational console routing contract", () => {
  const app = source("src/App.tsx");

  it.each([
    "/organization/admin",
    "/organization/companies",
    "/organization/contracts",
    "/organization/projects",
    "/organization/teams",
    "/organization/members",
    "/organization/usage",
    "/organization/settings",
    "/platform/ai-providers",
  ])("keeps the protected route %s registered", (route) => {
    expect(app).toContain(`path=\"${route}\"`);
  });

  it("keeps organization and platform guards separated", () => {
    expect(app).toContain("function OrganizationAdminGuard");
    expect(app).toContain("function PlatformAdminGuard");
    expect(app).toContain("isOrganizationAdmin");
    expect(app).toContain("isPlatformAdmin");
  });

  it("keeps the legacy fallback under runtime flags", () => {
    expect(app).toContain("is_organization_operational_console_enabled");
    expect(app).toContain("is_legacy_operational_admin_fallback_enabled");
  });
});

describe("platform AI security contract", () => {
  const platformConsole = source(
    "src/features/platform/components/PlatformAIProvidersConsole.tsx",
  );
  const compatibilityExport = source(
    "src/features/admin/pages/AdminIAsPage.ts",
  );
  const edgeWrapper = source(
    "supabase/functions/apf-generate/index.ts",
  );
  const edgeTest = source(
    "supabase/functions/platform-ai-provider-test/index.ts",
  );
  const config = source("supabase/config.toml");

  it("routes the legacy admin import to the hardened console", () => {
    expect(compatibilityExport).toContain("PlatformAIProvidersConsole");
  });

  it("tests providers only through the sanitized platform endpoint", () => {
    expect(platformConsole).toContain('"platform-ai-provider-test"');
    expect(platformConsole).not.toContain("rawError");
    expect(platformConsole).not.toContain('invoke("apf-generate"');
  });

  it("requires platform_user_roles in both provider test paths", () => {
    expect(edgeWrapper).toContain('from("platform_user_roles")');
    expect(edgeTest).toContain('from("platform_user_roles")');
    expect(edgeWrapper).toContain("sanitizeTestResponse");
    expect(edgeWrapper).toContain('await import("./legacy.ts")');
    expect(edgeTest).not.toContain("rawError");
  });

  it("keeps JWT verification enabled for both functions", () => {
    expect(config).toContain("[functions.apf-generate]");
    expect(config).toContain("[functions.platform-ai-provider-test]");
    expect(config.match(/verify_jwt = true/g)).toHaveLength(2);
  });
});
