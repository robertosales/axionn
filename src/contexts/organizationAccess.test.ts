import { describe, expect, it } from "vitest";
import {
  resolveOrganizationAccess,
  resolveOrganizationPermissionAuthority,
} from "./organizationAccess";

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

describe("resolveOrganizationPermissionAuthority", () => {
  const orgRoles = [{ module: "sala_agil", roleName: "member" }];

  it("usa autoridade legada quando tenancy esta desligada", () => {
    expect(
      resolveOrganizationPermissionAuthority({
        tenancyEnabled: false,
        legacyFallbackEnabled: false,
        rpcStatus: "idle",
        isPlatformAdmin: false,
        module: "sala_agil",
        moduleRoles: [],
        legacyHasAccess: true,
        legacyRoleName: "member",
      }),
    ).toMatchObject({ source: "legacy", hasAccess: true });
  });

  it("usa fallback legado quando tenancy esta ligada e rollback esta ligado", () => {
    expect(
      resolveOrganizationPermissionAuthority({
        tenancyEnabled: true,
        legacyFallbackEnabled: true,
        rpcStatus: "unavailable",
        isPlatformAdmin: false,
        module: "sustentacao",
        moduleRoles: [],
        legacyHasAccess: true,
        legacyRoleName: "admin",
      }),
    ).toMatchObject({
      source: "legacy",
      hasAccess: true,
      roleName: "admin",
      shouldWarnLegacyFallback: true,
    });
  });

  it("falha fechado quando tenancy esta ligada e fallback esta desligado", () => {
    expect(
      resolveOrganizationPermissionAuthority({
        tenancyEnabled: true,
        legacyFallbackEnabled: false,
        rpcStatus: "unavailable",
        isPlatformAdmin: false,
        module: "sustentacao",
        moduleRoles: [],
        legacyHasAccess: true,
        legacyRoleName: "admin",
      }),
    ).toMatchObject({ source: "closed", hasAccess: false, failClosed: true });
  });

  it("nao concede modulo quando RPC retorna sucesso com zero modulos", () => {
    expect(
      resolveOrganizationPermissionAuthority({
        tenancyEnabled: true,
        legacyFallbackEnabled: false,
        rpcStatus: "success",
        isPlatformAdmin: false,
        module: "sala_agil",
        moduleRoles: [],
      }),
    ).toMatchObject({ source: "organization", hasAccess: false });
  });

  it("falha fechado em erro de RPC com fallback desligado", () => {
    expect(
      resolveOrganizationPermissionAuthority({
        tenancyEnabled: true,
        legacyFallbackEnabled: false,
        rpcStatus: "error",
        isPlatformAdmin: false,
        module: "rdm",
        moduleRoles: [],
        legacyHasAccess: true,
      }),
    ).toMatchObject({ source: "closed", failClosed: true });
  });

  it("preserva platform admin", () => {
    expect(
      resolveOrganizationPermissionAuthority({
        tenancyEnabled: true,
        legacyFallbackEnabled: false,
        rpcStatus: "error",
        isPlatformAdmin: true,
        module: "rdm",
        moduleRoles: [],
      }),
    ).toMatchObject({ source: "platform_admin", roleName: "admin" });
  });

  it("usa papeis organizacionais quando RPC tem sucesso", () => {
    expect(
      resolveOrganizationPermissionAuthority({
        tenancyEnabled: true,
        legacyFallbackEnabled: false,
        rpcStatus: "success",
        isPlatformAdmin: false,
        module: "sala_agil",
        moduleRoles: orgRoles,
      }),
    ).toMatchObject({ source: "organization", hasAccess: true });
  });

  it("troca de organizacao sem RPC bem-sucedido nao herda modulo anterior", () => {
    expect(
      resolveOrganizationPermissionAuthority({
        tenancyEnabled: true,
        legacyFallbackEnabled: false,
        rpcStatus: "idle",
        isPlatformAdmin: false,
        module: "sala_agil",
        moduleRoles: orgRoles,
      }),
    ).toMatchObject({ source: "closed", hasAccess: false });
  });
});
