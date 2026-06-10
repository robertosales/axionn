// ---------------------------------------------------------------------------
// OKR Module — Types
// Todos os dados vêm do Supabase. Sem mocks neste arquivo.
// ---------------------------------------------------------------------------

export type OkrStatus = "on_track" | "at_risk" | "off_track" | "completed";

export type OkrUnit = "%" | "number" | "bool" | "bugs";

export interface OkrCheckIn {
  id: string;
  key_result_id: string;
  value: number;
  note: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

export interface OkrKeyResult {
  id: string;
  objective_id: string;
  title: string;
  unit: OkrUnit;
  target: number;
  current: number;
  created_at: string;
  updated_at: string;
  check_ins?: OkrCheckIn[];
}

export interface OkrObjective {
  id: string;
  team_id: string;
  owner_id: string;
  title: string;
  description: string;
  cycle: string;
  status: OkrStatus;
  progress: number; // 0–100, calculado pelo trigger fn_okr_recalc_objective_progress
  key_results: OkrKeyResult[];
  created_at: string;
  updated_at: string;
}

export interface OkrFilters {
  cycle: string;
  teamId: string;
}

// Mapa de cores por status — usado nos componentes
export const OKR_STATUS_CONFIG: Record<
  OkrStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  on_track:  { label: "No Prazo",   color: "text-emerald-600", bg: "bg-emerald-50",  dot: "bg-emerald-500"  },
  at_risk:   { label: "Em Risco",   color: "text-amber-600",   bg: "bg-amber-50",    dot: "bg-amber-500"    },
  off_track: { label: "Atrasado",   color: "text-red-600",     bg: "bg-red-50",      dot: "bg-red-500"      },
  completed: { label: "Concluído",  color: "text-blue-600",    bg: "bg-blue-50",     dot: "bg-blue-500"     },
};
