import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { safeExternalUrl } from "@/lib/security";
import { passwordPolicyError } from "@/lib/passwordPolicy";

const source = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

describe("commercial security hardening", () => {
  it("blocks executable and credential-bearing external URLs", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(safeExternalUrl("https://user:password@example.com/path")).toBeUndefined();
    expect(safeExternalUrl("https://example.com/ticket/1")).toBe("https://example.com/ticket/1");
  });

  it("enforces a commercial password baseline", () => {
    expect(passwordPolicyError("Short1!")).not.toBeNull();
    expect(passwordPolicyError("longbutnocomplexity")).not.toBeNull();
    expect(passwordPolicyError("Correct-Horse-7")).toBeNull();
  });

  it("renders prompt previews through React rather than raw HTML", () => {
    const preview = source("src/features/apf/components/template-editor/PromptPreview.tsx");
    expect(preview).not.toContain("dangerouslySetInnerHTML");
    expect(preview).toContain("parts.map");
  });

  it("does not persist provider API keys in browser storage", () => {
    const context = source("src/features/apf/contexts/AiPipelineContext.tsx");
    expect(context).not.toContain('sessionStorage.getItem("apf_ai_api_key")');
    expect(context).not.toContain('sessionStorage.setItem("apf_ai_api_key"');
  });

  it("cryptographically authenticates Bot Framework activities", () => {
    const bot = source("supabase/functions/teams-bot/index.ts");
    const auth = source("supabase/functions/_shared/bot-framework-auth.ts");
    expect(bot).toContain("verifyBotFrameworkRequest(req)");
    expect(auth).toContain("jwtVerify");
    expect(auth).toContain('issuer: BOT_CONNECTOR_ISSUER');
    expect(auth).toContain("audience: appId");
    expect(auth).toContain('algorithms: ["RS256"]');
  });

  it("restricts privileged workers to service or scheduler credentials", () => {
    const oracle = source("supabase/functions/oracle-sync/index.ts");
    const embeddings = source("supabase/functions/apf-embeddings/index.ts");
    expect(oracle).toContain("trustedService");
    expect(oracle).toContain("trustedScheduler");
    expect(oracle).toContain("status: 401");
    expect(embeddings).toContain("trustedService");
    expect(embeddings).toContain("trustedScheduler");
    expect(embeddings).toContain("status: 401");

    const config = source("supabase/config.toml");
    for (const functionName of ["oracle-sync", "apf-embeddings", "telemetry-ingest"]) {
      expect(config).toContain(`[functions.${functionName}]\nverify_jwt = true`);
    }
  });

  it("fails closed when external webhook secrets are absent", () => {
    for (const path of [
      "supabase/functions/redmine-sync/index.ts",
      "supabase/functions/apex-webhook/index.ts",
    ]) {
      const webhook = source(path);
      expect(webhook).toContain("Webhook authentication is not configured");
      expect(webhook).toContain("status: 503");
    }
  });

  it("does not fail open when the authentication limiter is unavailable", () => {
    const limiter = source("supabase/functions/auth-rate-limiter/index.ts");
    const client = source("src/lib/authRateLimiter.ts");
    expect(limiter).toContain("AUTH_RATE_LIMIT_ALLOW_MEMORY_FALLBACK");
    expect(limiter).toContain("DISTRIBUTED_RATE_LIMITER_NOT_CONFIGURED");
    expect(limiter).toContain('JSON.stringify({ allowed: false');
    expect(limiter).toContain("status: 503");
    expect(limiter).not.toContain('JSON.stringify({ allowed: true, remaining: -1');
    expect(client).toContain("allowed: false");
    expect(client).not.toContain("allowed: true, remaining: -1");
  });

  it("allowlists configurable outbound destinations to prevent SSRF", () => {
    const guard = source("supabase/functions/_shared/outbound-url.ts");
    expect(guard).toContain('url.protocol !== "https:"');
    expect(guard).toContain("OUTBOUND_HOST_NOT_ALLOWLISTED");
    expect(guard).toContain('hostname.endsWith(".local")');

    for (const path of [
      "supabase/functions/teams-bot/index.ts",
      "supabase/functions/redmine-sync/index.ts",
      "supabase/functions/gitlab-webhook-register/index.ts",
      "supabase/functions/gitlab-issues-sync/index.ts",
      "supabase/functions/process-ai-briefing/index.ts",
      "supabase/functions/platform-ai-provider-test/index.ts",
      "supabase/functions/count-function-points/index.ts",
      "supabase/functions/apf-generate/legacy.ts",
    ]) {
      expect(source(path)).toContain("assertSafeOutboundUrl");
    }
  });

  it("bounds webhook and telemetry request bodies", () => {
    const bodyGuard = source("supabase/functions/_shared/request-body.ts");
    expect(bodyGuard).toContain("bytes > maxBytes");
    expect(source("supabase/functions/teams-bot/index.ts")).toContain("readJsonBody<TeamsActivity>");
    expect(source("supabase/functions/telemetry-ingest/index.ts")).toContain("256_000");
    expect(source("supabase/functions/git-webhook-handler/index.ts")).toContain("2_000_000");
    expect(source("supabase/functions/apex-webhook/index.ts")).toContain("1_000_000");
  });
});
