export type OperationalModule = "sala_agil" | "sustentacao" | "rdm";

export const moduleTeamStorageKey = (module: OperationalModule) =>
  `selectedTeamId_${module}`;

export function readModuleTeamSelection(module: OperationalModule) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(moduleTeamStorageKey(module));
}

export function persistModuleTeamSelection(module: OperationalModule, teamId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(moduleTeamStorageKey(module), teamId);
}
