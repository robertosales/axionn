import { useMemo } from "react";
import { FileText, CheckCircle2, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import type { Rdm } from "../types/rdm";
import { RDM_STATUS_LABELS, RDM_STATUS_COLORS } from "../types/rdm";
import { RdmStatusBadge } from "./RdmStatusBadge";

interface Props { rdms: Rdm[] }

export function RdmDashboard({ rdms }: Props) {
  const stats = useMemo(() => ({
    total:      rdms.length,
    aprovadas:  rdms.filter((r) => r.status === "aprovada").length,
    execucao:   rdms.filter((r) => r.status === "em_execucao").length,
    concluidas: rdms.filter((r) => r.status === "concluida").length,
    rollback:   rdms.filter((r) => r.status === "rollback").length,
    alto_risco: rdms.filter((r) => r.risco === "alto").length,
  }), [rdms]);

  const recent = useMemo(
    () => [...rdms].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5),
    [rdms]
  );

  const kpiCards = [
    { label: "Total de RDMs",  value: stats.total,      icon: FileText,      tone: "info" },
    { label: "Em Execução",    value: stats.execucao,   icon: Clock,         tone: "warning" },
    { label: "Concluídas",     value: stats.concluidas, icon: CheckCircle2,  tone: "success" },
    { label: "Alto Risco",     value: stats.alto_risco, icon: AlertTriangle, tone: "danger" },
  ];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            data-tone={tone}
            className="metric-panel p-4 pl-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{label}</p>
              <span className="metric-icon h-9 w-9 rounded-xl"><Icon className="h-4 w-4" /></span>
            </div>
            <p className="metric-value text-3xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Distribuição por status */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Distribuição por Status</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Object.entries(RDM_STATUS_LABELS).map(([status, label]) => {
            const count = rdms.filter((r) => r.status === status).length;
            return (
              <div key={status} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <RdmStatusBadge status={status} />
                <span className="text-sm font-bold ml-2">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Atividade recente */}
      {recent.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-semibold text-foreground mb-4">Atualizações Recentes</p>
          <div className="space-y-2">
            {recent.map((rdm) => (
              <div
                key={rdm.id}
                className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0"
              >
                <div className="flex-1 min-w-0">
                  {rdm.codigo && (
                    <span className="text-[10px] font-mono text-muted-foreground mr-2">{rdm.codigo}</span>
                  )}
                  <span className="text-sm text-foreground truncate">{rdm.nome}</span>
                </div>
                <RdmStatusBadge status={rdm.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
