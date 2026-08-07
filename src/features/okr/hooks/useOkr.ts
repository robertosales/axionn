import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type {
  OkrCheckInInput,
  OkrObjective,
  OkrObjectiveInput,
  OkrFilters,
  OkrKeyResult,
  OkrStatus,
} from "../types";
import { useOrganizationEntitlements } from "@/hooks/useOrganizationEntitlements";
import {
  ENTITLEMENT_KEYS,
  hasEnabledEntitlement,
  type EffectiveOrganizationEntitlement,
} from "@/saas/entitlements";

async function fetchObjectives(teamId: string, cycle: string): Promise<OkrObjective[]> {
  let query = supabase
    .from("okr_objectives")
    .select("*")
    .eq("cycle", cycle)
    .neq("lifecycle_status", "archived")
    .order("created_at", { ascending: true });

  if (teamId && teamId !== "all") {
    query = query.eq("team_id", teamId);
  }

  const { data: objectives, error: objErr } = await query;
  if (objErr) { console.error("[OKR] Erro ao buscar objectives:", objErr); throw objErr; }
  console.log(`[OKR] fetchObjectives — cycle=${cycle} teamId=${teamId} — ${objectives?.length ?? 0} registro(s)`);
  if (!objectives || objectives.length === 0) return [];

  const objectiveIds = objectives.map((o) => o.id);
  const { data: keyResults, error: krErr } = await supabase
    .from("okr_key_results")
    .select("*")
    .in("objective_id", objectiveIds)
    .neq("lifecycle_status", "archived")
    .order("created_at", { ascending: true });
  if (krErr) throw krErr;

  const krIds = (keyResults ?? []).map((kr) => kr.id);
  let checkIns: any[] = [];
  if (krIds.length > 0) {
    const { data: ci, error: ciErr } = await supabase
      .from("okr_check_ins")
      .select("*")
      .in("key_result_id", krIds)
      .order("created_at", { ascending: true });
    if (ciErr) throw ciErr;
    checkIns = ci ?? [];
  }

  return objectives.map((obj) => {
    const krs: OkrKeyResult[] = (keyResults ?? [])
      .filter((kr) => kr.objective_id === obj.id)
      .map((kr) => ({
        ...kr,
        check_ins: checkIns
          .filter((ci) => ci.key_result_id === kr.id)
          .map((ci) => ({
            id: ci.id,
            key_result_id: ci.key_result_id,
            value: ci.value,
            note: ci.note ?? "",
            author_id: ci.author_id ?? "",
            author_name: "",
            created_at: ci.created_at,
          })),
      }));
    const progress = Math.round(Number((obj as any).calculated_progress ?? obj.progress ?? 0));
    const status = (obj.status as OkrStatus) ?? "off_track";
    return {
      id: obj.id,
      team_id: obj.team_id,
      owner_id: obj.owner_id ?? "",
      title: obj.title,
      description: obj.description ?? "",
      cycle: obj.cycle,
      status: (((obj as any).manual_health_override === "attention" || (obj as any).manual_health_override === "at_risk") ? "at_risk" : (obj as any).manual_health_override === "no_data" ? status : (obj as any).manual_health_override) ?? (((obj as any).calculated_health === "attention" || (obj as any).calculated_health === "at_risk") ? "at_risk" : (obj as any).calculated_health === "no_data" ? status : (obj as any).calculated_health) ?? (obj.status as OkrStatus) ?? status,
      progress: (obj as any).calculated_progress ?? progress,
      calculated_progress: (obj as any).calculated_progress ?? null,
      calculated_health: (obj as any).calculated_health ?? "no_data",
      health_reason: (obj as any).health_reason ?? null,
      manual_health_override: (obj as any).manual_health_override ?? null,
      health_override_reason: (obj as any).health_override_reason ?? null,
      lifecycle_status: (obj as any).lifecycle_status ?? "active",
      start_date: (obj as any).start_date ?? null,
      end_date: (obj as any).end_date ?? null,
      last_calculated_at: (obj as any).last_calculated_at ?? null,
      measurement_status: (obj as any).measurement_status ?? "needs_configuration",
      legacy_progress: (obj as any).legacy_progress ?? obj.progress,
      key_results: krs,
      created_at: obj.created_at,
      updated_at: obj.updated_at,
    };
  });
}

export interface UseOkrReturn {
  objectives: OkrObjective[];
  cycles: string[];
  filters: OkrFilters;
  setFilters: (f: Partial<OkrFilters>) => void;
  isLoading: boolean;
  isError: boolean;
  // Entitlements flags for UI
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canArchive: boolean;
  canCheckIn: boolean;
  canInitiatives: boolean;
  canAutoMetrics: boolean;
  canHistory: boolean;
  canExport: boolean;
  canAiRecommendations: boolean;
  addCheckIn: (krId: string, input: OkrCheckInInput) => Promise<void>;
  refreshKeyResult: (krId: string) => Promise<void>;
  addObjective: (obj: OkrObjectiveInput) => Promise<void>;
  addKeyResult: (kr: {
    objective_id: string;
    title: string;
    unit: OkrKeyResult["unit"];
    baseline: number;
    target: number;
    direction: OkrKeyResult["direction"];
    update_type: OkrKeyResult["update_type"];
    metric_code?: string | null;
  }) => Promise<void>;
  updateKeyResult: (
    id: string,
    payload: { title?: string; unit?: OkrKeyResult["unit"]; target?: number },
  ) => Promise<void>;
  deleteKeyResult: (id: string) => Promise<void>;
  updateObjective: (id: string, payload: OkrObjectiveInput) => Promise<void>;
  deleteObjective: (id: string) => Promise<void>;
}

export class OkrDuplicateError extends Error {}

async function rejectLegacyMutation(): Promise<never> {
  throw new Error(
    "O fluxo legado de OKR é somente leitura. Use o OKR V2 para alterações.",
  );
}

export function useOkr(teamId?: string): UseOkrReturn {
  const [filters, setFiltersState] = useState<OkrFilters>({
    cycle: `Q${Math.ceil((new Date().getMonth() + 1) / 3)}/${new Date().getFullYear()}`,
    teamId: teamId ?? "all",
  });

  const cycles = useMemo(() => {
    const year = new Date().getFullYear();
    return [`Q1/${year}`, `Q2/${year}`, `Q3/${year}`, `Q4/${year}`];
  }, []);

  const effectiveTeamId = filters.teamId !== "all" ? filters.teamId : (teamId ?? "all");
  const queryKey = ["okr_objectives", effectiveTeamId, filters.cycle];

  // Entitlements da organização atual
  const { entitlements: okrEntitlements, loading: entitlementsLoading } = useOrganizationEntitlements();

  // Helpers de verificação de entitlement OKR
  const canView = useMemo(() => hasEnabledEntitlement(okrEntitlements, ENTITLEMENT_KEYS.OKR_VIEW), [okrEntitlements]);
  // O fluxo legado é deliberadamente read-only. Mutações existem apenas no V2.
  const canCreate = false;
  const canEdit = false;
  const canArchive = false;
  const canCheckIn = false;
  const canInitiatives = useMemo(() => hasEnabledEntitlement(okrEntitlements, ENTITLEMENT_KEYS.OKR_INITIATIVES), [okrEntitlements]);
  const canAutoMetrics = false;
  const canHistory = useMemo(() => hasEnabledEntitlement(okrEntitlements, ENTITLEMENT_KEYS.OKR_HISTORY), [okrEntitlements]);
  const canExport = useMemo(() => hasEnabledEntitlement(okrEntitlements, ENTITLEMENT_KEYS.OKR_EXPORT), [okrEntitlements]);
  const canAiRecommendations = useMemo(() => hasEnabledEntitlement(okrEntitlements, ENTITLEMENT_KEYS.OKR_AI_RECOMMENDATIONS), [okrEntitlements]);

  const { data: objectives = [], isLoading, isError } = useQuery<OkrObjective[]>({
    queryKey,
    queryFn: () => fetchObjectives(effectiveTeamId, filters.cycle),
    enabled: true,
    staleTime: 30_000,
  });

  function setFilters(partial: Partial<OkrFilters>) {
    setFiltersState((prev) => ({ ...prev, ...partial }));
  }

  return {
    objectives, cycles, filters, setFilters, isLoading: isLoading || entitlementsLoading, isError,
    // Entitlements flags for UI
    canView,
    canCreate,
    canEdit,
    canArchive,
    canCheckIn,
    canInitiatives,
    canAutoMetrics,
    canHistory,
    canExport,
    canAiRecommendations,
    addCheckIn: rejectLegacyMutation,
    refreshKeyResult: rejectLegacyMutation,
    addObjective: rejectLegacyMutation,
    addKeyResult: rejectLegacyMutation,
    updateKeyResult: rejectLegacyMutation,
    deleteKeyResult: rejectLegacyMutation,
    updateObjective: rejectLegacyMutation,
    deleteObjective: rejectLegacyMutation,
  };
}
