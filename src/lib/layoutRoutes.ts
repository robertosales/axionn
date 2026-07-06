const MODULE_SHELL_PREFIXES = [
  "/sala-agil",
  "/sustentacao",
  "/rdm",
] as const;

export function isModuleShellRoute(pathname: string) {
  return (
    pathname === "/okr" ||
    MODULE_SHELL_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  );
}

export function hasManagedApplicationChrome(pathname: string) {
  return (
    pathname === "/modulos" ||
    pathname === "/dashboard-admin" ||
    pathname.startsWith("/organization/") ||
    pathname.startsWith("/platform/") ||
    isModuleShellRoute(pathname)
  );
}
