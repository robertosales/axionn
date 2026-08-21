import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const staging = readFileSync(".github/workflows/staging-tenancy-validation.yml", "utf8");
const database = readFileSync(".github/workflows/database-tests.yml", "utf8");
const diagnostics = readFileSync(".github/workflows/database-diagnostics.yml", "utf8");
const release = readFileSync(".github/workflows/release.yml", "utf8");

describe("release workflow safety guards", () => {
  it("keeps database workflows read-only and delegates remote changes to Lovable", () => {
    const workflows = `${staging}\n${database}\n${diagnostics}`;
    expect(staging).toContain("Validate Lovable handoff package");
    expect(workflows).not.toMatch(/supabase (link|db push|db reset|migration repair|functions deploy)/);
    expect(workflows).not.toContain("--linked");
    expect(workflows).not.toContain("SUPABASE_ACCESS_TOKEN");
    expect(workflows).not.toContain("SUPABASE_DB_PASSWORD");
  });

  it("rejects tracked runtime environment files", () => {
    expect(staging).toContain("Reject tracked environment files");
    expect(staging).toContain("git ls-files");
  });

  it("publishes the immutable tagged commit only after main promotion", () => {
    expect(release).toContain('package_version=$(node -p');
    expect(release).toContain('git merge-base --is-ancestor "$GITHUB_SHA" origin/main');
    expect(release).not.toContain("npm version");
    expect(release).not.toContain("git push origin develop");
    expect(release).not.toContain("ref: develop");
  });
});
