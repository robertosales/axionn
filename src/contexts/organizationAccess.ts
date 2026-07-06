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

export type OrganizationModuleRpcStatus =
  | "idle"
  | "success"
  | "unavailable"
  | "error";

export type PermissionAuthoritySource =
  | "legacy"
  | "organization"
  | "platform_admin"
  | "closed";

export interface PermissionAuthorityDecision {
  source: PermissionAuthoritySource;
  hasAccess: boolean;
  roleName: string | null;
  failClosed: boolean;
  shouldWarnLegacyFallback: boolean;
}

export function resolveOrganizationAccess(options: {
  status: OrganizationStatus | null;
  isPlatformAdmin: boolean;
}): OrganizationAccessDecision {
  const { status, isPlatformAdmin } = options;

  if (isPlatformAdmin) {
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

export function resolveOrganizationPermissionAuthority(options: {
  tenancyEnabled: boolean;
  legacyFallbackEnabled: boolean;
  rpcStatus: OrganizationModuleRpcStatus;
  isPlatformAdmin: boolean;
  module: string;
  moduleRoles: Array<{ module: string; roleName: string }>;
  legacyRoleName?: string | null;
  legacyHasAccess?: boolean;
}): PermissionAuthorityDecision {
  const {
    tenancyEnabled,
    legacyFallbackEnabled,
    rpcStatus,
    isPlatformAdmin,
    module,
    moduleRoles,
    legacyRoleName = null,
    legacyHasAccess = false,
  } = options;

  if (!tenancyEnabled) {
    return {
      source: "legacy",
      hasAccess: legacyHasAccess,
      roleName: legacyRoleName,
      failClosed: false,
      shouldWarnLegacyFallback: false,
    };
  }

  if (isPlatformAdmin) {
    return {
      source: "platform_admin",
      hasAccess: true,
      roleName: "admin",
      failClosed: false,
      shouldWarnLegacyFallback: false,
    };
  }

  if (rpcStatus === "success") {
    const role = moduleRoles.find((moduleRole) => moduleRole.module === module);
    return {
      source: "organization",
      hasAccess: Boolean(role),
      roleName: role?.roleName ?? null,
      failClosed: false,
      shouldWarnLegacyFallback: false,
    };
  }

  if (
    legacyFallbackEnabled &&
    (rpcStatus === "unavailable" || rpcStatus === "error")
  ) {
    return {
      source: "legacy",
      hasAccess: legacyHasAccess,
      roleName: legacyRoleName,
      failClosed: false,
      shouldWarnLegacyFallback: true,
    };
  }

  return {
    source: "closed",
    hasAccess: false,
    roleName: null,
    failClosed: true,
    shouldWarnLegacyFallback: false,
  };
}
