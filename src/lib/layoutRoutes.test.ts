import { describe, expect, it } from "vitest";
import {
  hasManagedApplicationChrome,
  isModuleShellRoute,
} from "./layoutRoutes";

describe("premium shell route ownership", () => {
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

  it("keeps legacy floating controls available outside managed shells", () => {
    expect(hasManagedApplicationChrome("/meu-contrato")).toBe(false);
  });
});
