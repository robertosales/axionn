import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const reconcile = readFileSync("supabase/functions/gitlab-issues-reconcile/index.ts", "utf8");
const sync = readFileSync("supabase/functions/gitlab-issues-sync/index.ts", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");

describe("GitLab automatic reconciliation contract", () => {
  it("accepts only scheduled service-role invocations", () => {
    expect(reconcile).toContain("authorization !== `Bearer ${serviceRoleKey}`");
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
    expect(config).toContain("[functions.gitlab-issues-sync]\nverify_jwt = true");
    expect(config).toContain("[functions.gitlab-issues-reconcile]\nverify_jwt = true");
  });
});
