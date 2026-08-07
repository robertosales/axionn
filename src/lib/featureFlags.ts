export const ORGANIZATION_TENANCY_ENABLED =
  import.meta.env.VITE_ORG_TENANCY_ENABLED === "true";

export const QUALITY_MANAGEMENT_ENABLED =
  import.meta.env.VITE_QUALITY_MANAGEMENT_ENABLED === "true";

export const BACKOFFICE_MFA_REQUIRED =
  import.meta.env.VITE_BACKOFFICE_MFA_REQUIRED === "true";

/**
 * OKR v2 — arquitetura de fechamento de ciclo (docs/okr-plano-mestre.md).
 * Após o rollout validado, a UI V2 fica ativa quando a variável não está definida.
 * Definir explicitamente `VITE_OKR_V2_ENABLED=false` mantém o rollback operacional.
 */
export const OKR_V2_ENABLED =
  import.meta.env.VITE_OKR_V2_ENABLED !== "false";
