import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");

describe("route loading boundaries", () => {
  it("keeps public route pages out of the application bootstrap", () => {
    for (const page of ["Auth", "AuthCallback", "NotFound", "ResetPassword"]) {
      expect(app).toContain(`const ${page} = lazy(`);
      expect(app).not.toMatch(new RegExp(`^import ${page} from`, "m"));
    }
  });

  it("loads authenticated chrome only when a session exists", () => {
    expect(app).toContain("function AuthenticatedChrome()");
    expect(app).toContain("if (loading || !session) return null");
    expect(app).not.toMatch(/^import \{ OrganizationSwitcher \}/m);
    expect(app).not.toMatch(/^import \{ GlobalLogoutButton \}/m);
  });

  it("keeps domain shells and guards behind lazy route boundaries", () => {
    for (const component of [
      "AppShell",
      "BackofficeLayout",
      "BackofficeGuard",
      "BackofficeMfaGuard",
      "QualityAccessGuard",
      "OkrV2AccessGuard",
    ]) {
      expect(app).toContain(`const ${component} = lazy(`);
    }
  });
});
