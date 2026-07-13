import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("integration health contract", () => {
  const migration = source(
    "supabase/migrations/20260710200000_integration_registry_health_foundation.sql",
  );
  const gitHandler = source(
    "supabase/functions/git-webhook-handler/index.ts",
  );
  const teamsBot = source("supabase/functions/teams-bot/index.ts");
  const redmineSync = source("supabase/functions/redmine-sync/index.ts");
  const oracleSync = source("supabase/functions/oracle-sync/index.ts");
  const apexWebhook = source("supabase/functions/apex-webhook/index.ts");

  it("keeps health writes restricted to the backend", () => {
    expect(migration).toContain(
      "revoke all on table public.integration_health_events from public, anon, authenticated",
    );
    expect(migration).toContain(
      "grant select, insert, update, delete on table public.integration_health_events to service_role",
    );
  });

  it("keeps registry responses free from credential columns", () => {
    const registryFunction = migration.slice(
      migration.indexOf("create or replace function public.get_integration_registry"),
    );

    expect(registryFunction).not.toContain("access_token_encrypted");
    expect(registryFunction).not.toContain("webhook_secret_encrypted");
    expect(registryFunction).not.toContain("password_encrypted");
    expect(registryFunction).not.toContain("client_secret_encrypted");
  });

  it("records Git health without requiring a project join", () => {
    expect(gitHandler).toContain(".from('integration_health_events')");
    expect(gitHandler).toContain("provider: 'git'");
    expect(gitHandler).toContain("const organizationId = integration.organization_id");
    expect(gitHandler).not.toContain("projects!inner(organization_id)");
  });

  it("resolves Teams by the published Azure tenant column", () => {
    expect(teamsBot).toContain(".eq('azure_tenant_id', tenantId)");
    expect(teamsBot).not.toContain(".eq('tenant_id', tenantId)");
    expect(teamsBot).toContain(".from('integration_health_events')");
    expect(teamsBot).toContain("provider: 'teams'");
  });

  it("records normalized Redmine sync health", () => {
    expect(redmineSync).toContain(".from('integration_health_events')");
    expect(redmineSync).toContain("provider: 'redmine'");
    expect(redmineSync).toContain("check_type: 'sync'");
    expect(redmineSync).toContain("last_sync_status: 'failed'");
    expect(redmineSync).toContain("status: completedWithErrors ? 'degraded' : 'healthy'");
  });

  it("initializes Redmine sync counters before composing the health summary", () => {
    const redmineCountersStart = redmineSync.indexOf("let issuesProcessed = 0;");
    const completedWithErrorsLine = redmineSync.indexOf("const completedWithErrors = issuesFailed > 0;");

    expect(redmineCountersStart).toBeGreaterThan(-1);
    expect(completedWithErrorsLine).toBeGreaterThan(-1);
    expect(redmineCountersStart).toBeLessThan(completedWithErrorsLine);
  });

  it("records APEX webhook health with normalized status", () => {
    expect(apexWebhook).toContain(".from('integration_health_events')");
    expect(apexWebhook).toContain("provider: 'apex'");
    expect(apexWebhook).toContain("check_type: 'webhook'");
    expect(apexWebhook).toContain("errorCode: 'INVALID_SIGNATURE'");
    expect(apexWebhook).toContain("errorCode: 'WEBHOOK_PROCESSING_FAILED'");
  });

  it("treats inactive APEX integrations as degraded and returns 409", () => {
    expect(apexWebhook).toContain("errorCode: 'INTEGRATION_INACTIVE'");
    expect(apexWebhook).toContain("status: 409");
  });

  it("does not report the Oracle placeholder as healthy", () => {
    expect(oracleSync).toContain(".from('integration_health_events')");
    expect(oracleSync).toContain("provider: 'oracle'");
    expect(oracleSync).toContain("ORACLE_CONNECTOR_NOT_CONFIGURED");
    expect(oracleSync).toContain("simulated: true");
    expect(oracleSync).toContain("last_run_status: completedWithErrors ? 'partial' : 'success'");
    expect(oracleSync).not.toContain("const body = await req.json().catch");
  });
});
