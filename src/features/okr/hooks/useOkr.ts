import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { OkrCheckInInput, OkrObjective, OkrObjectiveInput, OkrFilters, OkrKeyResult, OkrStatus } from "../types";
import { calculateKrProgress, calculateObjectiveProgress } from "../domain/okrCalculations";
import { measureAutomaticKeyResult, recordManualOkrMeasurement } from "../services/okrMeasurement.service";
import { getOkrMetric } from "../domain/metricCatalog";
import { useOrganizationEntitlements } from "@/hooks/useOrganizationEntitlements";
import {
  ENTITLEMENT_KEYS,
  hasEnabledEntitlement,
  type EffectiveOrganizationEntitlement,
} from "@/saas/entitlements";

function calcObjectiveMeta(krs: OkrKeyResult[]): { progress: number; status: OkrStatus } {
  if (!krs.length) return { progress: 0, status: "off_track" };
  const result = calculateObjectiveProgress(krs.map((kr) => {
    const calculated = kr.calculated_progress ?? calculateKrProgress({
      baseline: kr.baseline_value ?? null,
      current: kr.current_value ?? kr.current,
      target: kr.target_value ?? kr.target,
      targetMin: kr.target_min,
      targetMax: kr.target_max,
      direction: kr.direction ?? "increase",
    }).progress;
    return { progress: calculated, weight: kr.weight };
  }));
  const progress = Math.round(result.progress ?? 0);
  const status: OkrStatus =
    progress >= 100 ? "completed" :
    progress >= 70  ? "on_track"  :
    progress >= 40  ? "at_risk"   : "off_track";
  return { progress, status };
}

async function fetchObjectives(teamId: string, cycle: string): Promise<OkrObjective[]> {
  let query = supabase
    .from("okr_objectives")
    .select("*")
    .eq("cycle", cycle)
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
    const { progress, status } = calcObjectiveMeta(krs);
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

export class OkrDuplicateError extends Error {
  constructor() {
    super("Já existe um objetivo com este título para este time e ciclo.");
    this.name = "OkrDuplicateError";
  }
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
  // Actions
  addCheckIn: (krId: string, input: OkrCheckInInput) => Promise<void>;
  refreshKeyResult: (krId: string) => Promise<void>;
  addObjective: (obj: OkrObjectiveInput) => Promise<void>;
  addKeyResult: (kr: { objective_id: string; title: string; unit: OkrKeyResult["unit"]; baseline: number; target: number; direction: OkrKeyResult["direction"]; update_type: OkrKeyResult["update_type"]; metric_code?: string | null }) => Promise<void>;
  updateKeyResult: (id: string, payload: { title?: string; unit?: OkrKeyResult["unit"]; target?: number }) => Promise<void>;
  deleteKeyResult: (id: string) => Promise<void>;
  updateObjective: (id: string, payload: OkrObjectiveInput) => Promise<void>;
  deleteObjective: (id: string) => Promise<void>;
}

export function useOkr(teamId?: string): UseOkrReturn {
  const queryClient = useQueryClient();
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
  const canCreate = useMemo(() => hasEnabledEntitlement(okrEntitlements, ENTITLEMENT_KEYS.OKR_CREATE), [okrEntitlements]);
  const canEdit = useMemo(() => hasEnabledEntitlement(okrEntitlements, ENTITLEMENT_KEYS.OKR_EDIT), [okrEntitlements]);
  const canArchive = useMemo(() => hasEnabledEntitlement(okrEntitlements, ENTITLEMENT_KEYS.OKR_ARCHIVE), [okrEntitlements]);
  const canCheckIn = useMemo(() => hasEnabledEntitlement(okrEntitlements, ENTITLEMENT_KEYS.OKR_CHECK_IN), [okrEntitlements]);
  const canInitiatives = useMemo(() => hasEnabledEntitlement(okrEntitlements, ENTITLEMENT_KEYS.OKR_INITIATIVES), [okrEntitlements]);
  const canAutoMetrics = useMemo(() => hasEnabledEntitlement(okrEntitlements, ENTITLEMENT_KEYS.OKR_AUTOMATIC_METRICS), [okrEntitlements]);
  const canHistory = useMemo(() => hasEnabledEntitlement(okrEntitlements, ENTITLEMENT_KEYS.OKR_HISTORY), [okrEntitlements]);
  const canExport = useMemo(() => hasEnabledEntitlement(okrEntitlements, ENTITLEMENT_KEYS.OKR_EXPORT), [okrEntitlements]);
  const canAiRecommendations = useMemo(() => hasEnabledEntitlement(okrEntitlements, ENTITLEMENT_KEYS.OKR_AI_RECOMMENDATIONS), [okrEntitlements]);

  function assertEntitlement(can: boolean, featureName: string) {
    if (!can) {
      throw new Error(`Entitlement negado: ${featureName} não incluído no plano atual.`);
    }
  }

  const { data: objectives = [], isLoading, isError } = useQuery<OkrObjective[]>({
    queryKey,
    queryFn: () => fetchObjectives(effectiveTeamId, filters.cycle),
    enabled: true,
    staleTime: 30_000,
  });

  const checkInMutation = useMutation({
    mutationFn: async ({ krId, input }: { krId: string; input: OkrCheckInInput }) => {
      assertEntitlement(canCheckIn, "okr.check_in");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      await recordManualOkrMeasurement({ keyResultId: krId, input, authorId: user.id });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["okr_objectives"] }),
  });

  const refreshKeyResultMutation = useMutation({
    mutationFn: async (krId: string) => {
      assertEntitlement(canAutoMetrics, "okr.automatic_metrics");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      await measureAutomaticKeyResult(krId, user.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["okr_objectives"] }),
  });

  const addObjectiveMutation = useMutation({
    mutationFn: async (obj: OkrObjectiveInput) => {
      assertEntitlement(canCreate, "okr.create");
      // Validação defensiva: team_id deve ser um UUID válido
      if (!obj.team_id || obj.team_id === "all" || obj.team_id.trim() === "") {
        throw new Error("Selecione um time válido antes de criar o objetivo.");
      }

      const { data: existing, error: checkErr } = await supabase
        .from("okr_objectives").select("id").eq("team_id", obj.team_id).eq("cycle", obj.cycle).ilike("title", obj.title.trim()).maybeSingle();
      if (checkErr) throw checkErr;
      if (existing) { console.warn("[OKR] Duplicidade detectada:", existing); throw new OkrDuplicateError(); }

      let ownerId: string | null = obj.owner_id ?? null;
      if (!ownerId) {
        const { data: { user } } = await supabase.auth.getUser();
        ownerId = user?.id ?? null;
      }

      const payload = {
        title: obj.title.trim(),
        description: obj.description ?? null,
        cycle: obj.cycle,
        team_id: obj.team_id,
        owner_id: ownerId,   // sempre null ou UUID válido, nunca undefined
        created_by: ownerId,
        lifecycle_status: obj.lifecycle_status ?? "active",
        start_date: obj.start_date || null,
        end_date: obj.end_date || null,
        status: "on_track",
        progress: 0,
      };
      console.log("[OKR] Inserindo objective:", payload);
      const { data, error } = await supabase.from("okr_objectives").insert(payload).select().single();
      if (error) { console.error("[OKR] Erro no insert:", error); throw error; }
      console.log("[OKR] Objective inserido com sucesso:", data);
      return data;
    },
    onSuccess: () => { console.log("[OKR] Invalidando queries após insert..."); queryClient.invalidateQueries({ queryKey: ["okr_objectives"] }); },
  });

  const addKeyResultMutation = useMutation({
    mutationFn: async (kr: { objective_id: string; title: string; unit: OkrKeyResult["unit"]; baseline: number; target: number; direction: OkrKeyResult["direction"]; update_type: OkrKeyResult["update_type"]; metric_code?: string | null }) => {
      assertEntitlement(canCreate, "okr.create");
      const metric = kr.metric_code ? getOkrMetric(kr.metric_code) : null;
      const { error } = await supabase.from("okr_key_results").insert({
        objective_id: kr.objective_id, title: kr.title, unit: kr.unit,
        target: kr.target, current: kr.baseline, baseline_value: kr.baseline,
        current_value: kr.baseline, target_value: kr.target,
        direction: kr.direction ?? "increase", update_type: kr.update_type ?? "manual",
        metric_code: kr.metric_code ?? null, source_label: metric?.name ?? "Check-in manual",
        formula_version: metric?.formulaVersion ?? "1.0", measurement_quality: "partial",
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["okr_objectives"] }),
  });

  const updateKeyResultMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: { title?: string; unit?: OkrKeyResult["unit"]; target?: number } }) => {
      assertEntitlement(canEdit, "okr.edit");
      const { error } = await supabase.from("okr_key_results").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["okr_objectives"] }),
  });

  const deleteKeyResultMutation = useMutation({
    mutationFn: async (id: string) => {
      assertEntitlement(canEdit, "okr.edit");
      const { error: ciErr } = await supabase.from("okr_check_ins").delete().eq("key_result_id", id);
      if (ciErr) throw ciErr;
      const { error } = await supabase.from("okr_key_results").delete().eq("id", id);
      if (error) throw error;
      console.log("[OKR] KR excluído:", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["okr_objectives"] }),
  });

  const updateObjectiveMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: OkrObjectiveInput }) => {
      assertEntitlement(canEdit, "okr.edit");
      if (payload.title) {
        const { data: existing } = await supabase.from("okr_objectives").select("id, team_id, cycle").neq("id", id).ilike("title", payload.title.trim()).maybeSingle();
        const { data: current } = await supabase.from("okr_objectives").select("team_id, cycle").eq("id", id).single();
        if (existing && current && existing.team_id === current.team_id && existing.cycle === current.cycle) throw new OkrDuplicateError();
      }
      if (payload.start_date && payload.end_date && payload.end_date < payload.start_date) throw new Error("A data final deve ser posterior à data inicial.");
      if (payload.manual_health_override && !payload.health_override_reason?.trim()) throw new Error("Informe a justificativa para o override de saúde.");
      const { error } = await supabase.from("okr_objectives").update({
        title: payload.title.trim(), description: payload.description ?? null, cycle: payload.cycle,
        team_id: payload.team_id, owner_id: payload.owner_id ?? null,
        lifecycle_status: payload.lifecycle_status ?? "active",
        start_date: payload.start_date || null, end_date: payload.end_date || null,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      const { error: overrideError } = await (supabase as any).rpc("set_okr_health_override", {
        p_objective_id: id,
        p_health: payload.manual_health_override ?? null,
        p_reason: payload.health_override_reason?.trim() || null,
      });
      if (overrideError) throw overrideError;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["okr_objectives"] }),
  });

  const deleteObjectiveMutation = useMutation({
    mutationFn: async (id: string) => {
      assertEntitlement(canArchive, "okr.archive");
      const { data: krs } = await supabase.from("okr_key_results").select("id").eq("objective_id", id);
      const krIds = (krs ?? []).map((kr) => kr.id);
      if (krIds.length > 0) {
        const { error: ciErr } = await supabase.from("okr_check_ins").delete().in("key_result_id", krIds);
        if (ciErr) throw ciErr;
        const { error: krErr } = await supabase.from("okr_key_results").delete().eq("objective_id", id);
        if (krErr) throw krErr;
      }
      const { error } = await supabase.from("okr_objectives").delete().eq("id", id);
      if (error) throw error;
      console.log("[OKR] Objective excluído:", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["okr_objectives"] }),
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
    // Actions
    addCheckIn: (krId, input) => checkInMutation.mutateAsync({ krId, input }),
    refreshKeyResult: (krId) => refreshKeyResultMutation.mutateAsync(krId),
    addObjective: (obj) => addObjectiveMutation.mutateAsync(obj),
    addKeyResult: (kr) => addKeyResultMutation.mutateAsync(kr),
    updateKeyResult: (id, payload) => updateKeyResultMutation.mutateAsync({ id, payload }),
    deleteKeyResult: (id) => deleteKeyResultMutation.mutateAsync(id),
    updateObjective: (id, payload) => updateObjectiveMutation.mutateAsync({ id, payload }),
    deleteObjective: (id) => deleteObjectiveMutation.mutateAsync(id),
  };
}