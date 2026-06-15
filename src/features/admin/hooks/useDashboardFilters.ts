import { useState, useCallback, useMemo } from "react";
import type { DashboardFilterValues } from "../components/DashboardFilters";

export type { DashboardFilterValues };

const DEFAULT_FILTERS: DashboardFilterValues = {
  period:  "sprint-atual",
  teamId:  "all",
  module:  "todos",
};

export function useDashboardFilters() {
  const [pendingFilters, setPendingFilters] =
    useState<DashboardFilterValues>(DEFAULT_FILTERS);

  // Committed = aplicados na tela
  const [appliedFilters, setAppliedFilters] =
    useState<DashboardFilterValues>(DEFAULT_FILTERS);

  const handleChange = useCallback((f: DashboardFilterValues) => {
    setPendingFilters(f);
  }, []);

  const handleApply = useCallback(() => {
    setAppliedFilters(pendingFilters);
  }, [pendingFilters]);

  const resetFilters = useCallback(() => {
    setPendingFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  }, []);

  /**
   * Derived helpers for downstream consumers.
   * When teamId === 'all', teamIds is an empty array (= no restriction).
   */
  const appliedTeamId = appliedFilters.teamId;
  const appliedModule  = appliedFilters.module;
  const appliedPeriod  = appliedFilters.period;

  return {
    pendingFilters,
    appliedFilters,
    appliedTeamId,
    appliedModule,
    appliedPeriod,
    handleChange,
    handleApply,
    resetFilters,
  };
}
