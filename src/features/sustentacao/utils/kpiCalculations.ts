// src/features/sustentacao/utils/kpiCalculations.ts
// Funções de cálculo de KPIs usadas pelo SustentacaoDashboard

// ─── Tipos mínimos ────────────────────────────────────────────────────────────
interface Demanda {
  id: string;
  situacao: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  first_response_at?: string | null;
  sla_violado?: boolean;
  sla_em_risco?: boolean;
  [key: string]: any;
}

interface Transition {
  demanda_id: string;
  from_status?: string | null;
  to_status: string;
  created_at: string;
  [key: string]: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BACKLOG_DAYS = 7;
const OPEN_STATUSES = ["aberta", "em_andamento", "aguardando_retorno", "bloqueada"];
const RESOLVED_STATUSES = ["resolvida", "fechada", "concluida"];

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function hoursBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}

// ─── calcAtendimento ──────────────────────────────────────────────────────────
export interface AtendimentoKPI {
  total: number;
  abertosHoje: number;
  resolvidosHoje: number;
  backlog: number;
  backlogDays: number;
}

export function calcAtendimento(demandas: Demanda[]): AtendimentoKPI {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - BACKLOG_DAYS);

  return {
    total: demandas.filter((d) => OPEN_STATUSES.includes(d.situacao)).length,
    abertosHoje: demandas.filter((d) => isToday(d.created_at)).length,
    resolvidosHoje: demandas.filter(
      (d) => RESOLVED_STATUSES.includes(d.situacao) && d.resolved_at && isToday(d.resolved_at)
    ).length,
    backlog: demandas.filter(
      (d) => OPEN_STATUSES.includes(d.situacao) && new Date(d.created_at) < cutoff
    ).length,
    backlogDays: BACKLOG_DAYS,
  };
}

// ─── calcTempos ───────────────────────────────────────────────────────────────
export interface TemposKPI {
  tmr: number;       // Tempo Médio de Resposta (h)
  tmrCount: number;
  mttr: number;      // Mean Time To Resolve (h)
  mttrCount: number;
  tma: number;       // Tempo Médio de Atendimento (h)
  mtta: number;      // Mean Time To Acknowledge (h)
  mttaCount: number;
}

export function calcTempos(demandas: Demanda[], transitions: Transition[]): TemposKPI {
  // TMR — criação até primeira transição de qualquer tipo
  const tmrValues: number[] = [];
  demandas.forEach((d) => {
    const first = transitions
      .filter((t) => t.demanda_id === d.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
    if (first) tmrValues.push(Math.abs(hoursBetween(d.created_at, first.created_at)));
    else if (d.first_response_at)
      tmrValues.push(Math.abs(hoursBetween(d.created_at, d.first_response_at)));
  });

  // MTTR — criação até resolução
  const mttrValues: number[] = demandas
    .filter((d) => RESOLVED_STATUSES.includes(d.situacao) && d.resolved_at)
    .map((d) => Math.abs(hoursBetween(d.created_at, d.resolved_at!)));

  // TMA — média de (updated_at - created_at) para todas as demandas
  const tmaValues: number[] = demandas.map((d) =>
    Math.abs(hoursBetween(d.created_at, d.updated_at))
  );

  // MTTA — criação até transição para "em_andamento"
  const mttaValues: number[] = [];
  demandas.forEach((d) => {
    const ack = transitions
      .filter((t) => t.demanda_id === d.id && t.to_status === "em_andamento")
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
    if (ack) mttaValues.push(Math.abs(hoursBetween(d.created_at, ack.created_at)));
  });

  const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  return {
    tmr:       avg(tmrValues),
    tmrCount:  tmrValues.length,
    mttr:      avg(mttrValues),
    mttrCount: mttrValues.length,
    tma:       avg(tmaValues),
    mtta:      avg(mttaValues),
    mttaCount: mttaValues.length,
  };
}

// ─── calcSLA ──────────────────────────────────────────────────────────────────
export interface SLAKPI {
  total: number;
  compliance: number; // % (0–100)
  emRisco: number;
  violados: number;
}

export function calcSLA(demandas: Demanda[], _transitions: Transition[]): SLAKPI {
  const total    = demandas.length;
  const violados = demandas.filter((d) => d.sla_violado).length;
  const emRisco  = demandas.filter((d) => d.sla_em_risco && !d.sla_violado).length;
  const compliance = total === 0 ? 100 : ((total - violados) / total) * 100;

  return { total, compliance, emRisco, violados };
}

// ─── formatHours ─────────────────────────────────────────────────────────────
export function formatHours(hours: number): string {
  if (hours === 0) return "0h";
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = Math.floor(hours / 24);
  const rem  = Math.round(hours % 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}
