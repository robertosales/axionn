// ---------------------------------------------------------------------------
// OKR Types
// ---------------------------------------------------------------------------

export type OkrStatus = "on_track" | "at_risk" | "off_track" | "completed";

// Valores aceitos pelo CHECK constraint da tabela okr_key_results
export type OkrKeyResultUnit = "%" | "pts" | "bugs" | "score" | "dias" | "bool" | "R$" | "un";

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
  unit: OkrKeyResultUnit;
  target: number;
  current: number;
  check_ins: OkrCheckIn[];
  created_at: string;
  updated_at?: string;
}

export interface OkrObjective {
  id: string;
  team_id: string;
  team_name?: string;
  owner_id: string;
  owner_name?: string;
  title: string;
  description: string;
  cycle: string;
  status: OkrStatus;
  progress: number;
  key_results: OkrKeyResult[];
  created_at: string;
  updated_at?: string;
}

export interface OkrFilters {
  cycle: string;
  teamId: string;
}
