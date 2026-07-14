import { describe, expect, it } from "vitest";
import { buildBreadcrumbs, navigationConfig } from "./NavigationConfig";

describe("navigationConfig", () => {
  it("exposes a declarative configuration for the pilot area", () => {
    const gitlabItem = navigationConfig
      .flatMap((section) => section.items)
      .find((item) => item.id === "gitlab-integrations");

    expect(gitlabItem?.label).toBe("GitLab Integrations");
    expect(gitlabItem?.route).toBe("/organization/gitlab-integrations");
  });

  it("builds contextual breadcrumbs for nested routes", () => {
    const breadcrumbs = buildBreadcrumbs("/organization/gitlab-integrations", navigationConfig);

    expect(breadcrumbs).toEqual([
      { label: "Organização", path: "/organization" },
      { label: "GitLab Integrations", path: "/organization/gitlab-integrations" },
    ]);
  });
});
