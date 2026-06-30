export type OrganizationStatus =
  | "active"
  | "trial"
  | "suspended"
  | "cancelled";

export type OrganizationAccessMode =
  | "operational"
  | "read_only"
  | "unavailable";

export interface OrganizationAccessDecision {
  mode: OrganizationAccessMode;
  canOperate: boolean;
  reason: string | null;
}

export function resolveOrganizationAccess(options: {
  status: OrganizationStatus | null;
  isPlatformAdmin: boolean;
}): OrganizationAccessDecision {
  const { status, isPlatformAdmin } = options;

  if (isPlatformAdmin && status) {
    return { mode: "operational", canOperate: true, reason: null };
  }

  if (status === "active" || status === "trial") {
    return { mode: "operational", canOperate: true, reason: null };
  }

  if (status === "suspended") {
    return {
      mode: "read_only",
      canOperate: false,
      reason:
        "Esta organização está suspensa. Os dados permanecem disponíveis para consulta, mas as operações estão bloqueadas.",
    };
  }

  if (status === "cancelled") {
    return {
      mode: "read_only",
      canOperate: false,
      reason:
        "Esta organização está cancelada. As operações foram bloqueadas e o acesso está limitado à consulta administrativa.",
    };
  }

  return {
    mode: "unavailable",
    canOperate: false,
    reason: "Nenhuma organização válida está selecionada para esta conta.",
  };
}
