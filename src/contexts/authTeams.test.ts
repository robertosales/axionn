import { describe, expect, it } from "vitest";
import {
  chooseCurrentTeamId,
  deduplicateTeams,
  type AuthTeam,
} from "./authTeams";

const teams: AuthTeam[] = [
  {
    id: "agil-a",
    name: "Ágil A",
    module: "sala_agil",
    organizationId: "org-a",
  },
  {
    id: "sust-a",
    name: "Sustentação A",
    module: "sustentacao",
    organizationId: "org-a",
  },
];

describe("chooseCurrentTeamId", () => {
  it("preserva o time atual quando ele pertence ao módulo ativo", () => {
    expect(
      chooseCurrentTeamId({
        teams,
        currentTeamId: "agil-a",
        savedTeamId: "sust-a",
        activeModule: "sala_agil",
      }),
    ).toBe("agil-a");
  });

  it("descarta um time salvo de outro módulo", () => {
    expect(
      chooseCurrentTeamId({
        teams,
        currentTeamId: null,
        savedTeamId: "sust-a",
        activeModule: "sala_agil",
      }),
    ).toBe("agil-a");
  });

  it("permite qualquer módulo para administradores da plataforma", () => {
    expect(
      chooseCurrentTeamId({
        teams,
        currentTeamId: null,
        savedTeamId: "sust-a",
        activeModule: null,
      }),
    ).toBe("sust-a");
  });

  it("retorna null quando não existe time no contexto solicitado", () => {
    expect(
      chooseCurrentTeamId({
        teams,
        currentTeamId: null,
        savedTeamId: null,
        activeModule: "rdm",
      }),
    ).toBeNull();
  });
});

describe("deduplicateTeams", () => {
  it("remove duplicidade do mesmo time e módulo", () => {
    expect(deduplicateTeams([...teams, teams[0]])).toHaveLength(2);
  });
});
