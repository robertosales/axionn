export type OkrInitiativeStatus =
  | "planned"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled"
  | "archived";

export type OkrInitiativePriority = "low" | "medium" | "high" | "critical";

export const OKR_INITIATIVE_STATUS_LABEL: Record<OkrInitiativeStatus, string> = {
  planned: "Planejada",
  in_progress: "Em andamento",
  blocked: "Bloqueada",
  completed: "Concluída",
  cancelled: "Cancelada",
  archived: "Arquivada",
};

export const OKR_INITIATIVE_PRIORITY_LABEL: Record<OkrInitiativePriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

export interface OkrInitiativeV2 {
  id: string;
  organization_id: string | null;
  objective_id: string;
  key_result_id: string | null;
  title: string;
  description: string | null;
  owner_id: string | null;
  status: OkrInitiativeStatus;
  priority: OkrInitiativePriority;
  progress: number;
  start_date: string | null;
  due_date: string | null;
  blocked_reason: string | null;
  cancelled_reason: string | null;
  linked_entity_type: string | null;
  linked_entity_id: string | null;
  linked_entity_module: string | null;
  version: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface OkrInitiativeV2Input {
  title: string;
  description?: string | null;
  key_result_id?: string | null;
  owner_id?: string | null;
  status?: OkrInitiativeStatus;
  priority?: OkrInitiativePriority;
  progress?: number;
  start_date?: string | null;
  due_date?: string | null;
}

export interface OkrInitiativeV2Update extends Partial<OkrInitiativeV2Input> {
  blocked_reason?: string | null;
  cancelled_reason?: string | null;
}