// ─── Barrel export do módulo OKR ─────────────────────────────────────────────
export { OkrPage }            from "./OkrPage";
export { useOkr }             from "./hooks/useOkr";
export { OkrObjectiveCard }   from "./components/OkrObjectiveCard";
export { OkrKeyResultRow }    from "./components/OkrKeyResultRow";
export { OkrCheckInModal }    from "./components/OkrCheckInModal";
export { OkrCycleSelector }   from "./components/OkrCycleSelector";
export { OkrSummaryKpis }     from "./components/OkrSummaryKpis";
export type {
  OkrObjective,
  OkrKeyResult,
  OkrCheckIn,
  OkrStatus,
  OkrUnit,
  OkrFilters,
} from "./types";
