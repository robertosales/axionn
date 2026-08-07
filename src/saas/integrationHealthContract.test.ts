import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("integration health contract", () => {
  const migration = source(
    "supabase/migrations/20260710200000_integration_registry_health_foundation.sql",
  );
  const secretIsolation = source(
    "supabase/migrations/20260807140000_corporate_integration_secret_isolation.sql",
  );
  const eventIntegrity = source(
    "supabase/migrations/20260807150000_corporate_integration_event_integrity.sql",
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

  it("keeps corporate integration credentials backend-only", () => {
    for (const table of ["redmine_integrations", "oracle_integrations", "apex_integrations"]) {
      expect(secretIsolation).toContain(`revoke all on public.${table} from public, anon, authenticated`);
      expect(secretIsolation).toContain(`create policy "${table}_service_role_only"`);
    }
    expect(secretIsolation).toContain("use get_integration_registry for sanitized status");
  });

  it("prevents clients from forging corporate integration events", () => {
    for (const table of [
      "redmine_issue_links", "redmine_sync_events", "oracle_sync_events", "apex_usage_events",
    ]) {
      expect(eventIntegrity).toContain(`revoke insert, update, delete on public.${table}`);
    }
    for (const rpc of ["log_redmine_sync_event", "log_oracle_sync_event", "log_apex_usage_event"]) {
      expect(eventIntegrity).toContain(`revoke all on function public.${rpc}`);
    }
    expect(eventIntegrity.match(/from public, anon, authenticated/g)?.length).toBe(7);
    expect(eventIntegrity.match(/to service_role/g)?.length).toBeGreaterThanOrEqual(8);
  });

  it("records Git health without requiring a project join", () => {
    expect(gitHandler).toContain(".from('integration_health_events')");
    expect(gitHandler).toContain("provider: 'git'");
    expect(gitHandler).toContain("const organizationId = integration.organization_id");
    expect(gitHandler).not.toContain("projects!inner(organization_id)");
  });

  it("fails Git webhooks closed and never persists authentication secrets", () => {
    expect(gitHandler).toContain("Webhook authentication is not configured");
    expect(gitHandler).toContain("status: 503");
    expect(gitHandler).toContain("String(integration.provider || '').toLowerCase()");
    expect(gitHandler).toContain("Provider does not match integration");
    expect(gitHandler).toContain("crypto.subtle.verify('HMAC'");
    expect(gitHandler).toContain("throw new Error('UNSUPPORTED_GIT_EVENT_TYPE')");
    const auditHeaders = gitHandler.slice(
      gitHandler.indexOf("const relevantHeaders"),
      gitHandler.indexOf("const providerEventId"),
    );
    expect(auditHeaders).not.toContain("x-gitlab-token");
    expect(auditHeaders).not.toContain("x-hub-signature-256");
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

  it("binds privileged Redmine writes to the configured organization and team", () => {
    expect(redmineSync).toContain("REDMINE_PROJECT_MAPPING_REQUIRED");
    expect(redmineSync).toContain(".eq('org_id', integration.organization_id)");
    expect(redmineSync).toContain(".eq('team_id', scope.teamId)");
    expect(redmineSync).toContain("REDMINE_LINK_TARGET_OUT_OF_SCOPE");
    expect(redmineSync).toContain("REDMINE_ENTITY_TYPE_NOT_IMPLEMENTED");
    expect(redmineSync).not.toContain(".eq('external_id'");
    expect(redmineSync).not.toContain("organization_id: integration.organization_id,\n    project_id:");
  });

  it("validates Redmine authentication, event types, bodies and bulk bounds", () => {
    expect(redmineSync).toContain("readTextBody(req, MAX_BODY_BYTES)");
    expect(redmineSync).toContain("crypto.subtle.verify('HMAC'");
    expect(redmineSync).toContain("ALLOWED_EVENTS.has(payload.event_type)");
    expect(redmineSync).toContain("MAX_BULK_PROJECTS = 50");
    expect(redmineSync).toContain("MAX_BULK_PAGES_PER_PROJECT = 100");
    expect(redmineSync).not.toContain("signature === integration.webhook_secret_encrypted");
  });

  it("uses the actual user story schema and checks every Redmine mutation", () => {
    expect(redmineSync).toContain("team_id: scope.teamId");
    expect(redmineSync).toContain("code: `RM-${issue.id}`");
    expect(redmineSync).toContain("if (createError) throw createError");
    expect(redmineSync).toContain("if (error) throw error");
    expect(redmineSync).not.toContain("external_updated_at");
    expect(redmineSync).not.toContain("metadata_json");
  });

  it("records APEX webhook health with normalized status", () => {
    expect(apexWebhook).toContain(".from('integration_health_events')");
    expect(apexWebhook).toContain("provider: 'apex'");
    expect(apexWebhook).toContain("check_type: 'webhook'");
    expect(apexWebhook).toContain("errorCode: 'INVALID_SIGNATURE'");
    expect(apexWebhook).toContain("errorCode: 'WEBHOOK_PROCESSING_FAILED'");
  });

  it("binds privileged APEX writes to the configured project and team", () => {
    expect(apexWebhook).toContain("APEX_INTEGRATION_PROJECT_REQUIRED");
    expect(apexWebhook).toContain(".eq('org_id', integration.organization_id)");
    expect(apexWebhook).toContain(".eq('team_id', scope.teamId)");
    expect(apexWebhook).toContain("APEX_HU_NOT_FOUND_IN_SCOPE");
    expect(apexWebhook).toContain("APEX_IMPEDIMENT_NOT_FOUND_IN_SCOPE");
    expect(apexWebhook).not.toContain("organization_id: integration.organization_id,\n    project_id: data.project_id");
    expect(apexWebhook).not.toContain("[APEX Webhook] Page submit error");
  });

  it("verifies APEX HMAC in constant time and limits the request body", () => {
    expect(apexWebhook).toContain("readTextBody(req, 1_000_000)");
    expect(apexWebhook).toContain("crypto.subtle.verify('HMAC'");
    expect(apexWebhook).toContain("Invalid webhook payload");
    expect(apexWebhook).not.toContain("expectedHex === providedHex");
  });

  it("treats inactive APEX integrations as degraded and returns 409", () => {
    expect(apexWebhook).toContain("errorCode: 'INTEGRATION_INACTIVE'");
    expect(apexWebhook).toContain("status: 409");
  });

  it("fails the unavailable Oracle connector explicitly", () => {
    expect(oracleSync).toContain(".from('integration_health_events')");
    expect(oracleSync).toContain("provider: 'oracle'");
    expect(oracleSync).toContain("ORACLE_CONNECTOR_NOT_IMPLEMENTED");
    expect(oracleSync).toContain("success: false");
    expect(oracleSync).toContain("status: 501");
    expect(oracleSync).toContain("last_run_status: 'failed'");
    expect(oracleSync.indexOf("status: 501")).toBeLessThan(oracleSync.indexOf("// Log start"));
    expect(oracleSync).not.toContain("const body = await req.json().catch");
  });
});
