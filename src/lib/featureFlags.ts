export const ORGANIZATION_TENANCY_ENABLED =
  import.meta.env.VITE_ORG_TENANCY_ENABLED === "true";

export const QUALITY_MANAGEMENT_ENABLED =
  import.meta.env.VITE_QUALITY_MANAGEMENT_ENABLED === "true";

/**
 * OKR v2 — arquitetura de fechamento de ciclo (docs/okr-plano-mestre.md).
 * Enquanto `false`, a UI legada de OKR permanece ativa e nenhuma tela nova é exposta.
 * As RPCs `_v2` podem ser criadas mesmo com a flag desligada — a flag só governa a UI.
 */
export const OKR_V2_ENABLED =
  import.meta.env.VITE_OKR_V2_ENABLED === "true";
