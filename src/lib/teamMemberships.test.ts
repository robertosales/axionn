import { describe, expect, it } from "vitest";
import { groupTeamMembershipsByUser } from "./teamMemberships";

describe("groupTeamMembershipsByUser", () => {
  it("mantém a mesma pessoa em times diferentes de módulos diferentes", () => {
    const result = groupTeamMembershipsByUser(
      [
        { id: "agil-a", name: "Time A", module: "sala_agil" },
        { id: "sust-a", name: "Time A", module: "sustentacao" },
      ],
      [
        { team_id: "agil-a", user_id: "roberto", role: "Desenvolvedor" },
        { team_id: "sust-a", user_id: "roberto", role: "Analista" },
      ],
    );

    expect(result.get("roberto")).toEqual([
      { id: "agil-a", name: "Time A", module: "sala_agil", role: "Desenvolvedor" },
      { id: "sust-a", name: "Time A", module: "sustentacao", role: "Analista" },
    ]);
  });

  it("ignora vínculos de times fora do contexto acessível", () => {
    const result = groupTeamMembershipsByUser(
      [{ id: "agil-a", name: "Time A", module: "sala_agil" }],
      [{ team_id: "outro-tenant", user_id: "roberto", role: "Analista" }],
    );

    expect(result.has("roberto")).toBe(false);
  });
});
