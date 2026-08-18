import { beforeEach, describe, expect, it } from "vitest";
import {
  moduleTeamStorageKey,
  persistModuleTeamSelection,
  readModuleTeamSelection,
} from "./moduleTeamSelection";

describe("moduleTeamSelection", () => {
  beforeEach(() => window.localStorage.clear());

  it("mantém uma seleção independente para cada módulo", () => {
    persistModuleTeamSelection("sala_agil", "agil-a");
    persistModuleTeamSelection("sustentacao", "sust-a");

    expect(readModuleTeamSelection("sala_agil")).toBe("agil-a");
    expect(readModuleTeamSelection("sustentacao")).toBe("sust-a");
    expect(readModuleTeamSelection("rdm")).toBeNull();
  });

  it("usa chaves estáveis e específicas do módulo", () => {
    expect(moduleTeamStorageKey("sala_agil")).toBe("selectedTeamId_sala_agil");
    expect(moduleTeamStorageKey("sustentacao")).toBe("selectedTeamId_sustentacao");
    expect(moduleTeamStorageKey("rdm")).toBe("selectedTeamId_rdm");
  });
});
