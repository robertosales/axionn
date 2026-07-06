import { describe, expect, it } from "vitest";
import {
  hasManagedApplicationChrome,
  isModuleShellRoute,
} from "./layoutRoutes";

describe("isModuleShellRoute", () => {
  it.each([
    "/sala-agil/dashboard",
    "/sala-agil/planning-poker",
    "/sustentacao",
    "/sustentacao/demandas",
    "/rdm/rdms",
    "/okr",
  ])("recognizes %s as a module shell route", (pathname) => {
    expect(isModuleShellRoute(pathname)).toBe(true);
  });

  it.each(["/auth", "/modulos", "/organization/admin", "/platform"])(
    "does not classify %s as a module shell route",
    (pathname) => {
      expect(isModuleShellRoute(pathname)).toBe(false);
    },
  );
});

describe("hasManagedApplicationChrome", () => {
  it.each([
    "/modulos",
    "/dashboard-admin",
    "/organization/admin",
    "/organization/members",
    "/platform/ai-providers",
    "/sustentacao/dashboard",
  ])("suppresses floating controls on %s", (pathname) => {
    expect(hasManagedApplicationChrome(pathname)).toBe(true);
  });

  it("keeps floating controls available on an unowned legacy page", () => {
    expect(hasManagedApplicationChrome("/meu-contrato")).toBe(false);
  });
});
