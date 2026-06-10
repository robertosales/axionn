import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { OkrObjective, OkrFilters, OkrKeyResult, OkrStatus } from "../types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcObjectiveMeta(krs: OkrKeyResult[]): { progress: number; status: OkrStatus } {
  if (!krs.length) return { progress: 0, status: "off_track" };
  const progress = Math.round(
    krs.reduce((sum, kr) => {
      if (kr.unit === "bugs") return sum + (kr.current === 0 ? 100 : Math.max(0, 100 - kr.current * 20));
      if (kr.unit === "bool") return sum + (kr.current >= kr.target ? 100 : 0);
      if (kr.target === 0) return sum + 100;
      return sum + Math.min(100, Math.round((kr.current / kr.target) * 100));
    }, 0) / krs.length,
  );
  const status: OkrStatus =
    progress >= 100 ? "completed" :
    progress >= 70  ? "on_track"  :
    progress >= 40  ? "at_risk"   : "off_track";
  return { progress, status };
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

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

  if (objErr) {
    console.error("[OKR] Erro ao buscar objectives:", objErr);
    throw objErr;
  }

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
      status: (obj.status as OkrStatus) ?? status,
      progress: obj.progress ?? progress,
      key_results: krs,
      created_at: obj.created_at,
      updated_at: obj.updated_at,
    };
  });
}

// ---------------------------------------------------------------------------
// Hook principal
// ---------------------------------------------------------------------------

export interface UseOkrReturn {
  objectives: OkrObjective[];
  cycles: string[];
  filters: OkrFilters;
  setFilters: (f: Partial<OkrFilters>) => void;
  isLoading: boolean;
  isError: boolean;
  addCheckIn: (krId: string, value: number, note: string) => Promise<void>;
  addObjective: (obj: {
    title: string;
    description?: string;
    cycle: string;
    team_id: string;
    owner_id?: string;
  }) => Promise<void>;
  addKeyResult: (kr: {
    objective_id: string;
    title: string;
    unit: OkrKeyResult["unit"];
    target: number;
  }) => Promise<void>;
  updateObjective: (
    id: string,
    payload: Partial<Pick<OkrObjective, "title" | "description" | "status">>
  ) => Promise<void>;
  deleteObjective: (id: string) => Promise<void>;
}

export function useOkr(teamId?: string): UseOkrReturn {
  const queryClient = useQueryClient();
  const [filters, setFiltersState] = useState<OkrFilters>({
    cycle: "Q2/2026",
    teamId: teamId ?? "all",
  });

  const cycles = useMemo(() => {
    const year = new Date().getFullYear();
    return [`Q1/${year}`, `Q2/${year}`, `Q3/${year}`, `Q4/${year}`];
  }, []);

  const effectiveTeamId = filters.teamId !== "all" ? filters.teamId : (teamId ?? "all");
  const queryKey = ["okr_objectives", effectiveTeamId, filters.cycle];

  const { data: objectives = [], isLoading, isError } = useQuery<OkrObjective[]>({
    queryKey,
    queryFn: () => fetchObjectives(effectiveTeamId, filters.cycle),
    enabled: true,
    staleTime: 30_000,
  });

  // --- add check-in ---
  const checkInMutation = useMutation({
    mutationFn: async ({ krId, value, note }: { krId: string; value: number; note: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("okr_check_ins").insert({
        key_result_id: krId,
        value,
        note,
        author_id: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["okr_objectives"] }),
  });

  // --- add objective ---
  const addObjectiveMutation = useMutation({
    mutationFn: async (obj: {
      title: string;
      description?: string;
      cycle: string;
      team_id: string;
      owner_id?: string;
    }) => {
      let ownerId = obj.owner_id;
      if (!ownerId) {
        const { data: { user } } = await supabase.auth.getUser();
        ownerId = user?.id ?? undefined;
      }

      const payload = {
        title: obj.title,
        description: obj.description ?? null,
        cycle: obj.cycle,
        team_id: obj.team_id,
        owner_id: ownerId ?? null,
        status: "on_track",
        progress: 0,
      };

      console.log("[OKR] Inserindo objective:", payload);

      const { data, error } = await supabase
        .from("okr_objectives")
        .insert(payload)
        .select()
        .single();

      if (error) {
        console.error("[OKR] Erro no insert:", error);
        throw error;
      }

      console.log("[OKR] Objective inserido com sucesso:", data);
    },
    onSuccess: () => {
      console.log("[OKR] Invalidando queries após insert...");
      queryClient.invalidateQueries({ queryKey: ["okr_objectives"] });
    },
  });

  // --- add key result ---
  const addKeyResultMutation = useMutation({
    mutationFn: async (kr: {
      objective_id: string;
      title: string;
      unit: OkrKeyResult["unit"];
      target: number;
    }) => {
      const { error } = await supabase.from("okr_key_results").insert({
        objective_id: kr.objective_id,
        title: kr.title,
        unit: kr.unit,
        target: kr.target,
        current: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["okr_objectives"] }),
  });

  // --- update objective ---
  const updateObjectiveMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<Pick<OkrObjective, "title" | "description" | "status">>;
    }) => {
      const { error } = await supabase
        .from("okr_objectives")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["okr_objectives"] }),
  });

  // --- delete objective ---
  const deleteObjectiveMutation = useMutation({
    mutationFn: async (id: string) => {
      // Deleta check-ins → key results → objective (cascade via FK, mas explícito por segurança)
      const { data: krs } = await supabase
        .from("okr_key_results")
        .select("id")
        .eq("objective_id", id);

      const krIds = (krs ?? []).map((kr) => kr.id);

      if (krIds.length > 0) {
        const { error: ciErr } = await supabase
          .from("okr_check_ins")
          .delete()
          .in("key_result_id", krIds);
        if (ciErr) throw ciErr;

        const { error: krErr } = await supabase
          .from("okr_key_results")
          .delete()
          .eq("objective_id", id);
        if (krErr) throw krErr;
      }

      const { error } = await supabase
        .from("okr_objectives")
        .delete()
        .eq("id", id);

      if (error) throw error;

      console.log("[OKR] Objective excluído:", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["okr_objectives"] }),
  });

  function setFilters(partial: Partial<OkrFilters>) {
    setFiltersState((prev) => ({ ...prev, ...partial }));
  }

  return {
    objectives,
    cycles,
    filters,
    setFilters,
    isLoading,
    isError,
    addCheckIn: (krId, value, note) => checkInMutation.mutateAsync({ krId, value, note }),
    addObjective: (obj) => addObjectiveMutation.mutateAsync(obj),
    addKeyResult: (kr) => addKeyResultMutation.mutateAsync(kr),
    updateObjective: (id, payload) => updateObjectiveMutation.mutateAsync({ id, payload }),
    deleteObjective: (id) => deleteObjectiveMutation.mutateAsync(id),
  };
}
