/**
 * PR 1 — Catálogo canônico de features OKR (frontend).
 *
 * A ordem/lista aqui é apenas para tipagem e listagem em UIs administrativas.
 * A **autoridade** é o backend (`get_okr_entitlement_matrix_v1`); nunca decida
 * enabled/limit a partir dessa constante.
 */

export const OKR_FEATURE_KEYS = [
  "okr.view",
  "okr.create",
  "okr.edit",
  "okr.archive",
  "okr.check_in",
  "okr.initiatives",
  "okr.automatic_metrics",
  "okr.history",
  "okr.export",
  "okr.ai_recommendations",
  "okr.alignments",
  "okr.cycle_management",
  "okr.executive_dashboard",
  "okr.advanced_alerts",
] as const;

export type OkrFeatureKey = (typeof OKR_FEATURE_KEYS)[number];

export interface OkrEntitlementRow {
  featureKey: OkrFeatureKey | string;
  enabled: boolean;
  /** `null` = ilimitado. */
  limitValue: number | null;
  source: "plan" | "addon" | "organization_override" | "missing" | string;
}

export interface OkrEntitlementResolution extends OkrEntitlementRow {
  /** `true` quando ainda não temos resposta do backend. */
  loading: boolean;
  /** `true` quando as RPCs canônicas não estão disponíveis (fallback local). */
  unavailable: boolean;
}

export function makeMissingResolution(
  featureKey: OkrFeatureKey | string,
): OkrEntitlementResolution {
  return {
    featureKey,
    enabled: false,
    limitValue: null,
    source: "missing",
    loading: false,
    unavailable: false,
  };
}

export function isWithinOkrLimit(
  currentCount: number,
  limitValue: number | null,
): boolean {
  if (limitValue == null) return true;
  return currentCount < limitValue;
}

export function remainingOkrLimit(
  currentCount: number,
  limitValue: number | null,
): number | null {
  if (limitValue == null) return null;
  return Math.max(limitValue - currentCount, 0);
}

/** Traduz mensagens de erro emitidas por `check_okr_limit_v1`. */
export function parseOkrLimitError(message: string | undefined): {
  kind: "disabled" | "limit_reached" | "unknown";
  featureKey?: string;
  limit?: number;
} {
  if (!message) return { kind: "unknown" };
  const disabled = /okr_entitlement_disabled:(.+)/.exec(message);
  if (disabled) return { kind: "disabled", featureKey: disabled[1] };
  const limit = /okr_entitlement_limit_reached:([^:]+):(\d+)/.exec(message);
  if (limit)
    return {
      kind: "limit_reached",
      featureKey: limit[1],
      limit: Number(limit[2]),
    };
  return { kind: "unknown" };
}