import { useDashboardData } from "../hooks/useDashboardData";
import { KPICard }       from "../components/KPICard";
import { BurndownChart } from "../components/BurndownChart";
import { VelocityChart } from "../components/VelocityChart";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge }   from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button }  from "@/components/ui/button";
import {
  LayoutDashboard, Zap, CheckCircle2, AlertTriangle,
  ListTodo, RefreshCw, TrendingUp, Clock, Users,
} from "lucide-react";

export function DashboardPage() {
  const { data, loading, period, setPeriod, filteredHistory, reload } = useDashboardData();

  if (loading) return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
    </div>
  );

  if (!data) return null;
  const { currentSprint: cs, devMetrics, statusDistribution, burndown, openImpediments, totalBacklog, avgVelocity } = data;

  return (
    <div className="space-y-6 p-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Dashboard</h1>
          {cs && <Badge variant="outline" className="text-[10px]">{cs.sprintName}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={v => setPeriod(v as any)}>
            <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="current"  className="text-xs">Sprint atual</SelectItem>
              <SelectItem value="3sprints" className="text-xs">Últimos 3 sprints</SelectItem>
              <SelectItem value="6sprints" className="text-xs">Últimos 6 sprints</SelectItem>
              <SelectItem value="all"      className="text-xs">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={reload}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard
          title="Velocity média"
          value={avgVelocity}
          subtitle="pts / sprint (6 sprints)"
          icon={<Zap className="h-4 w-4" />}
          variant="default"
        />
        <KPICard
          title={cs ? "Taxa de conclusão" : "HUs no backlog"}
          value={cs ? `${cs.completionRate}%` : totalBacklog}
          subtitle={cs ? `${cs.doneHUs}/${cs.totalHUs} HUs` : "sem sprint"}
          icon={<CheckCircle2 className="h-4 w-4" />}
          variant={cs ? (cs.completionRate >= 80 ? "success" : cs.completionRate >= 50 ? "warning" : "danger") : "default"}
        />
        <KPICard
          title="Impedimentos abertos"
          value={openImpediments}
          subtitle="sem resolução"
          icon={<AlertTriangle className="h-4 w-4" />}
          variant={openImpediments === 0 ? "success" : openImpediments <= 2 ? "warning" : "danger"}
        />
        <KPICard
          title={cs ? "Pontos restantes" : "Sprints analisados"}
          value={cs ? Math.max(0, cs.totalPoints - cs.donePoints) : data.sprintHistory.length}
          subtitle={cs ? `de ${cs.totalPoints} pts` : "no histórico"}
          icon={<ListTodo className="h-4 w-4" />}
        />
      </div>

      {/* Burndown + Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Burndown */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" /> Burndown
            </h2>
            {cs && <Badge variant="outline" className="text-[10px]">{cs.donePoints}/{cs.totalPoints} pts</Badge>}
          </div>
          <BurndownChart points={burndown} />
        </div>

        {/* Distribuição de status */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <ListTodo className="h-4 w-4 text-primary" /> Status das HUs
          </h2>
          {statusDistribution.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Sem HUs no sprint ativo.</p>
          ) : (
            <div className="space-y-2">
              {statusDistribution.map(s => {
                const total = statusDistribution.reduce((a, b) => a + b.count, 0);
                const pct   = total > 0 ? Math.round((s.count / total) * 100) : 0;
                return (
                  <div key={s.status} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-muted-foreground">{s.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{s.count}</span>
                        <span className="text-muted-foreground text-[10px]">({pct}%)</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Velocity histórico */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-primary" /> Velocity por Sprint
          </h2>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-indigo-400/40" /> Total</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-emerald-400/80" /> Concluído</span>
          </div>
        </div>
        <VelocityChart sprints={filteredHistory} />
      </div>

      {/* Performance por dev */}
      {devMetrics.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Users className="h-4 w-4 text-primary" /> Performance por Dev
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Dev</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">HUs</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Concluídas</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">Pts</th>
                  <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                    <span className="flex items-center justify-end gap-1"><Clock className="h-3 w-3" /> Cycle time</span>
                  </th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Conclusão</th>
                </tr>
              </thead>
              <tbody>
                {devMetrics.map(d => (
                  <tr key={d.devId} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="py-2 pr-4">
                      <div className="flex items-center gap-2">
                        {d.devAvatar ? (
                          <img src={d.devAvatar} alt={d.devName} className="h-6 w-6 rounded-full object-cover" />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                            {d.devName.charAt(0)}
                          </div>
                        )}
                        <span className="font-medium">{d.devName}</span>
                      </div>
                    </td>
                    <td className="text-right py-2 px-3 tabular-nums">{d.totalHUs}</td>
                    <td className="text-right py-2 px-3 tabular-nums">{d.doneHUs}</td>
                    <td className="text-right py-2 px-3 tabular-nums">{d.donePoints}</td>
                    <td className="text-right py-2 px-3 tabular-nums text-muted-foreground">
                      {d.avgCycleTime !== null ? `${d.avgCycleTime}d` : "-"}
                    </td>
                    <td className="text-right py-2">
                      <div className="flex items-center justify-end gap-1">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: `${d.totalHUs > 0 ? Math.round((d.doneHUs / d.totalHUs) * 100) : 0}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {d.totalHUs > 0 ? Math.round((d.doneHUs / d.totalHUs) * 100) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
