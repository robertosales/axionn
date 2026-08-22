interface ResolveHomePathOptions {
  isAdmin: boolean;
  isPlatformAdmin: boolean;
  isOrganizationAdmin: boolean;
  hasModuleAccess: (module: string) => boolean;
  roles: string[];
}

export function resolveHomePath({
  isAdmin,
  isPlatformAdmin,
  isOrganizationAdmin,
  hasModuleAccess,
  roles,
}: ResolveHomePathOptions): string {
  // Administradores atuam em mais de um contexto e devem escolher
  // conscientemente o ambiente de trabalho após autenticar.
  if (isAdmin || isPlatformAdmin) return "/modulos";

  const agil = hasModuleAccess("sala_agil");
  const sustentacao = hasModuleAccess("sustentacao");
  const rdm = hasModuleAccess("rdm");
  const hasAnyModule = agil || sustentacao || rdm;

  if (isOrganizationAdmin && !hasAnyModule) return "/organization/admin";
  if (roles.includes("admin_contrato")) return "/meu-contrato";

  const moduleCount = [agil, sustentacao, rdm].filter(Boolean).length;
  if (moduleCount >= 2) return "/modulos";
  if (sustentacao) return "/sustentacao";
  if (agil) return "/sala-agil/dashboard";
  if (rdm) return "/rdm";
  return "/modulos";
}
