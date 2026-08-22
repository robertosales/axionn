import { describe, expect, it } from "vitest";
import { resolveHomePath } from "@/lib/homeRoute";

const accessTo = (...allowed: string[]) => (module: string) => allowed.includes(module);

describe("resolveHomePath", () => {
  it("sends system administrators to the module selector", () => {
    expect(resolveHomePath({
      isAdmin: true,
      isPlatformAdmin: false,
      isOrganizationAdmin: false,
      hasModuleAccess: accessTo(),
      roles: ["admin"],
    })).toBe("/modulos");
  });

  it("sends platform administrators to the module selector", () => {
    expect(resolveHomePath({
      isAdmin: false,
      isPlatformAdmin: true,
      isOrganizationAdmin: false,
      hasModuleAccess: accessTo(),
      roles: [],
    })).toBe("/modulos");
  });

  it("keeps direct entry for a regular user with one module", () => {
    expect(resolveHomePath({
      isAdmin: false,
      isPlatformAdmin: false,
      isOrganizationAdmin: false,
      hasModuleAccess: accessTo("sala_agil"),
      roles: [],
    })).toBe("/sala-agil/dashboard");
  });

  it("uses the selector when a regular user has multiple modules", () => {
    expect(resolveHomePath({
      isAdmin: false,
      isPlatformAdmin: false,
      isOrganizationAdmin: false,
      hasModuleAccess: accessTo("sala_agil", "sustentacao"),
      roles: [],
    })).toBe("/modulos");
  });
});
