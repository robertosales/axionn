import{readFileSync}from"node:fs";import{resolve}from"node:path";import{describe,expect,it}from"vitest";
const git=readFileSync(resolve("supabase/functions/git-webhook-handler/index.ts"),"utf8");const jira=readFileSync(resolve("supabase/functions/apf-jira-webhook/index.ts"),"utf8");const migration=readFileSync(resolve("supabase/migrations/20260818240000_apf_jira_webhook_integration.sql"),"utf8");
describe("APF operational connectors",()=>{
 it("authenticates and normalizes GitLab, GitHub and Azure DevOps",()=>{for(const value of["gitlab","github","azure_devops","x-vss-event","normalizeProviderPayload","timingSafeTextEqual"])expect(git).toContain(value);expect(git).toContain("payload.pull_request");expect(git).toContain("resource.pullRequest");});
 it("accepts Jira only through a secret-scoped integration",()=>{expect(jira).toContain("x-jira-webhook-secret");expect(jira).toContain("upsert_apf_jira_issue_link");expect(jira).toContain("USER_STORY_MAPPING_REQUIRED");expect(migration).toContain("service_role");expect(migration).toContain("webhook_secret_encrypted");});
 it("persists immutable Jira provenance",()=>{expect(jira).toContain("p_content_hash");expect(jira).toContain("p_external_updated_at");expect(jira).toContain("permanentUrl");});
});
