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
      "Estratégia",
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

  it("places Measurement & Evidence in agile operations", () => {
    const operations = salaAgilNavigationConfig.find(
      (section) => section.id === "sala-agil-operacoes",
    );
    const reports = salaAgilNavigationConfig.find(
      (section) => section.id === "sala-agil-relatorios",
    );

    expect(operations?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "medicao-evidencias",
        label: "Medição & Evidências",
        route: "/sala-agil/medicao-evidencias",
      }),
    ]));
    expect(reports?.items.some((item) => item.id === "medicao-evidencias")).toBe(false);
  });

  it("builds the complete operational breadcrumb for Measurement & Evidence", () => {
    expect(buildBreadcrumbs("/sala-agil/medicao-evidencias", salaAgilNavigationConfig)).toEqual([
      { label: "Sala Ágil", path: "/sala-agil/dashboard" },
      { label: "Operações", path: "/sala-agil/calendario" },
      { label: "Medição & Evidências", path: "/sala-agil/medicao-evidencias" },
    ]);
  });

  it("moves History to Settings and OKR to Strategy without changing their routes", () => {
    const reports = salaAgilNavigationConfig.find((section) => section.id === "sala-agil-relatorios");
    const strategy = salaAgilNavigationConfig.find((section) => section.id === "sala-agil-estrategia");
    const settings = salaAgilNavigationConfig.find((section) => section.id === "sala-agil-config");

    expect(reports?.items.map((item) => item.id)).toEqual(["metricas", "relatorios"]);
    expect(strategy?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "okr", activePathPrefixes: ["/okr"] }),
    ]));
    expect(settings?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "historico", route: "/sala-agil/historico" }),
    ]));
  });

  it("keeps OKR selected and breadcrumbed across its deep routes", () => {
    expect(buildBreadcrumbs("/okr/ciclos", salaAgilNavigationConfig)).toEqual([
      { label: "Sala Ágil", path: "/sala-agil/dashboard" },
      { label: "Estratégia", path: expect.stringMatching(/^\/okr/) },
      { label: "OKR", path: "/okr/ciclos" },
    ]);
  });

  it("builds the administrative breadcrumb for History", () => {
    expect(buildBreadcrumbs("/sala-agil/historico", salaAgilNavigationConfig)).toEqual([
      { label: "Sala Ágil", path: "/sala-agil/dashboard" },
      { label: "Configurações", path: "/sala-agil/times" },
      { label: "Histórico", path: "/sala-agil/historico" },
    ]);
  });
});
