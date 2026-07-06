import { describe, expect, it } from "vitest";
import { chooseCurrentOrganizationId } from "./OrganizationContext";

describe("chooseCurrentOrganizationId", () => {
  const organizations = [{ id: "org-a" }, { id: "org-b" }];

  it("preserva a organização selecionada quando ela continua acessível", () => {
    expect(chooseCurrentOrganizationId(organizations, "org-b")).toBe("org-b");
  });

  it("seleciona a primeira organização quando a seleção ficou inválida", () => {
    expect(chooseCurrentOrganizationId(organizations, "org-x")).toBe("org-a");
  });

  it("retorna null quando o usuário não possui organizações", () => {
    expect(chooseCurrentOrganizationId([], "org-a")).toBeNull();
  });
});
