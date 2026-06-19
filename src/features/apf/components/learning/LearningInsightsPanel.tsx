/**
 * LearningInsightsPanel
 * ----------------------
 * Painel visual de Aprendizado Bidirecional.
 * Exibe KPIs de desvio, acurácia, viés e o sparkline de evolução.
 * Colocado no topo da aba "Contagem por Sprint" (ApfFunctionPointTab).
 */
import { Brain, TrendingUp, TrendingDown, Minus, RefreshCw, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { LearningInsights } from "../../services/learning.service";

interface Props {
  insights: LearningInsights | null;
  loading: boolean;
  lastRefresh: Date | null;
  onRefresh: () => void;
}

const BIAS_CONFIG = {
  underestimate: {
    label: "IA subestima",
    icon: TrendingUp,
    color: "text-amber-600",
    badge: "border-amber-400 text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-900/10",
  },
  overestimate: {
    label: "IA superestima",
    icon: TrendingDown,
    color: "text-blue-600",
    badge: "border-blue-400 text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-900/10",
  },
  calibrated: {
    label: "Calibrada ✅",
    icon: Minus,
    color: "text-emerald-600",
    badge: "border-emerald-400 text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-900/10",
  },
};

export function LearningInsightsPanel({ insights, loading, lastRefresh, onRefresh }: Props) {
  if (loading && !insights) {
    return (
      <Card className="border border-border">
        <CardContent className="p-4 space-y-2">
          <Skeleton className="h-4 w-48" />
          <div className="grid grid-cols-4 gap-3">
            {[1,2,3,4].map((i) => <Skeleton key={i} className="h-16" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!insights || insights.totalValidations === 0) {
    return (
      <Card className="border border-dashed border-primary/20">
        <CardContent className="py-5 px-4 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Aprendizado Bidirecional ativo</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Valide PFs nesta aba para que a IA calibre automaticamente suas próximas estimativas.
              Após 3 validações, o sistema ajusta o prompt com base no viés histórico do seu time.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const bias = BIAS_CONFIG[insights.bias];
  const BiasIcon = bias.icon;

  const kpis = [
    {
      label: "Validações",
      value: insights.totalValidations,
      sub: "históricas",
      color: "text-foreground",
    },
    {
      label: "Acurácia IA",
      value: `${insights.accuracyRate.toFixed(0)}%`,
      sub: "desvio ≤ 15%",
      color: insights.accuracyRate >= 70 ? "text-emerald-600" : insights.accuracyRate >= 50 ? "text-amber-600" : "text-red-500",
    },
    {
      label: "Desvio médio",
      value: `${insights.avgDeviationPct > 0 ? "+" : ""}${insights.avgDeviationPct.toFixed(1)}%`,
      sub: `${insights.avgDeviationAbs.toFixed(1)} PF abs`,
      color: Math.abs(insights.avgDeviationPct) <= 10 ? "text-emerald-600" : "text-amber-600",
    },
    {
      label: "Componente crítico",
      value: insights.worstComponent ?? "—",
      sub: "maior desvio acum.",
      color: insights.worstComponent ? "text-primary" : "text-muted-foreground",
    },
  ];

  return (
    <Card className={`border ${bias.bg}`}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Aprendizado Bidirecional
            <Badge variant="outline" className={`text-[10px] gap-1 ${bias.badge}`}>
              <BiasIcon className="h-3 w-3" />
              {bias.label}
            </Badge>
            {insights.totalValidations >= 3 && (
              <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                🧠 Calibração ativa
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastRefresh && (
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                {lastRefresh.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onRefresh}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-background rounded-lg border border-border px-3 py-2">
              <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
              <p className={`text-xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
              <p className="text-[10px] text-muted-foreground">{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Sparkline texto */}
        {insights.history.length >= 3 && (
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Últimas validações — desvio IA vs validado
            </p>
            <div className="flex items-end gap-1 h-10 overflow-x-auto">
              {insights.history.map((h, i) => {
                const absD  = Math.abs(h.deviationPct);
                const color = absD <= 15 ? "bg-emerald-500" : absD <= 30 ? "bg-amber-500" : "bg-red-500";
                const height = Math.min(100, 20 + absD * 2);
                return (
                  <div
                    key={i}
                    className={`shrink-0 w-3 rounded-t ${color} opacity-80 cursor-default`}
                    style={{ height: `${height}%` }}
                    title={`${h.code}: IA=${h.ai} | Validado=${h.validated} (${h.deviationPct > 0 ? "+" : ""}${h.deviationPct}%)`}
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-500" /> ≤ 15%</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-amber-500" /> 15–30%</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-red-500" /> &gt; 30%</span>
            </div>
          </div>
        )}

        {/* Mensagem de calibração ativa */}
        {insights.totalValidations >= 3 && (
          <div className="flex items-start gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
            <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-primary">
              O contexto de calibração está sendo injetado automaticamente nos próximos cálculos de PF.
              A IA já sabe que este time tende a{" "}
              {insights.bias === "underestimate" ? "subestimar" : insights.bias === "overestimate" ? "superestimar" : "estimar com precisão"}{" "}
              em média {Math.abs(insights.avgDeviationPct).toFixed(1)}%.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
