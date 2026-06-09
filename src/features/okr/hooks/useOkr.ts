// ─── Hook useOkr ─────────────────────────────────────────────────────────────
// Atualmente retorna dados mockados.
// Na integração real: substituir MOCK_OBJECTIVES por queries ao Supabase.
// Tabelas necessárias: okr_objectives, okr_key_results, okr_check_ins

import { useState, useMemo } from "react";
import type { OkrObjective, OkrFilters, OkrCheckIn } from "../types";
import { MOCK_OBJECTIVES, MOCK_CYCLES } from "../types";

export interface UseOkrReturn {
  objectives:   OkrObjective[];
  cycles:       string[];
  filters:      OkrFilters;
  setFilters:   (f: Partial<OkrFilters>) => void;
  isLoading:    boolean;
  // Mutations (mock — sem efeito real ainda)
  addCheckIn:   (krId: string, value: number, note: string) => void;
  addObjective: (obj: Omit<OkrObjective, "id" | "created_at" | "updated_at" | "progress" | "key_results">) => void;
}

export function useOkr(): UseOkrReturn {
  const [filters, setFiltersState] = useState<OkrFilters>({
    cycle:  "Q2/2026",
    teamId: "all",
  });

  // TODO: substituir por useQuery do Supabase
  const [objectives, setObjectives] = useState<OkrObjective[]>(MOCK_OBJECTIVES);
  const isLoading = false;

  const filtered = useMemo(() => {
    return objectives.filter(
      (o) =>
        o.cycle === filters.cycle &&
        (filters.teamId === "all" || o.team_id === filters.teamId),
    );
  }, [objectives, filters]);

  function setFilters(partial: Partial<OkrFilters>) {
    setFiltersState((prev) => ({ ...prev, ...partial }));
  }

  // Mock: adiciona check-in ao KR e recalcula progresso do objetivo
  function addCheckIn(krId: string, value: number, note: string) {
    const now = new Date().toISOString();
    const newCheckIn: OkrCheckIn = {
      id:            crypto.randomUUID(),
      key_result_id: krId,
      value,
      note,
      author_id:    "current-user",
      author_name:  "Usuário Atual",
      created_at:   now,
    };

    setObjectives((prev) =>
      prev.map((obj) => {
        const krs = obj.key_results.map((kr) => {
          if (kr.id !== krId) return kr;
          return {
            ...kr,
            current:    value,
            updated_at: now,
            check_ins:  [...(kr.check_ins ?? []), newCheckIn],
          };
        });
        // Recalcula progresso geral do objetivo
        const progress = Math.round(
          krs.reduce((sum, kr) => {
            if (kr.unit === "bugs")  return sum + (kr.current === 0 ? 100 : Math.max(0, 100 - kr.current * 20));
            if (kr.unit === "bool")  return sum + (kr.current >= kr.target ? 100 : 0);
            if (kr.target === 0)    return sum + 100;
            return sum + Math.min(100, Math.round((kr.current / kr.target) * 100));
          }, 0) / krs.length,
        );
        const status =
          progress >= 100 ? "completed" :
          progress >= 70  ? "on_track"  :
          progress >= 40  ? "at_risk"   : "off_track";
        return { ...obj, key_results: krs, progress, status, updated_at: now };
      }),
    );
  }

  // Mock: adiciona novo objetivo
  function addObjective(obj: Omit<OkrObjective, "id" | "created_at" | "updated_at" | "progress" | "key_results">) {
    const now = new Date().toISOString();
    setObjectives((prev) => [
      ...prev,
      { ...obj, id: crypto.randomUUID(), progress: 0, key_results: [], created_at: now, updated_at: now },
    ]);
  }

  return { objectives: filtered, cycles: MOCK_CYCLES, filters, setFilters, isLoading, addCheckIn, addObjective };
}
