import { describe, expect, it } from "vitest";
import { buildBreadcrumbs, navigationConfig, salaAgilNavigationConfig } from "./NavigationConfig";

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

  it("exposes backlog features as a first-class agile route", () => {
    const featureItem = salaAgilNavigationConfig.flatMap((section) => section.items).find((item) => item.id === "features");
    expect(featureItem?.label).toBe("Features");
    expect(featureItem?.route).toBe("/sala-agil/features");
  });

  it("keeps Sprints first and preserves the remaining agile section order", () => {
    expect(salaAgilNavigationConfig.map((section) => section.label)).toEqual([
      "Sprints",
      "Qualidade",
      "Cerimônias",
      "Operações",
      "Relatórios",
      "Configurações",
    ]);
  });

  it("presents activities as Tasks without breaking the existing route", () => {
    const tasksItem = salaAgilNavigationConfig
      .flatMap((section) => section.items)
      .find((item) => item.id === "atividades");

    expect(tasksItem?.label).toBe("Tarefas");
    expect(tasksItem?.route).toBe("/sala-agil/atividades");
  });
});
