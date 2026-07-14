import { describe, expect, it } from "vitest";
import { getLoginErrorMessage } from "./Auth";

describe("getLoginErrorMessage", () => {
  it("explica bloqueio explícito de usuário", () => {
    expect(getLoginErrorMessage("User is banned")).toContain("desativado");
  });

  it("não confunde credencial inválida com certeza de inatividade", () => {
    const message = getLoginErrorMessage("Invalid login credentials");
    expect(message).toContain("E-mail ou senha inválidos");
    expect(message).toContain("desativado");
  });

  it("preserva erros não mapeados", () => {
    expect(getLoginErrorMessage("Network request failed")).toBe("Network request failed");
  });
});
