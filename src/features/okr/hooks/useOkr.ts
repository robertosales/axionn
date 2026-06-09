import { useState, useMemo } from "react";
import type { OkrObjective, OkrFilters, OkrCheckIn, OkrStatus } from "../types";
import { MOCK_OBJECTIVES, MOCK_CYCLES } from "../types";

export interface UseOkrReturn {
  objectives: OkrObjective[];
  cycles: string[];
  filters: OkrFilters;
  setFilters: (f: Partial<OkrFilters>) => void;
  isLoading: boolean;
  addCheckIn: (krId: string, value: number, note: string) => void;
  addObjective: (obj: Omit<OkrObjective, "id" | "created_at" | "updated_at" | "progress" | "key_results">) => void;
  updateObjective: (id: string, payload: Partial<Omit<OkrObjective, "id" | "created_at" | "updated_at" | "progress" | "key_results">>) => void;
}

function calcObjectiveMeta(krs: OkrObjective["key_results"]) {
  const progress = Math.round(
    krs.reduce((sum, kr) => {
      if (kr.unit === "bugs") return sum + (kr.current === 0 ? 100 : Math.max(0, 100 - kr.current * 20));
      if (kr.unit === "bool") return sum + (kr.current >= kr.target ? 100 : 0);
      if (kr.target === 0) return sum + 100;
      return sum + Math.min(100, Math.round((kr.current / kr.target) * 100));
    }, 0) / Math.max(1, krs.length),
  );

  const status: OkrStatus =
    progress >= 100 ? "completed" :
    progress >= 70 ? "on_track" :
    progress >= 40 ? "at_risk" : "off_track";

  return { progress, status };
}

export function useOkr(): UseOkrReturn {
  const [filters, setFiltersState] = useState<OkrFilters>({ cycle: "Q2/2026", teamId: "all" });
  const [objectives, setObjectives] = useState<OkrObjective[]>(MOCK_OBJECTIVES);
  const isLoading = false;

  const filtered = useMemo(() => {
    return objectives.filter(
      (o) => o.cycle === filters.cycle && (filters.teamId === "all" || o.team_id === filters.teamId),
    );
  }, [objectives, filters]);

  function setFilters(partial: Partial<OkrFilters>) {
    setFiltersState((prev) => ({ ...prev, ...partial }));
  }

  function addCheckIn(krId: string, value: number, note: string) {
    const now = new Date().toISOString();
    const newCheckIn: OkrCheckIn = {
      id: crypto.randomUUID(),
      key_result_id: krId,
      value,
      note,
      author_id: "current-user",
      author_name: "Usuário Atual",
      created_at: now,
    };

    setObjectives((prev) =>
      prev.map((obj) => {
        const krs = obj.key_results.map((kr) => kr.id !== krId ? kr : {
          ...kr,
          current: value,
          updated_at: now,
          check_ins: [...(kr.check_ins ?? []), newCheckIn],
        });
        if (!krs.some((kr) => kr.id === krId)) return obj;
        const { progress, status } = calcObjectiveMeta(krs);
        return { ...obj, key_results: krs, progress, status, updated_at: now };
      }),
    );
  }

  function addObjective(obj: Omit<OkrObjective, "id" | "created_at" | "updated_at" | "progress" | "key_results">) {
    const now = new Date().toISOString();
    setObjectives((prev) => [
      {
        ...obj,
        id: crypto.randomUUID(),
        progress: 0,
        key_results: [],
        created_at: now,
        updated_at: now,
      },
      ...prev,
    ]);
  }

  function updateObjective(id: string, payload: Partial<Omit<OkrObjective, "id" | "created_at" | "updated_at" | "progress" | "key_results">>) {
    const now = new Date().toISOString();
    setObjectives((prev) =>
      prev.map((obj) => {
        if (obj.id !== id) return obj;
        const merged = { ...obj, ...payload, updated_at: now };
        const { progress, status } = calcObjectiveMeta(merged.key_results);
        return { ...merged, progress, status };
      }),
    );
  }

  return { objectives: filtered, cycles: MOCK_CYCLES, filters, setFilters, isLoading, addCheckIn, addObjective, updateObjective };
}
