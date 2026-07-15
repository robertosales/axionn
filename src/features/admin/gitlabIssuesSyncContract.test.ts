import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sync = readFileSync("supabase/functions/gitlab-issues-sync/index.ts", "utf8");

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
  });
});
