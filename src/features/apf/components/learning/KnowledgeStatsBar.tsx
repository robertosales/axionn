/**
 * KnowledgeStatsBar
 * ------------------
 * Barra de KPIs no topo da Biblioteca APF.
 * Exibe: total padrões, pendentes de revisão, acurácia atual e delta RAG.
 */
import { Brain, Clock, CheckCircle2, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { KnowledgeStats } from "../../services/knowledge.service";

interface Props {
  stats: KnowledgeStats | null;
  loading: boolean;
}

export function KnowledgeStatsBar({ stats, loading }: Props) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}><CardContent className="p-4"><Skeleton className="h-14" /></CardContent></Card>
        ))}
      </div>
    );
  }

  const ragLabel =
    stats.ragDelta != null
      ? `${stats.ragDelta >= 0 ? "+" : ""}${stats.ragDelta.toFixed(1)} pp com RAG`
      : "Dados insuficientes";

  const kpis = [
    {
      label: "Padrões totais",
      value: stats.totalPatterns,
      sub: "na base de conhecimento",
      icon: Brain,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Pendentes",
      value: stats.pendingPatterns,
      sub: "aguardando revisão",
      icon: Clock,
      color: stats.pendingPatterns > 0 ? "text-amber-600" : "text-muted-foreground",
      bg: stats.pendingPatterns > 0 ? "bg-amber-50 dark:bg-amber-900/10" : "bg-muted/40",
    },
    {
      label: "Validados",
      value: stats.validatedPatterns,
      sub: "confirmados por especialistas",
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-900/10",
    },
    {
      label: "Impacto RAG",
      value: stats.ragDelta != null ? `${stats.ragDelta >= 0 ? "+" : ""}${stats.ragDelta.toFixed(1)}pp` : "—",
      sub: ragLabel,
      icon: Zap,
      color: (stats.ragDelta ?? 0) >= 0 ? "text-emerald-600" : "text-red-500",
      bg: (stats.ragDelta ?? 0) >= 0 ? "bg-emerald-50 dark:bg-emerald-900/10" : "bg-red-50 dark:bg-red-900/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <Card key={kpi.label} className="border border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground truncate">{kpi.label}</p>
                <p className={`text-xl font-bold tabular-nums leading-tight ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[10px] text-muted-foreground truncate">{kpi.sub}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
