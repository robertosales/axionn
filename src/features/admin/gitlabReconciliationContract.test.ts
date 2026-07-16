import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const reconcile = readFileSync("supabase/functions/gitlab-issues-reconcile/index.ts", "utf8");
const sync = readFileSync("supabase/functions/gitlab-issues-sync/index.ts", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");

describe("GitLab automatic reconciliation contract", () => {
  it("accepts only invocations authenticated by the dedicated reconcile secret", () => {
    expect(reconcile).toContain('Deno.env.get("GITLAB_RECONCILE_SECRET")');
    expect(reconcile).toContain("authorization !== `Bearer ${reconcileSecret}`");
    expect(reconcile).toContain("Unauthorized scheduled invocation");
  });

  it("reconciles every active GitLab backlog integration without aborting the batch", () => {
    expect(reconcile).toContain('.eq("provider", "gitlab")');
    expect(reconcile).toContain('.eq("is_active", true)');
    expect(reconcile).toContain('.eq("sync_issues_as_backlog", true)');
    expect(reconcile).toContain("gitlab-issues-sync");
    expect(reconcile).toContain("Promise.all");
  });

  it("paginates GitLab issues and keeps both internal functions JWT-protected", () => {
    expect(sync).toContain("issues?state=all&per_page=100");
    expect(sync).toContain('response.headers.get("x-next-page")');
    expect(sync).toContain('if (!existing?.hu_id && state === "closed") return "skipped"');
    expect(config).toMatch(/\[functions\.gitlab-issues-sync\]\r?\nverify_jwt = true/);
    // The gateway cannot validate the dedicated scheduler secret as a Supabase
    // JWT; the function performs the exact constant comparison itself.
    expect(config).toMatch(/\[functions\.gitlab-issues-reconcile\]\r?\nverify_jwt = false/);
  });
});
