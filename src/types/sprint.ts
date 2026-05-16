// src/types/sprint.ts

// ── Tamanho / Story Points ────────────────────────────────────────────────────

export const SIZE_REFERENCES = ["PP", "P", "M", "G", "GG"] as const;
export type SizeReference = (typeof SIZE_REFERENCES)[number];

// ── Prioridade ────────────────────────────────────────────────────────────────

export const PRIORITY_OPTIONS = ["baixa", "media", "alta", "critica"] as const;
export type Priority = (typeof PRIORITY_OPTIONS)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

// ── Activity Types ────────────────────────────────────────────────────────────

export const ACTIVITY_TYPES = [
  "task",
  "bug",
  "architecture",
  "test",
  "meeting",
  "documentation",
  "review",
  "other",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, { label: string; color: string }> = {
  task: { label: "Tarefa", color: "#6366f1" },
  bug: { label: "Bug", color: "#ef4444" },
  architecture: { label: "Arquitetura", color: "#8b5cf6" },
  test: { label: "Teste", color: "#f59e0b" },
  meeting: { label: "Reunião", color: "#06b6d4" },
  documentation: { label: "Documentação", color: "#10b981" },
  review: { label: "Revisão", color: "#f97316" },
  other: { label: "Outro", color: "#94a3b8" },
};

// ── Impedimento ───────────────────────────────────────────────────────────────

export type ImpedimentCriticality = "baixa" | "media" | "alta" | "critica";

export type ImpedimentType = "tecnico" | "negocio" | "dependencia" | "recurso" | "ambiente" | "outro";

export const IMPEDIMENT_CRITICALITY_LABELS: Record<ImpedimentCriticality, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  critica: "Crítica",
};

export const IMPEDIMENT_TYPE_LABELS: Record<ImpedimentType, { label: string; color: string }> = {
  tecnico: { label: "Técnico", color: "#6366f1" },
  negocio: { label: "Negócio", color: "#f59e0b" },
  dependencia: { label: "Dependência", color: "#f97316" },
  recurso: { label: "Recurso", color: "#ef4444" },
  ambiente: { label: "Ambiente", color: "#06b6d4" },
  outro: { label: "Outro", color: "#94a3b8" },
};

export interface Impediment {
  id: string;
  huId?: string;
  sprintId?: string;
  reason: string;
  criticality: ImpedimentCriticality;
  type?: ImpedimentType | null;
  reportedBy?: string | null;
  reportedAt?: string | null;
  createdAt?: string;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  resolution?: string | null;
  hasTicket?: boolean;
  ticketId?: string | null;
  ticketUrl?: string | null;
}

// ── Custom Fields ─────────────────────────────────────────────────────────────

export type CustomFieldType = "text" | "number" | "date" | "boolean" | "select";

export interface CustomField {
  key: string;
  label: string;
  name?: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
}

export interface CustomFieldDefinition {
  id?: string;
  key?: string;
  name: string;
  label?: string;
  type: CustomFieldType;
  options?: string[] | null;
  required?: boolean;
}

// ── AutomationRule ────────────────────────────────────────────────────────────

export interface AutomationRuleTrigger {
  type: "status_change" | string;
  fromStatus?: string | null;
  toStatus: string;
}

export interface AutomationRuleAction {
  type: "change_status" | "notify" | string;
  targetStatus?: string | null;
  message?: string | null;
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  /** @deprecated use enabled */
  isActive?: boolean;
  trigger: AutomationRuleTrigger;
  action: AutomationRuleAction;
  conditions?: Record<string, unknown>;
  createdAt?: string;
}

// ── Sprint ────────────────────────────────────────────────────────────────────

export interface Sprint {
  id: string;
  name: string;
  goal?: string | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  capacity?: number | null;
  createdAt?: string;
  /**
   * Data/hora real do encerramento manual via closeSprint().
   * NULL enquanto a sprint estiver ativa ou não tiver sido encerrada
   * pela funcionalidade de encerramento (sprints históricas).
   */
  closedAt?: string | null;
  /**
   * Dias de atraso registrados no encerramento: MAX(0, closed_at::date - end_date::date).
   * NULL para sprints ativas ou encerradas antes da funcionalidade existir.
   */
  delayDays?: number | null;
}

// ── Epic ──────────────────────────────────────────────────────────────────────

export interface Epic {
  id: string;
  name: string;
  color: string;
  description?: string | null;
  projectId?: string | null;
  createdAt?: string;
  updatedAt?: string | null;
}

// ── Developer ─────────────────────────────────────────────────────────────────

export interface Developer {
  id: string;
  name: string;
  email?: string | null;
  avatar?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  capacity?: number | null;
}

// ── Activity ──────────────────────────────────────────────────────────────────

export interface Activity {
  id: string;
  huId: string;
  assigneeId: string;
  title: string;
  description?: string | null;
  hours: number;
  activityType: ActivityType;
  date?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  isClosed?: boolean;
  closedAt?: string | null;
  createdAt?: string;
}

// ── UserStory ─────────────────────────────────────────────────────────────────

export type KanbanStatus = string;

export interface UserStory {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  acceptanceCriteria?: string | null;
  priority: Priority;
  status: KanbanStatus;
  sprintId: string | null;
  epicId?: string | null;
  assigneeId?: string | null;
  sizeReference?: SizeReference | null;
  storyPoints?: number | null;
  estimatedHours?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  functionPoints?: number | null;
  customFields?: Record<string, string | number>;
  planningStatus?: string | null;
  votedAt?: string | null;
  votedBy?: string | null;
  orderIndex?: number;
  position?: number;
  impediments?: Impediment[];
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// ── WorkflowColumn ────────────────────────────────────────────────────────────

export interface WorkflowColumn {
  key: string;
  label: string;
  colorClass: string;
  dotColor: string;
  hex?: string;
  wipLimit?: number | null;
  orderIndex?: number;
}

export const COLUMN_COLOR_OPTIONS: {
  value: string;
  label: string;
  colorClass: string;
  dotColor: string;
  hex: string;
}[] = [
  { value: "slate",   label: "Cinza",      colorClass: "bg-slate-100 text-slate-700 border-slate-300",   dotColor: "bg-slate-400",   hex: "#94a3b8" },
  { value: "blue",    label: "Azul",       colorClass: "bg-blue-100 text-blue-700 border-blue-300",     dotColor: "bg-blue-400",    hex: "#60a5fa" },
  { value: "indigo",  label: "Índigo",     colorClass: "bg-indigo-100 text-indigo-700 border-indigo-300", dotColor: "bg-indigo-400", hex: "#818cf8" },
  { value: "violet",  label: "Violeta",    colorClass: "bg-violet-100 text-violet-700 border-violet-300", dotColor: "bg-violet-400", hex: "#a78bfa" },
  { value: "purple",  label: "Roxo",       colorClass: "bg-purple-100 text-purple-700 border-purple-300", dotColor: "bg-purple-400", hex: "#c084fc" },
  { value: "amber",   label: "Âmbar",      colorClass: "bg-amber-100 text-amber-700 border-amber-300",   dotColor: "bg-amber-400",   hex: "#fbbf24" },
  { value: "orange",  label: "Laranja",    colorClass: "bg-orange-100 text-orange-700 border-orange-300", dotColor: "bg-orange-400", hex: "#fb923c" },
  { value: "red",     label: "Vermelho",   colorClass: "bg-red-100 text-red-700 border-red-300",         dotColor: "bg-red-400",     hex: "#f87171" },
  { value: "rose",    label: "Rosa",       colorClass: "bg-rose-100 text-rose-700 border-rose-300",       dotColor: "bg-rose-400",    hex: "#fb7185" },
  { value: "cyan",    label: "Ciano",      colorClass: "bg-cyan-100 text-cyan-700 border-cyan-300",       dotColor: "bg-cyan-400",    hex: "#22d3ee" },
  { value: "teal",    label: "Verde-azul", colorClass: "bg-teal-100 text-teal-700 border-teal-300",       dotColor: "bg-teal-400",    hex: "#2dd4bf" },
  { value: "emerald", label: "Esmeralda",  colorClass: "bg-emerald-100 text-emerald-700 border-emerald-300", dotColor: "bg-emerald-400", hex: "#34d399" },
  { value: "green",   label: "Verde",      colorClass: "bg-green-100 text-green-700 border-green-300",   dotColor: "bg-green-400",   hex: "#4ade80" },
];

const _DOT_ENTRIES: [string, string][] = COLUMN_COLOR_OPTIONS.flatMap((o) => [
  [o.dotColor, o.hex],
  [o.value, o.hex],
  [o.dotColor.replace("bg-", ""), o.hex],
  [o.hex.toLowerCase(), o.hex],
  [o.hex.toUpperCase(), o.hex],
  [o.colorClass.split(" ")[0], o.hex],
]);

export const DOT_COLOR_HEX: Record<string, string> = Object.fromEntries(_DOT_ENTRIES);

export function getColumnHex(col: WorkflowColumn): string {
  if (col.hex && /^#[0-9a-fA-F]{3,8}$/.test(col.hex)) return col.hex;
  const raw = col.dotColor ?? "";
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) return raw;
  if (DOT_COLOR_HEX[raw]) return DOT_COLOR_HEX[raw];
  const base = raw.replace("bg-", "").split("-")[0];
  const found = COLUMN_COLOR_OPTIONS.find((o) => o.value === base);
  if (found) return found.hex;
  return "#94a3b8";
}

export function normalizeWorkflowColumn(col: WorkflowColumn): WorkflowColumn {
  if (col.hex && /^#[0-9a-fA-F]{3,8}$/.test(col.hex)) return col;
  return { ...col, hex: getColumnHex(col) };
}

export function normalizeWorkflowColumns(cols: WorkflowColumn[]): WorkflowColumn[] {
  return cols.map(normalizeWorkflowColumn);
}

export const DEFAULT_KANBAN_COLUMNS: WorkflowColumn[] = [
  { key: "aguardando_desenvolvimento", label: "Aguardando Dev",      colorClass: "bg-slate-100 text-slate-700 border-slate-300",     dotColor: "bg-slate-400",   hex: "#94a3b8", orderIndex: 0 },
  { key: "em_desenvolvimento",         label: "Em Desenvolvimento",  colorClass: "bg-blue-100 text-blue-700 border-blue-300",       dotColor: "bg-blue-400",    hex: "#60a5fa", orderIndex: 1 },
  { key: "em_teste",                   label: "Em Teste",            colorClass: "bg-amber-100 text-amber-700 border-amber-300",   dotColor: "bg-amber-400",   hex: "#fbbf24", orderIndex: 2 },
  { key: "bug",                        label: "Bug",                 colorClass: "bg-red-100 text-red-700 border-red-300",         dotColor: "bg-red-400",     hex: "#f87171", orderIndex: 3 },
  { key: "homologacao",                label: "Homologação",         colorClass: "bg-violet-100 text-violet-700 border-violet-300", dotColor: "bg-violet-400",  hex: "#a78bfa", orderIndex: 4 },
  { key: "concluida",                  label: "Concluída",           colorClass: "bg-emerald-100 text-emerald-700 border-emerald-300", dotColor: "bg-emerald-400", hex: "#34d399", orderIndex: 5 },
];

// ── Funções auxiliares ────────────────────────────────────────────────────────

/** @deprecated Use startDate diretamente como end_date */
export function calculateEndDate(startDate: string, _hours: number): string {
  return startDate;
}

export function getTotalHoursForHU(activities: Activity[], huId: string): number {
  return activities.filter((a) => a.huId === huId).reduce((s, a) => s + (a.hours ?? 0), 0);
}

export function hasActiveImpediment(hu: UserStory): boolean {
  return (hu.impediments ?? []).some((i) => !i.resolvedAt);
}

export function isHUOverdue(hu: UserStory, activities: Activity[]): boolean {
  const TERMINAL = ["concluida", "cancelada"];
  if (TERMINAL.includes(hu.status)) return false;
  const total = getTotalHoursForHU(activities, hu.id);
  const est = hu.estimatedHours ?? 0;
  return est > 0 && total > est * 1.2;
}

export function isTerminalStatus(status: string): boolean {
  return ["concluida", "cancelada"].includes(status);
}

// ── Tipos de relatório / métricas ─────────────────────────────────────────────

export interface SprintVelocity {
  sprintId: string;
  sprintName: string;
  planned: number;
  delivered: number;
}

export interface TeamWorkload {
  developerId: string;
  developerName: string;
  estimatedHours: number;
  realizedHours: number;
  percentage: number;
}
