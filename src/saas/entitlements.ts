export const ENTITLEMENT_KEYS = {
  // Limites organizacionais
  USERS_MAX: "users.max",
  PROJECTS_MAX: "projects.max",
  CONTRACTS_MAX: "contracts.max",
  TEAMS_MAX: "teams.max",
  INTEGRATIONS_MAX: "integrations.max",
  STORAGE_GB: "storage.gb",

  // APF
  APF_COUNTINGS_MONTHLY: "apf.countings.monthly",

  // IA
  AI_CALLS_MONTHLY: "ai.calls.monthly",
  AI_TOKENS_MONTHLY: "ai.tokens.monthly",
  APF_AI_GENERATION: "apf.ai_generation",
  AI_BRIEFING_ENABLED: "ai.briefing.enabled",
  AI_SPRINT_SUMMARY: "ai.sprint_summary",
  AI_RISK_ANALYSIS: "ai.risk_analysis",
  AI_METRIC_EXPLANATION: "ai.metric_explanation",
  AI_RECOMMENDATIONS: "ai.recommendations",
  AI_CUSTOM_PROVIDER: "ai.custom_provider",
  AI_AUDIT_LOGS: "ai.audit_logs",

  // Relatórios
  REPORTS_ADVANCED: "reports.advanced",
  REPORTS_EXPORT_CSV: "reports.export_csv",
  REPORTS_EXPORT_PDF: "reports.export_pdf",
  REPORTS_EVIDENCE: "reports.evidence",
  REPORTS_SCHEDULE: "reports.schedule",
  REPORTS_HISTORY_EXTENDED: "reports.history_extended",

  // Métricas
  METRICS_BASIC: "metrics.basic",
  METRICS_ADVANCED: "metrics.advanced",

  // OKR
  OKR_VIEW: "okr.view",
  OKR_CREATE: "okr.create",
  OKR_EDIT: "okr.edit",
  OKR_ARCHIVE: "okr.archive",
  OKR_CHECK_IN: "okr.check_in",
  OKR_INITIATIVES: "okr.initiatives",
  OKR_AUTOMATIC_METRICS: "okr.automatic_metrics",
  OKR_HISTORY: "okr.history",
  OKR_EXPORT: "okr.export",
  OKR_AI_RECOMMENDATIONS: "okr.ai_recommendations",

  // Auditoria
  AUDIT_ACCESS: "audit.access",
  AUDIT_FULL: "audit.full",

  // Integrações
  INTEGRATIONS_GITLAB: "integrations.gitlab",
  INTEGRATIONS_GITHUB: "integrations.github",
  INTEGRATIONS_JIRA: "integrations.jira",
  INTEGRATIONS_CUSTOM: "integrations.custom",

  // Segurança
  SECURITY_SSO: "security.sso",
  SECURITY_KEYCLOAK: "security.keycloak",
  SECURITY_SESSION_POLICIES: "security.session_policies",
  SECURITY_AUTH_LOGS: "security.auth_logs",

  // Governança
  GOVERNANCE_DATA_RETENTION: "governance.data_retention",
  GOVERNANCE_COMPLIANCE: "governance.compliance",

  // Operação
  TEAMS_VIEW: "teams.view",
  TEAMS_CREATE: "teams.create",
  MEMBERS_INVITE: "members.invite",
  ACTIVITIES_VIEW: "activities.view",
  CALENDAR_VIEW: "calendar.view",
  SPRINTS_VIEW: "sprints.view",
  RELEASES_VIEW: "releases.view",
  IMPEDIMENTS_VIEW: "impediments.view",
} as const;

export type OrganizationEntitlementKey =
  (typeof ENTITLEMENT_KEYS)[keyof typeof ENTITLEMENT_KEYS];

export type OrganizationSubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "canceled"
  | "expired";

export interface EffectiveOrganizationEntitlement {
  orgId: string;
  planCode: string;
  subscriptionStatus: OrganizationSubscriptionStatus;
  featureKey: OrganizationEntitlementKey | string;
  enabled: boolean;
  limitValue: number | null;
  source: "plan" | "organization_override" | "missing" | string;
}

export interface OrganizationUsageSummary {
  organizationId: string;
  planCode: string;
  subscriptionStatus: OrganizationSubscriptionStatus;
  usersUsed: number;
  usersLimit: number | null;
  projectsUsed: number;
  projectsLimit: number | null;
  contractsUsed: number;
  contractsLimit: number | null;
  apfCountingsUsed: number;
  apfCountingsLimit: number | null;
  aiCallsUsed: number;
  aiCallsLimit: number | null;
  quotaResetAt: string | null;
}

export function findEntitlement(
  entitlements: EffectiveOrganizationEntitlement[],
  featureKey: OrganizationEntitlementKey | string,
) {
  return entitlements.find(
    (entitlement) => entitlement.featureKey === featureKey,
  );
}

export function hasEnabledEntitlement(
  entitlements: EffectiveOrganizationEntitlement[],
  featureKey: OrganizationEntitlementKey | string,
) {
  return findEntitlement(entitlements, featureKey)?.enabled === true;
}

export function isUnlimitedLimit(limitValue: number | null | undefined) {
  return limitValue == null;
}

export function isWithinEntitlementLimit(
  used: number,
  limitValue: number | null | undefined,
) {
  return isUnlimitedLimit(limitValue) || used < limitValue;
}

export function remainingEntitlementLimit(
  used: number,
  limitValue: number | null | undefined,
) {
  if (isUnlimitedLimit(limitValue)) return null;
  return Math.max((limitValue ?? 0) - used, 0);
}
