import { describe, expect, it } from "vitest";
import { resolveOrganizationAccess } from "./organizationAccess";

describe("resolveOrganizationAccess", () => {
  it("permite operações para organização ativa", () => {
    expect(
      resolveOrganizationAccess({ status: "active", isPlatformAdmin: false }),
    ).toMatchObject({ mode: "operational", canOperate: true });
  });

  it("permite operações durante o período de avaliação", () => {
    expect(
      resolveOrganizationAccess({ status: "trial", isPlatformAdmin: false }),
    ).toMatchObject({ mode: "operational", canOperate: true });
  });

  it("mantém organização suspensa em modo somente leitura", () => {
    const decision = resolveOrganizationAccess({
      status: "suspended",
      isPlatformAdmin: false,
    });

    expect(decision.mode).toBe("read_only");
    expect(decision.canOperate).toBe(false);
    expect(decision.reason).toContain("suspensa");
  });

  it("permite suporte operacional ao administrador da plataforma", () => {
    expect(
      resolveOrganizationAccess({
        status: "cancelled",
        isPlatformAdmin: true,
      }),
    ).toMatchObject({ mode: "operational", canOperate: true });
  });

  it("bloqueia quando não há organização selecionada", () => {
    expect(
      resolveOrganizationAccess({ status: null, isPlatformAdmin: false }),
    ).toMatchObject({ mode: "unavailable", canOperate: false });
  });
});
