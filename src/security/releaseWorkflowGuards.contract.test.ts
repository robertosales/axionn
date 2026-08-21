import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const staging = readFileSync(".github/workflows/staging-tenancy-validation.yml", "utf8");
const release = readFileSync(".github/workflows/release.yml", "utf8");

describe("release workflow safety guards", () => {
  it("refuses to treat production as isolated staging", () => {
    expect(staging).toContain("SUPABASE_PRODUCTION_PROJECT_REF");
    expect(staging).toContain('SUPABASE_PROJECT_REF" == "$SUPABASE_PRODUCTION_PROJECT_REF');
    expect(staging).toContain("VALIDATE-ISOLATED-STAGING");
    expect(staging).toContain("APPLY-ISOLATED-STAGING");
    expect(staging).toContain('db_host" != *"$SUPABASE_PROJECT_REF"*');
  });

  it("publishes the immutable tagged commit only after main promotion", () => {
    expect(release).toContain('package_version=$(node -p');
    expect(release).toContain('git merge-base --is-ancestor "$GITHUB_SHA" origin/main');
    expect(release).not.toContain("npm version");
    expect(release).not.toContain("git push origin develop");
    expect(release).not.toContain("ref: develop");
  });
});
