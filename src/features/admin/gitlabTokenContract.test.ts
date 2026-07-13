import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const register = readFileSync("supabase/functions/gitlab-webhook-register/index.ts", "utf8");
const handler = readFileSync("supabase/functions/git-webhook-handler/index.ts", "utf8");

describe("GitLab token separation contract", () => {
  it("uses the PAT only to authenticate GitLab API calls", () => {
    expect(register).toContain('"PRIVATE-TOKEN": integration.access_token_encrypted');
    expect(register).not.toContain("token: integration.access_token_encrypted");
  });

  it("uses a separate webhook secret for registration and verification", () => {
    expect(register).toContain("token: webhookSecret");
    expect(register).toContain("webhook_secret_encrypted: webhookSecret");
    expect(handler).toContain("integration.webhook_secret_encrypted");
    expect(handler).not.toContain("integration.webhook_secret,");
  });

  it("persists consistent webhook synchronization states", () => {
    expect(register).toContain('sync_status: "syncing"');
    expect(register).toContain('sync_status: "completed"');
    expect(register).toContain('sync_status: "error"');
    expect(register).toContain("webhook_id: String(hook.id)");
    expect(register).toContain("sync_error: null");
  });
});
