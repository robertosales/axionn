import { describe, expect, it } from "vitest";
import {
  buildGitlabIntegrationPayload,
  normalizeGitlabIntegration,
  validateGitlabIntegrationPayload,
} from "./gitlabIntegrations.service";

describe("gitlab integration helpers", () => {
  it("normalizes a git integration row into a UI-friendly shape", () => {
    const normalized = normalizeGitlabIntegration({
      id: "git-1",
      name: "GitLab Axionn",
      provider: "gitlab",
      base_url: "https://gitlab.com",
      repository_path: "group/project",
      repository_name: "project",
      api_url: "https://gitlab.com/api/v4",
      is_active: true,
      sync_status: "pending",
      sync_error: null,
      access_token_encrypted: "token-123",
      webhook_url: "https://example.com/webhook",
      webhook_secret_encrypted: "secret-123",
      events: ["push", "merge_request"],
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    expect(normalized.id).toBe("git-1");
    expect(normalized.provider).toBe("gitlab");
    expect(normalized.repositoryPath).toBe("group/project");
    expect(normalized.events).toEqual(["push", "merge_request"]);
    expect(normalized.isActive).toBe(true);
    expect(normalized.hasAccessToken).toBe(true);
    expect(normalized.accessToken).toBeNull();
  });

  it("builds a payload with the expected GitLab defaults", () => {
    const payload = buildGitlabIntegrationPayload({
      organizationId: "org-1",
      name: "GitLab principal",
      baseUrl: "https://gitlab.com",
      repositoryPath: "group/project",
      repositoryName: "project",
      apiUrl: "https://gitlab.com/api/v4",
      accessToken: "token",
      webhookUrl: "https://example.com/webhook",
      webhookSecret: "secret",
      isActive: true,
    });

    expect(payload.provider).toBe("gitlab");
    expect(payload.organization_id).toBe("org-1");
    expect(payload.base_url).toBe("https://gitlab.com");
    expect(payload.repository_path).toBe("group/project");
    expect(payload.events).toEqual(["push", "merge_request"]);
    expect(payload.is_active).toBe(true);
  });

  it("requires a base url and repository path to be valid", () => {
    const result = validateGitlabIntegrationPayload({
      name: "GitLab",
      baseUrl: "",
      repositoryPath: "",
      repositoryName: "project",
      apiUrl: "",
      accessToken: "",
      webhookUrl: "",
      webhookSecret: "",
      isActive: true,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("baseUrl");
    expect(result.errors).toContain("repositoryPath");
  });
});
