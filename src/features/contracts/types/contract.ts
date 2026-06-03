// ============================================================
// Types: Módulo de Contratos & SLAs Dinâmicos
// ============================================================

export type ContractStatus = 'active' | 'paused' | 'terminated';
export type SLAPriority    = 'urgent' | 'high' | 'medium' | 'low';
export type TeamType       = 'agile' | 'sustenance';
export type RoomMode       = 'link_existing' | 'provision_new';

export interface Contract {
  id: string;
  name: string;
  description?: string | null;
  status: ContractStatus;
  starts_at?: string | null;
  ends_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  contract_slas?: ContractSla[];
}

export interface ContractSla {
  id: string;
  contract_id: string;
  priority: SLAPriority;
  response_time_minutes: number;
  resolution_time_minutes: number;
  business_hours_only: boolean;
  created_at: string;
  updated_at: string;
}

export interface ContractFormData {
  name: string;
  description?: string;
  status: ContractStatus;
  starts_at?: string;
  ends_at?: string;
}

export interface TeamConfig {
  mode: RoomMode;
  existingTeamId?: string;
  newTeamName?: string;
  teamType: TeamType;
}

export interface SlaStatusResult {
  elapsed_minutes: number;
  response_limit_minutes: number;
  resolution_limit_minutes: number;
  response_pct: number;
  resolution_pct: number;
  response_breached: boolean;
  resolution_breached: boolean;
  business_hours_only: boolean;
  sla_color: 'green' | 'yellow' | 'orange' | 'red';
}

export type SlaRow = Omit<ContractSla, 'id' | 'contract_id' | 'created_at' | 'updated_at'>;

export const DEFAULT_SLAS: SlaRow[] = [
  { priority: 'urgent', response_time_minutes: 15,  resolution_time_minutes: 120,  business_hours_only: false },
  { priority: 'high',   response_time_minutes: 45,  resolution_time_minutes: 240,  business_hours_only: true  },
  { priority: 'medium', response_time_minutes: 120, resolution_time_minutes: 480,  business_hours_only: true  },
  { priority: 'low',    response_time_minutes: 240, resolution_time_minutes: 960,  business_hours_only: true  },
];

export const PRIORITY_CONFIG: Record<SLAPriority, { label: string; color: string; bgColor: string }> = {
  urgent: { label: 'Urgente / Crítico', color: 'text-rose-400',   bgColor: 'bg-rose-500'   },
  high:   { label: 'Alta Prioridade',   color: 'text-orange-400', bgColor: 'bg-orange-500' },
  medium: { label: 'Média Prioridade',  color: 'text-amber-400',  bgColor: 'bg-amber-500'  },
  low:    { label: 'Baixa Prioridade',  color: 'text-slate-400',  bgColor: 'bg-slate-400'  },
};

export const CONTRACT_STATUS_CONFIG: Record<ContractStatus, { label: string; className: string }> = {
  active:     { label: 'Ativo',     className: 'bg-emerald-900/50 text-emerald-300 border-emerald-800' },
  paused:     { label: 'Pausado',   className: 'bg-amber-900/50 text-amber-300 border-amber-800'       },
  terminated: { label: 'Encerrado', className: 'bg-slate-800 text-slate-400 border-slate-700'          },
};
