export type ProductDomain = "operation" | "intelligence" | "governance";
export type FeatureType = "capability" | "limit" | "service";

export interface ProductModuleDefinition {
  code: string;
  name: string;
  domain: ProductDomain;
}

export interface ProductFeatureDefinition {
  code: string;
  moduleCode: string;
  name: string;
  type: FeatureType;
  usageUnit?: string;
}

export const PRODUCT_MODULES: readonly ProductModuleDefinition[] = [
  { code: "organization", name: "Organização", domain: "operation" },
  { code: "projects", name: "Projetos", domain: "operation" },
  { code: "reports", name: "Relatórios", domain: "intelligence" },
  { code: "ai", name: "Inteligência artificial", domain: "intelligence" },
  { code: "okr", name: "OKR", domain: "governance" },
  { code: "audit", name: "Auditoria", domain: "governance" },
] as const;

export const PRODUCT_FEATURES: readonly ProductFeatureDefinition[] = [
  { code: "users.max", moduleCode: "organization", name: "Limite de usuários", type: "limit", usageUnit: "users" },
  { code: "projects.max", moduleCode: "projects", name: "Limite de projetos", type: "limit", usageUnit: "projects" },
  { code: "contracts.max", moduleCode: "organization", name: "Limite de contratos", type: "limit", usageUnit: "contracts" },
  { code: "reports.advanced", moduleCode: "reports", name: "Relatórios avançados", type: "capability" },
  { code: "ai.calls.monthly", moduleCode: "ai", name: "Chamadas de IA mensais", type: "limit", usageUnit: "calls" },
  { code: "ai.briefing.enabled", moduleCode: "ai", name: "Briefing por IA", type: "capability" },
  { code: "okr.view", moduleCode: "okr", name: "Visualizar OKRs", type: "capability" },
  { code: "okr.automatic_metrics", moduleCode: "okr", name: "Medições automáticas de OKR", type: "capability" },
  { code: "audit.access", moduleCode: "audit", name: "Acesso à auditoria", type: "capability" },
] as const;

export const COMMERCIAL_PLAN_ALIASES = { starter: "core", pro: "intelligence", enterprise: "enterprise" } as const;

export function getProductFeature(code: string) {
  return PRODUCT_FEATURES.find((feature) => feature.code === code) ?? null;
}

export function commercialPlanCode(legacyCode: string) {
  return COMMERCIAL_PLAN_ALIASES[legacyCode as keyof typeof COMMERCIAL_PLAN_ALIASES] ?? legacyCode;
}
