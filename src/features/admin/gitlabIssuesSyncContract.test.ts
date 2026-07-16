import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sync = readFileSync("supabase/functions/gitlab-issues-sync/index.ts", "utf8");
const handler = readFileSync("supabase/functions/git-webhook-handler/index.ts", "utf8");

describe("GitLab issues backlog contract", () => {
  it("routes each issue using its own labels", () => {
    expect(sync).toContain("Array.isArray(issue.labels) ? issue.labels : []");
    expect(sync).toContain("issue, labels, correlationId");
    expect(sync).not.toContain("issue, issues, correlationId");
  });

  it("persists unified markdown and derived acceptance criteria", () => {
    expect(sync).toContain("parseUserStoryContent(issue.description)");
    expect(sync).toContain("description: parsedContent.content");
    expect(sync).toContain("acceptance_criteria: parsedContent.acceptanceCriteria");
    expect(sync).toContain("const contentUpdate = parsedContent.content");
    expect(handler).toContain("const contentUpdate = parsedContent.content");
  });

  it("links GitLab #IID activity through the issue link in the same integration", () => {
    expect(handler).toContain("resolveHUReference");
    expect(handler).toContain(".eq('integration_id', integrationId)");
    expect(handler).toContain(".contains('git_entity_data', { iid })");
    expect(handler).toContain("integration_id: integrationId");
    expect(sync).toContain("backfillIssueActivity");
    expect(sync).toContain('.overlaps("hu_ids", references)');
    expect(sync).toContain('onConflict: "organization_id,hu_id,git_entity_type,git_entity_id"');
  });

  it("places GitLab stories in the active sprint and backlog workflow column", () => {
    expect(sync).toContain("resolveGitlabBacklogPlacement(supabase, teamId)");
    expect(sync).toContain("sprint_id: placement.sprintId");
    expect(sync).toContain("placement.backlogStatus");
    expect(sync).not.toContain("sprint_id: null");
    expect(handler).toContain("resolveGitlabBacklogPlacement(supabase, teamId)");
    expect(handler).toContain("sprint_id: placement.sprintId");
  });
});
