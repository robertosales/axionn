export interface ProjectOption {
  id: string;
  name: string;
  contract_id: string | null;
}

export interface SprintOption {
  id: string;
  name: string;
  is_active: boolean;
  team_id: string;
}

export interface FunctionTypeOption {
  id: string;
  sigla: string;
  name: string;
  weight: number;
}

export interface ImpactFactorOption {
  id: string;
  sigla: string;
  name: string;
  contribution_pct: number;
  is_inm: boolean;
}

export interface ApfContext {
  project: { id: string; name: string; team_id: string; contract_id: string };
  model: { id: string; name: string; standard: string };
  baseline: { id: string; version: string; label: string | null; source_file_name: string | null };
  function_types: FunctionTypeOption[];
  impact_factors: ImpactFactorOption[];
  baseline_item_count: number;
}
