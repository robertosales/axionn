import { describe, expect, it } from "vitest";
import {
  formatApfSessionOption,
  formatApfStatus,
} from "./apfDossierCreationPresentation";

describe("apfDossierCreationPresentation", () => {
  it("identifica a sessão por nomes de negócio e traduz o status", () => {
    expect(
      formatApfSessionOption({
        id: "69fe20b8-9651-4c2e-8254-8cd3fc4e48d0",
        projectId: "project-1",
        baselineId: "baseline-1",
        modelId: "model-1",
        modelName: "Modelo SISP 2.3",
        baselineLabel: "Baseline Release 5",
        baselineVersion: "5.0",
        sprintRef: "Sprint 2",
        releaseRef: "Release 5",
        status: "in_progress",
      }),
    ).toEqual({
      label: "Modelo SISP 2.3 · Baseline Release 5",
      description: "Sprint 2 · Release 5 · Em andamento",
    });
  });

  it("usa a versão quando a baseline não possui rótulo", () => {
    const option = formatApfSessionOption({
      id: "session-1",
      projectId: "project-1",
      baselineId: "baseline-1",
      modelId: "model-1",
      modelName: "Modelo IFPUG",
      baselineLabel: null,
      baselineVersion: "3.2",
      sprintRef: null,
      releaseRef: null,
      status: "validated",
    });

    expect(option.label).toBe("Modelo IFPUG · Baseline 3.2");
    expect(option.description).toBe("Validada");
    expect(formatApfStatus("custom_status")).toBe("custom_status");
  });
});
