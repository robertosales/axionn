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

  it("never logs OAuth callback fragments or query strings", () => {
    const callback = source("src/pages/AuthCallback.tsx");
    expect(callback).not.toContain('console.warn("hash:"');
    expect(callback).not.toContain('console.warn("search:"');
    expect(callback).not.toMatch(/console\.(?:log|info|warn|error)\([^\n]*(?:location\.hash|location\.search)/);
  });

  it("fails non-test builds closed when Supabase configuration is absent", () => {
    const viteConfig = source("vite.config.ts");
    expect(viteConfig).toContain('const isTest = mode === "test"');
    expect(viteConfig).toContain("if (!supabaseUrl || !supabaseKey)");
    expect(viteConfig).not.toContain("FALLBACK_SUPABASE_URL");
    expect(viteConfig).not.toContain("FALLBACK_SUPABASE_PUBLISHABLE_KEY");
    expect(viteConfig).not.toContain("rgikyyazotqapaxijwui.supabase.co");
  });

  it("completes forced password changes server-side before releasing the profile", () => {
    const page = source("src/pages/ForcePasswordChange.tsx");
    const handler = source("supabase/functions/complete-password-change/index.ts");
    const config = source("supabase/config.toml");

    expect(page).toContain('functions.invoke("complete-password-change"');
    expect(page).not.toContain("AUTH_ANON_KEY");
    expect(page).not.toContain("/auth/v1/user");
    expect(page).not.toContain("must_change_password: false");
    expect(handler.indexOf("admin.auth.admin.updateUserById")).toBeLessThan(
      handler.indexOf(".update({ must_change_password: false })"),
    );
    expect(handler).toContain('if (!profile?.must_change_password)');
    expect(handler).toContain("PASSWORD_UPDATED_PROFILE_PENDING");
    expect(config).toContain("[functions.complete-password-change]\nverify_jwt = true");
  });

  it("authenticates and resolves Copilot tenant context before privileged telemetry", () => {
    const copilot = source("supabase/functions/copilot-plugin/index.ts");
    const router = copilot.indexOf("Deno.serve");
    const routedSource = copilot.slice(router);
    expect(routedSource.indexOf("await authenticate(req)")).toBeLessThan(
      routedSource.indexOf("await resolvePluginContext(req)"),
    );
    expect(routedSource.indexOf("await resolvePluginContext(req)")).toBeLessThan(
      routedSource.indexOf("await recordHealth(context"),
    );
    expect(copilot).not.toContain('req.headers.get("x-organization-id")');
    expect(copilot).not.toContain('Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")');
  });

  it("requires an AAL2 TOTP session before rendering the backoffice", () => {
    const guard = source("src/backoffice/guards/BackofficeGuard.tsx");
    const mfa = source("src/backoffice/guards/BackofficeMfaGate.tsx");
    const settings = source("src/backoffice/pages/BOConfiguracoes.tsx");
    const database = source("supabase/migrations/20260807090000_backoffice_mfa_enforcement.sql");

    expect(guard).toContain("<BackofficeMfaGate>{children}</BackofficeMfaGate>");
    expect(mfa).toContain("getAuthenticatorAssuranceLevel");
    expect(mfa).toContain('currentLevel === "aal2"');
    expect(mfa).toContain('factorType: "totp"');
    expect(mfa).toContain("challengeAndVerify");
    expect(mfa).toContain('checkAuthRateLimit("otp")');
    expect(settings).toContain("Proteção em duas etapas");
    expect(settings).toContain('BACKOFFICE_MFA_REQUIRED ? "obrigatória"');
    expect(settings).not.toContain("obrigatoriedade planejada");
    expect(database).toContain("(auth.jwt() ->> 'aal') = 'aal2'");
    expect(database).toContain("backoffice_mfa_required");
    expect(database).toContain("public.assert_backoffice_staff");
    expect(database).toContain("where staff.user_id = auth.uid()");
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
      expect(webhook).toMatch(/status:\s*503|json\(503,/);
    }
  });

  it("does not fail open when the authentication limiter is unavailable", () => {
    const limiter = source("supabase/functions/auth-rate-limiter/index.ts");
    const client = source("src/lib/authRateLimiter.ts");
    expect(limiter).not.toContain("using local fallback");
    expect(limiter).not.toContain("memStore");
    expect(limiter).not.toContain("memCheck");
    expect(limiter).toContain("distributed store is not configured");
    expect(limiter).toContain('["EVAL", script, "1", key, String(windowSec)]');
    expect(limiter).toContain("if count == 1 then redis.call('EXPIRE'");
    expect(limiter).toContain('JSON.stringify({ allowed: false');
    expect(limiter).toContain("status: 503");
    expect(limiter).not.toContain('JSON.stringify({ allowed: true, remaining: -1');
    expect(client).toContain("return unavailableResult()");
    expect(client).not.toContain("allowed: true, remaining: -1");
    expect(client).not.toContain("fail open");
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
