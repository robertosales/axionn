// ============================================================
// Types — Contracts
// HU-001: room_mode, room_type, contrato híbrido
// ============================================================

export type ContractStatus = 'active' | 'paused' | 'terminated';
export type RoomMode       = 'agil' | 'sustentacao' | 'hibrido';
export type RoomType       = 'agil' | 'sustentacao';
export type SLAPriority    = 'urgent' | 'high' | 'medium' | 'low';

export const CONTRACT_STATUS_CONFIG: Record<ContractStatus, { label: string; className: string }> = {
  active:     { label: 'Ativo',      className: 'bg-green-950  text-green-400  border-green-800'  },
  paused:     { label: 'Pausado',    className: 'bg-yellow-950 text-yellow-400 border-yellow-800' },
  terminated: { label: 'Encerrado', className: 'bg-red-950    text-red-400    border-red-800'    },
};

export const ROOM_MODE_CONFIG: Record<RoomMode, { label: string; icon: string; className: string; hasSLA: boolean }> = {
  agil:        { label: 'Sala Ágil',              icon: '⚡', className: 'bg-blue-950   text-blue-300   border-blue-800',   hasSLA: false },
  sustentacao: { label: 'Sala de Sustentação',    icon: '🛠',  className: 'bg-purple-950 text-purple-300 border-purple-800', hasSLA: true  },
  hibrido:     { label: 'Ágil + Sustentação',     icon: '🔀', className: 'bg-orange-950 text-orange-300 border-orange-800', hasSLA: true  },
};

export const PRIORITY_CONFIG: Record<SLAPriority, { label: string; bgColor: string; textColor: string }> = {
  urgent: { label: 'Urgente / Crítico', bgColor: 'bg-red-500',    textColor: 'text-red-400'    },
  high:   { label: 'Alta Prioridade',   bgColor: 'bg-orange-500', textColor: 'text-orange-400' },
  medium: { label: 'Média Prioridade',  bgColor: 'bg-yellow-500', textColor: 'text-yellow-400' },
  low:    { label: 'Baixa Prioridade',  bgColor: 'bg-green-500',  textColor: 'text-green-400'  },
};

export interface SlaRow {
  priority:                 SLAPriority;
  response_time_minutes:    number;
  resolution_time_minutes:  number;
  business_hours_only:      boolean;
}

export interface ContractFormData {
  name:        string;
  description: string;
  status:      ContractStatus;
  room_mode:   RoomMode;   // RN02
  starts_at:   string;
  ends_at:     string;
}

export const DEFAULT_SLAS: SlaRow[] = [
  { priority: 'urgent', response_time_minutes: 15,  resolution_time_minutes: 120,  business_hours_only: false },
  { priority: 'high',   response_time_minutes: 45,  resolution_time_minutes: 240,  business_hours_only: true  },
  { priority: 'medium', response_time_minutes: 120, resolution_time_minutes: 480,  business_hours_only: true  },
  { priority: 'low',    response_time_minutes: 240, resolution_time_minutes: 960,  business_hours_only: true  },
];

// Tipos para contract_room_teams (RN04)
export interface ContractRoomTeam {
  id:          string;
  contract_id: string;
  team_id:     string;
  room_type:   RoomType;
  created_at:  string;
  // joins
  team_name?:  string;
  team_module?: string;
}

// ── Compat aliases / shapes usados por hooks legados ────────────────────────

export interface Contract {
  id:          string;
  name:        string;
  description: string | null;
  status:      ContractStatus;
  room_mode?:  RoomMode;
  starts_at:   string | null;
  ends_at:     string | null;
  created_at?: string;
  updated_at?: string;
  contract_slas?: ContractSla[];
}

export interface ContractSla extends SlaRow {
  id?:           string;
  contract_id?:  string;
  sla_type?:     'business_hours' | 'continuous' | '24x7' | 'custom';
}

export interface SlaStatusResult {
  status:                   string;
  sla_color:                'green' | 'yellow' | 'orange' | 'red' | 'none';
  elapsed_minutes:          number;
  response_pct:             number;
  resolution_pct:           number;
  response_breached:        boolean;
  resolution_breached:      boolean;
  business_hours_only:      boolean;
  response_limit_minutes:   number;
  resolution_limit_minutes: number;
}

export interface TeamConfig {
  mode:            'link_existing' | 'provision_new';
  existingTeamId?: string;
  newTeamName?:    string;
}
