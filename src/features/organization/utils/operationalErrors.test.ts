import { describe, expect, it } from "vitest";
import { resolveOrganizationOperationalError } from "./operationalErrors";

describe("resolveOrganizationOperationalError", () => {
  it("translates contract plan limits from Supabase error details", () => {
    expect(
      resolveOrganizationOperationalError(
        {
          message: "organization_resource_limit_reached",
          details: "feature_key=contracts.max used=10 limit=10",
        },
        "fallback",
      ),
    ).toBe("O limite de contratos do plano foi atingido.");
  });

  it("translates project plan limits", () => {
    expect(
      resolveOrganizationOperationalError(
        {
          message: "organization_resource_limit_reached",
          details: "feature_key=projects.max used=5 limit=5",
        },
        "fallback",
      ),
    ).toBe("O limite de projetos ativos do plano foi atingido.");
  });

  it("fails with a business message on cross tenant access", () => {
    expect(
      resolveOrganizationOperationalError(
        { message: "resource_cross_tenant" },
        "fallback",
      ),
    ).toBe("O recurso selecionado não pertence à organização ativa.");
  });

  it("keeps the supplied fallback for an unknown error", () => {
    expect(
      resolveOrganizationOperationalError(
        { message: "unknown_database_error" },
        "Não foi possível concluir a operação.",
      ),
    ).toBe("Não foi possível concluir a operação.");
  });
});
