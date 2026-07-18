import { supabase } from "@/integrations/supabase/client";

export const PLAN_STATUS_OPTIONS = ["active", "inactive", "archived"] as const;
export const SUBSCRIPTION_STATUS_OPTIONS = [
  "pending",
  "trialing",
  "active",
  "past_due",
  "suspended",
  "canceled",
  "expired",
] as const;

export type PlanStatus = (typeof PLAN_STATUS_OPTIONS)[number];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUS_OPTIONS)[number];

// ============================================================
// NEW COMMERCIAL CATALOG TYPES
// ============================================================

export interface ProductModule {
  id: string;
  code: string;
  name: string;
  description: string | null;
  domain: "operation" | "intelligence" | "governance";
  status: "active" | "inactive";
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductFeature {
  id: string;
  moduleId: string;
  moduleCode: string;
  moduleName: string;
  code: string;
  name: string;
  description: string | null;
  featureType: "capability" | "limit" | "service";
  usageUnit: string | null;
  status: "active" | "inactive";
  dependencies: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SaasPlanVersionFeature {
  id: string;
  planVersionId: string;
  featureId: string;
  featureCode: string;
  featureName: string;
  moduleCode: string;
  accessLevel: "none" | "basic" | "full" | "custom";
  enabled: boolean;
  limitValue: number | null;
  resetPeriod: "daily" | "monthly" | "yearly" | "none" | null;
  enforcementMode: "soft" | "hard" | "notify";
  configuration: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SaasPlanVersion {
  id: string;
  planId: string;
  planCode: string;
  planName: string;
  version: number;
  status: "draft" | "active" | "retired";
  validFrom: string | null;
  validUntil: string | null;
  currency: string | null;
  billingInterval: "monthly" | "yearly" | "custom" | null;
  basePrice: number | null;
  perUserPrice: number | null;
  trialAllowed: boolean;
  trialDays: number | null;
  changeReason: string | null;
  metadata: Record<string, unknown>;
  features: SaasPlanVersionFeature[];
  createdAt: string;
  updatedAt: string;
}

export interface SaasPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  audience: string | null;
  status: PlanStatus;
  displayOrder: number;
  isPublic: boolean;
  requiresSalesContact: boolean;
  trialAllowed: boolean;
  trialDaysDefault: number | null;
  currency: string;
  billingInterval: "monthly" | "yearly" | "custom";
  basePrice: number | null;
  perUserPrice: number | null;
  validFrom: string | null;
  validUntil: string | null;
  metadata: Record<string, unknown>;
  versions: SaasPlanVersion[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// LEGACY TYPES (for backward compatibility)
// ============================================================

export interface PlatformPlanEntitlement {
  id: string;
  featureKey: string;
  enabled: boolean;
  limitValue: number | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: PlanStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  entitlements: PlatformPlanEntitlement[];
}

export interface OrganizationOverride {
  id: string;
  featureKey: string;
  enabled: boolean | null;
  limitValue: number | null;
  reason: string | null;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformOrganizationSubscription {
  orgId: string;
  orgName: string;
  orgSlug: string;
  orgStatus: string;
  orgPlan: string;
  subscriptionId: string | null;
  planId: string | null;
  planCode: string | null;
  planName: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  startsAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  source: string | null;
  usersUsed: number;
  projectsUsed: number;
  contractsUsed: number;
  overrides: OrganizationOverride[];
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// ============================================================
// NEW CATALOG SERVICE FUNCTIONS
// ============================================================

function normalizeProductModule(row: Record<string, unknown>): ProductModule {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    domain: String(row.domain) as "operation" | "intelligence" | "governance",
    status: String(row.status) as "active" | "inactive",
    displayOrder: toNumber(row.display_order),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function normalizeProductFeature(row: Record<string, unknown>): ProductFeature {
  return {
    id: String(row.id),
    moduleId: String(row.module_id),
    moduleCode: String(row.module_code ?? ""),
    moduleName: String(row.module_name ?? ""),
    code: String(row.code),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    featureType: String(row.feature_type) as "capability" | "limit" | "service",
    usageUnit: row.usage_unit == null ? null : String(row.usage_unit),
    status: String(row.status) as "active" | "inactive",
    dependencies: Array.isArray(row.dependencies) ? row.dependencies.map(String) : [],
    metadata: normalizeJsonObject(row.metadata),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function normalizePlanVersionFeature(row: Record<string, unknown>): SaasPlanVersionFeature {
  return {
    id: String(row.id),
    planVersionId: String(row.plan_version_id),
    featureId: String(row.feature_id),
    featureCode: String(row.feature_code ?? ""),
    featureName: String(row.feature_name ?? ""),
    moduleCode: String(row.module_code ?? ""),
    accessLevel: String(row.access_level) as "none" | "basic" | "full" | "custom",
    enabled: Boolean(row.enabled),
    limitValue: toNullableNumber(row.limit_value),
    resetPeriod: row.reset_period == null ? null : String(row.reset_period) as "daily" | "monthly" | "yearly" | "none",
    enforcementMode: String(row.enforcement_mode) as "soft" | "hard" | "notify",
    configuration: normalizeJsonObject(row.configuration),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function normalizePlanVersion(row: Record<string, unknown>): SaasPlanVersion {
  return {
    id: String(row.id),
    planId: String(row.plan_id),
    planCode: String(row.plan_code ?? ""),
    planName: String(row.plan_name ?? ""),
    version: toNumber(row.version),
    status: String(row.status) as "draft" | "active" | "retired",
    validFrom: row.valid_from == null ? null : String(row.valid_from),
    validUntil: row.valid_until == null ? null : String(row.valid_until),
    currency: row.currency == null ? null : String(row.currency),
    billingInterval: row.billing_interval == null ? null : String(row.billing_interval) as "monthly" | "yearly" | "custom",
    basePrice: toNullableNumber(row.base_price),
    perUserPrice: toNullableNumber(row.per_user_price),
    trialAllowed: Boolean(row.trial_allowed),
    trialDays: toNullableNumber(row.trial_days),
    changeReason: row.change_reason == null ? null : String(row.change_reason),
    metadata: normalizeJsonObject(row.metadata),
    features: [],
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function normalizePlan(row: Record<string, unknown>): SaasPlan {
  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    audience: row.audience == null ? null : String(row.audience),
    status: String(row.status) as PlanStatus,
    displayOrder: toNumber(row.display_order),
    isPublic: Boolean(row.is_public),
    requiresSalesContact: Boolean(row.requires_sales_contact),
    trialAllowed: Boolean(row.trial_allowed),
    trialDaysDefault: toNullableNumber(row.trial_days_default),
    currency: String(row.currency ?? "BRL"),
    billingInterval: String(row.billing_interval ?? "monthly") as "monthly" | "yearly" | "custom",
    basePrice: toNullableNumber(row.base_price),
    perUserPrice: toNullableNumber(row.per_user_price),
    validFrom: row.valid_from == null ? null : String(row.valid_from),
    validUntil: row.valid_until == null ? null : String(row.valid_until),
    metadata: normalizeJsonObject(row.metadata),
    versions: [],
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

// ============================================================
// NEW CATALOG SERVICE FUNCTIONS
// ============================================================

export async function listProductModules(): Promise<ProductModule[]> {
  const { data, error } = await supabase
    .from("product_modules")
    .select("*")
    .eq("status", "active")
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizeProductModule);
}

export async function listProductFeatures(): Promise<ProductFeature[]> {
  const { data, error } = await supabase
    .from("product_features")
    .select(`
      *,
      module:product_modules!inner(code, name)
    `)
    .eq("status", "active")
    .order("module_id")
    .order("code");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...normalizeProductFeature(row),
    moduleCode: row.module?.code ?? "",
    moduleName: row.module?.name ?? "",
  }));
}

export async function listSaasPlans(): Promise<SaasPlan[]> {
  const { data, error } = await supabase
    .from("saas_plans")
    .select(`
      *,
      versions:saas_plan_versions(
        *,
        features:saas_plan_version_features(
          *,
          feature:product_features(code, name, module_code)
        )
      )
    `)
    .eq("status", "active")
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...normalizePlan(row),
    versions: (row.versions ?? []).map((v: Record<string, unknown>) => ({
      ...normalizePlanVersion(v),
      features: (v.features ?? []).map((f: Record<string, unknown>) => ({
        ...normalizePlanVersionFeature(f),
        featureCode: f.feature?.code ?? "",
        featureName: f.feature?.name ?? "",
        moduleCode: f.feature?.module_code ?? "",
      })),
    })),
  }));
}

export async function getSaasPlanWithVersions(planCode: string): Promise<SaasPlan | null> {
  const { data, error } = await supabase
    .from("saas_plans")
    .select(`
      *,
      versions:saas_plan_versions(
        *,
        features:saas_plan_version_features(
          *,
          feature:product_features(code, name, module_code, feature_type, usage_unit)
        )
      )
    `)
    .eq("code", planCode)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const plan = normalizePlan(data);
  return {
    ...plan,
    versions: (data.versions ?? []).map((v: Record<string, unknown>) => ({
      ...normalizePlanVersion(v),
      features: (v.features ?? []).map((f: Record<string, unknown>) => ({
        ...normalizePlanVersionFeature(f),
        featureCode: f.feature?.code ?? "",
        featureName: f.feature?.name ?? "",
        moduleCode: f.feature?.module_code ?? "",
      })),
    })),
  };
}

export async function getActivePlanVersion(planCode: string): Promise<SaasPlanVersion | null> {
  const { data, error } = await supabase
    .from("saas_plan_versions")
    .select(`
      *,
      plan:saas_plans!inner(code),
      features:saas_plan_version_features(
        *,
        feature:product_features(code, name, module_code, feature_type, usage_unit)
      )
    `)
    .eq("plan.code", planCode)
    .eq("status", "active")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const version = normalizePlanVersion(data);
  version.features = (data.features ?? []).map((f: Record<string, unknown>) => ({
    ...normalizePlanVersionFeature(f),
    featureCode: f.feature?.code ?? "",
    featureName: f.feature?.name ?? "",
    moduleCode: f.feature?.module_code ?? "",
  }));
  return version;
}

// ============================================================
// LEGACY SERVICE FUNCTIONS (for backward compatibility)
// ============================================================

function toNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeEntitlement(row: Record<string, unknown>): PlatformPlanEntitlement {
  return {
    id: String(row.id),
    featureKey: String(row.feature_key ?? ""),
    enabled: Boolean(row.enabled),
    limitValue: toNullableNumber(row.limit_value),
    metadata: normalizeJsonObject(row.metadata),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function normalizePlan(row: Record<string, unknown>): PlatformPlan {
  const entitlements = Array.isArray(row.entitlements)
    ? row.entitlements
    : [];

  return {
    id: String(row.id),
    code: String(row.code ?? ""),
    name: String(row.name ?? "Plano"),
    description: row.description == null ? null : String(row.description),
    status: String(row.status ?? "inactive") as PlanStatus,
    metadata: normalizeJsonObject(row.metadata),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    entitlements: entitlements.map((item) =>
      normalizeEntitlement(item as Record<string, unknown>),
    ),
  };
}

function normalizeOverride(row: Record<string, unknown>): OrganizationOverride {
  return {
    id: String(row.id),
    featureKey: String(row.feature_key ?? ""),
    enabled: row.enabled == null ? null : Boolean(row.enabled),
    limitValue: toNullableNumber(row.limit_value),
    reason: row.reason == null ? null : String(row.reason),
    startsAt: row.starts_at == null ? null : String(row.starts_at),
    endsAt: row.ends_at == null ? null : String(row.ends_at),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function normalizeSubscription(
  row: Record<string, unknown>,
): PlatformOrganizationSubscription {
  const overrides = Array.isArray(row.overrides) ? row.overrides : [];

  return {
    orgId: String(row.org_id),
    orgName: String(row.org_name ?? "Organizacao"),
    orgSlug: String(row.org_slug ?? ""),
    orgStatus: String(row.org_status ?? ""),
    orgPlan: String(row.org_plan ?? ""),
    subscriptionId: row.subscription_id == null ? null : String(row.subscription_id),
    planId: row.plan_id == null ? null : String(row.plan_id),
    planCode: row.plan_code == null ? null : String(row.plan_code),
    planName: row.plan_name == null ? null : String(row.plan_name),
    subscriptionStatus:
      row.subscription_status == null
        ? null
        : (String(row.subscription_status) as SubscriptionStatus),
    startsAt: row.starts_at == null ? null : String(row.starts_at),
    trialEndsAt: row.trial_ends_at == null ? null : String(row.trial_ends_at),
    currentPeriodStart:
      row.current_period_start == null ? null : String(row.current_period_start),
    currentPeriodEnd:
      row.current_period_end == null ? null : String(row.current_period_end),
    canceledAt: row.canceled_at == null ? null : String(row.canceled_at),
    source: row.source == null ? null : String(row.source),
    usersUsed: toNumber(row.users_used),
    projectsUsed: toNumber(row.projects_used),
    contractsUsed: toNumber(row.contracts_used),
    overrides: overrides.map((item) =>
      normalizeOverride(item as Record<string, unknown>),
    ),
  };
}

// ============================================================
// LEGACY SERVICE FUNCTIONS (for backward compatibility)
// ============================================================

export async function listPlatformPlans(includeArchived = false) {
  const { data, error } = await (supabase as any).rpc(
    "list_platform_saas_plans_v1",
    { p_include_archived: includeArchived },
  );
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(normalizePlan);
}

export async function createPlatformPlan(payload: {
  code: string;
  name: string;
  description: string | null;
  status: PlanStatus;
}) {
  const { data, error } = await (supabase as any).rpc(
    "create_platform_saas_plan_v1",
    {
      p_code: payload.code,
      p_name: payload.name,
      p_description: payload.description,
      p_status: payload.status,
      p_metadata: {},
    },
  );
  if (error) throw error;
  return String(data);
}

export async function updatePlatformPlan(
  plan: Pick<PlatformPlan, "id" | "name" | "description" | "status" | "metadata">,
) {
  const { error } = await (supabase as any).rpc(
    "update_platform_saas_plan_v1",
    {
      p_plan_id: plan.id,
      p_name: plan.name,
      p_description: plan.description,
      p_status: plan.status,
      p_metadata: plan.metadata ?? {},
    },
  );
  if (error) throw error;
}

export async function archivePlatformPlan(planId: string) {
  const { error } = await (supabase as any).rpc(
    "archive_platform_saas_plan_v1",
    { p_plan_id: planId },
  );
  if (error) throw error;
}

export async function upsertPlatformPlanEntitlement(payload: {
  planId: string;
  featureKey: string;
  enabled: boolean;
  limitValue: number | null;
}) {
  const { error } = await (supabase as any).rpc(
    "upsert_platform_plan_entitlement_v1",
    {
      p_plan_id: payload.planId,
      p_feature_key: payload.featureKey,
      p_enabled: payload.enabled,
      p_limit_value: payload.limitValue,
      p_metadata: {},
    },
  );
  if (error) throw error;
}

export async function deletePlatformPlanEntitlement(
  planId: string,
  featureKey: string,
) {
  const { error } = await (supabase as any).rpc(
    "delete_platform_plan_entitlement_v1",
    { p_plan_id: planId, p_feature_key: featureKey },
  );
  if (error) throw error;
}

export async function listPlatformOrganizationSubscriptions() {
  const { data, error } = await (supabase as any).rpc(
    "list_platform_organization_subscriptions_v1",
  );
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map(normalizeSubscription);
}

export async function setPlatformOrganizationSubscription(payload: {
  orgId: string;
  planId: string;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
}) {
  const { error } = await (supabase as any).rpc(
    "set_platform_organization_subscription_v1",
    {
      p_org_id: payload.orgId,
      p_plan_id: payload.planId,
      p_status: payload.status,
      p_trial_ends_at: payload.trialEndsAt,
      p_current_period_start: payload.currentPeriodStart,
      p_current_period_end: payload.currentPeriodEnd,
      p_source: "manual",
    },
  );
  if (error) throw error;
}

export async function upsertPlatformOrganizationOverride(payload: {
  orgId: string;
  featureKey: string;
  enabled: boolean | null;
  limitValue: number | null;
  reason: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
}) {
  const { error } = await (supabase as any).rpc(
    "upsert_platform_organization_entitlement_override_v2",
    {
      p_org_id: payload.orgId,
      p_feature_key: payload.featureKey,
      p_enabled: payload.enabled,
      p_limit_value: payload.limitValue,
      p_reason: payload.reason,
      p_starts_at: payload.startsAt ?? null,
      p_ends_at: payload.endsAt ?? null,
      p_source_type: "manual",
      p_source_id: null,
    },
  );
  if (error) throw error;
}

export async function deletePlatformOrganizationOverride(
  orgId: string,
  featureKey: string,
) {
  const { error } = await (supabase as any).rpc(
    "delete_platform_organization_entitlement_override_v1",
    { p_org_id: orgId, p_feature_key: featureKey },
  );
  if (error) throw error;
}

export { normalizePlan, normalizeOverride, normalizeSubscription, normalizeEntitlement };