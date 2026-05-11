import { useMemo, useState } from "react";
import { useSprint } from "@/contexts/SprintContext";
import { useAuth } from "@/contexts/AuthContext";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { Badge } from "@/components/ui/badge";
import { BarChart2, Clock, Bug, ListTodo, Users, ChevronDown, ChevronRight } from "lucide-react";
import { MetricCard } from "./metrics/MetricCard";
import { PerformanceHeader } from "./metrics/PerformanceHeader";
import { ProductivityChart } from "./metrics/ProductivityChart";
import { formatMinutes, sumDecimalsAsMinutes } from "@/lib/duration";

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface DeveloperProductivity {
  developerId: string;
  developerName: string;
  totalHours: number;      // decimal interno; exibição sempre via formatMinutes()
  taskCount: number;
  bugCount: number;
  closedActivities: number;
  openActivities: number;
}

interface HuProductivity {
  huId: string;
  huCode: string;
  huTitle: string;
  totalHours: number;      // decimal interno
  activityCount: number;
  closedActivities: number;
}

// ─── ExpandableDevRow ─────────────────────────────────────────────────────────
function ExpandableDevRow({
  dev,
  totalHours,
  index,
}: {
  dev: DeveloperProductivity;
  totalHours: number;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const Chevron = expanded ? ChevronDown : ChevronRight;
  const closedRate = dev.closedActivities + dev.openActivities > 0
    ? Math.round((dev.closedActivities / (dev.closedActivities + dev.openActivities)) * 100)
    : 0;
  const hoursShare = totalHours > 0 ? Math.round((dev.totalHours / totalHours) * 100) : 0;
  const effColor = closedRate >= 80 ? "#22c55e" : closedRate >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <>
      <tr
        className="border-b border-border/50 hover:bg-muted/40 cursor-pointer transition-colors group"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Chevron className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground">{dev.developerName}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-center tabular-nums text-sm">
          {dev.closedActivities}/{dev.closedActivities + dev.openActivities}
        </td>
        {/* Horas: decimal → "Xh Ymin" */}
        <td className="px-4 py-3 text-center tabular-nums text-sm font-medium">
          {formatMinutes(Math.round(dev.totalHours * 60))}
        </td>
        <td className="px-4 py-3 text-center tabular-nums text-sm">
          {dev.taskCount}
        </td>
        <td className="px-4 py-3 text-center">
          {dev.bugCount > 0 ? (
            <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-600 border-red-200">
              {dev.bugCount}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[64px]">
              <div className="h-full rounded-full" style={{ width: `${closedRate}%`, background: effColor }} />
            </div>
            <span className="text-xs font-semibold tabular-nums" style={{ color: effColor }}>{closedRate}%</span>
          </div>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="text-xs text-muted-foreground tabular-nums">{hoursShare}% do total</span>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/20">
          <td colSpan={7} className="px-6 py-3">
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg bg-card border border-border/60 p-3">
                <p className="text-muted-foreground">Atividades abertas</p>
                <p className="text-base font-bold tabular-nums mt-1">{dev.openActivities}</p>
              </div>
              <div className="rounded-lg bg-card border border-border/60 p-3">
                <p className="text-muted-foreground">Atividades fechadas</p>
                <p className="text-base font-bold tabular-nums mt-1">{dev.closedActivities}</p>
              </div>
              <div className="rounded-lg bg-card border border-border/60 p-3">
                <p className="text-muted-foreground">Bugs registrados</p>
                <p className="text-base font-bold tabular-nums mt-1 text-red-600">{dev.bugCount}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── ProductivityReport ───────────────────────────────────────────────────────
export function ProductivityReport() {
  const { activities, userStories, developers, activeSprint } = useSprint();
  const { currentTeamId } = useAuth();

  const { devMetrics, huMetrics, totalHours, totalActivities, totalBugs, closedActivities } = useMemo(() => {
    if (!activeSprint) {
      return {
        devMetrics: [] as DeveloperProductivity[],
        huMetrics:  [] as HuProductivity[],
        totalHours: 0, totalActivities: 0, totalBugs: 0, closedActivities: 0,
      };
    }

    const sprintActivities = activities.filter((a) =>
      userStories.some((hu) => hu.id === a.huId && hu.sprintId === activeSprint.id),
    );

    const devMap = new Map<string, DeveloperProductivity>();
    const huMap  = new Map<string, HuProductivity>();
    let totalH = 0, totalA = 0, totalBugsCount = 0, closedA = 0;

    for (const act of sprintActivities) {
      totalH += act.hours || 0;
      totalA += 1;
      if (act.activityType === "bug") totalBugsCount += 1;
      if (act.isClosed) closedA += 1;

      if (act.assigneeId) {
        const dev = developers.find((d) => d.id === act.assigneeId);
        if (!devMap.has(act.assigneeId)) {
          devMap.set(act.assigneeId, {
            developerId: act.assigneeId,
            developerName: dev?.name || "Sem responsável",
            totalHours: 0, taskCount: 0, bugCount: 0,
            closedActivities: 0, openActivities: 0,
          });
        }
        const entry = devMap.get(act.assigneeId)!;
        entry.totalHours += act.hours || 0;
        if (act.activityType === "bug") entry.bugCount += 1;
        else entry.taskCount += 1;
        if (act.isClosed) entry.closedActivities += 1;
        else entry.openActivities += 1;
      }

      const hu = userStories.find((h) => h.id === act.huId);
      if (hu) {
        if (!huMap.has(hu.id)) {
          huMap.set(hu.id, {
            huId: hu.id, huCode: hu.code, huTitle: hu.title,
            totalHours: 0, activityCount: 0, closedActivities: 0,
          });
        }
        const entryHu = huMap.get(hu.id)!;
        entryHu.totalHours   += act.hours || 0;
        entryHu.activityCount += 1;
        if (act.isClosed) entryHu.closedActivities += 1;
      }
    }

    return {
      devMetrics:       Array.from(devMap.values()).sort((a, b) => b.totalHours - a.totalHours),
      huMetrics:        Array.from(huMap.values()).sort((a, b) => b.totalHours - a.totalHours),
      totalHours:       totalH,
      totalActivities:  totalA,
      totalBugs:        totalBugsCount,
      closedActivities: closedA,
    };
  }, [activities, userStories, developers, activeSprint]);

  if (!activeSprint || !currentTeamId) {
    return (
      <EmptyState
        icon={BarChart2}
        title="Nenhuma sprint ativa"
        description="Selecione um time e inicie uma sprint na Sala Ágil para visualizar o relatório de produtividade."
      />
    );
  }

  if (totalActivities === 0) {
    return (
      <EmptyState
        icon={BarChart2}
        title="Sem atividades registradas"
        description="Crie atividades vinculadas às User Stories da sprint para acompanhar a produtividade do time."
      />
    );
  }

  // totalHours é decimal — converter para minutos antes de formatar
  const totalHoursFormatted    = formatMinutes(Math.round(totalHours * 60));
  const avgMinPerActivity      = totalActivities > 0 ? Math.round((totalHours * 60) / totalActivities) : 0;
  const avgFormatted           = formatMinutes(avgMinPerActivity);
  const completionRate         = totalActivities > 0 ? (closedActivities / totalActivities) * 100 : 0;

  // Gráfico de horas por dev — mantém decimal para o eixo Y, label usa formatMinutes
  const hoursChartData = devMetrics.map((d) => ({
    name:  d.developerName.split(" ")[0],
    horas: parseFloat(d.totalHours.toFixed(2)),
    label: formatMinutes(Math.round(d.totalHours * 60)),
  }));

  // Top 8 HUs
  const huChartData = huMetrics.slice(0, 8).map((h) => ({
    name:       h.huCode,
    horas:      parseFloat(h.totalHours.toFixed(2)),
    label:      formatMinutes(Math.round(h.totalHours * 60)),
    atividades: h.activityCount,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <PerformanceHeader
        title="Relatório de Produtividade"
        sprintName={activeSprint.name}
        kpis={[
          { label: "atividades",    value: totalActivities },
          { label: "desenvolvedores", value: devMetrics.length },
        ]}
      />

      {/* KPI Cards */}
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Resumo do Sprint</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            icon={Clock} label="Horas Lançadas" accent="blue"
            value={totalHoursFormatted}
            sublabel={`Média ${avgFormatted} / atividade`}
          />
          <MetricCard
            icon={ListTodo} label="Atividades Concluídas" accent="green"
            value={`${closedActivities}/${totalActivities}`}
            sublabel={`${completionRate.toFixed(0)}% de conclusão`}
          />
          <MetricCard
            icon={Bug} label="Bugs" accent={totalBugs > 0 ? "red" : "neutral"}
            value={totalBugs}
            sublabel={totalBugs === 0 ? "Nenhum bug registrado" : "bugs neste sprint"}
          />
          <MetricCard
            icon={Users} label="Desenvolvedores" accent="violet"
            value={devMetrics.length}
            sublabel="contribuindo no sprint"
          />
        </div>
      </section>

      {/* Charts */}
      {devMetrics.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Análise por Membro</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <ProductivityChart
              type="bar"
              title="Horas por Desenvolvedor"
              subtitle="Esforço total lançado no sprint"
              data={hoursChartData}
              dataKeys={[{ key: "horas", name: "Horas", color: "#3b82f6" }]}
            />
            {huChartData.length > 0 && (
              <ProductivityChart
                type="bar"
                title="Horas por User Story"
                subtitle="Top 8 HUs por esforço"
                data={huChartData}
                dataKeys={[
                  { key: "horas",      name: "Horas",      color: "#8b5cf6" },
                  { key: "atividades", name: "Atividades", color: "#f59e0b" },
                ]}
              />
            )}
          </div>
        </section>
      )}

      {/* Tabela de desenvolvedores */}
      {devMetrics.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Tabela Detalhada por Membro</h3>
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border/60">
                  <th className="px-4 py-3 text-left   text-xs font-semibold text-muted-foreground">Desenvolvedor</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Atividades</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Horas</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Tarefas</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Bugs</th>
                  <th className="px-4 py-3 text-left   text-xs font-semibold text-muted-foreground">Conclusão</th>
                  <th className="px-4 py-3 text-right  text-xs font-semibold text-muted-foreground">% do total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {devMetrics.map((dev, i) => (
                  <ExpandableDevRow key={dev.developerId} dev={dev} totalHours={totalHours} index={i} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Tabela de HUs */}
      {huMetrics.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Esforço por User Story</h3>
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border/60">
                  <th className="px-4 py-3 text-left   text-xs font-semibold text-muted-foreground">Código</th>
                  <th className="px-4 py-3 text-left   text-xs font-semibold text-muted-foreground">Título</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Horas</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground">Atividades</th>
                  <th className="px-4 py-3 text-left   text-xs font-semibold text-muted-foreground">Conclusão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {huMetrics.map((hu) => {
                  const rate = hu.activityCount > 0 ? Math.round((hu.closedActivities / hu.activityCount) * 100) : 0;
                  const effC = rate >= 80 ? "#22c55e" : rate >= 60 ? "#f59e0b" : "#ef4444";
                  return (
                    <tr key={hu.huId} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-muted-foreground">{hu.huCode}</td>
                      <td className="px-4 py-3 max-w-[280px] truncate text-sm">{hu.huTitle}</td>
                      <td className="px-4 py-3 text-center text-sm tabular-nums font-medium">
                        {formatMinutes(Math.round(hu.totalHours * 60))}
                      </td>
                      <td className="px-4 py-3 text-center text-sm tabular-nums">
                        {hu.closedActivities}/{hu.activityCount}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[64px]">
                            <div className="h-full rounded-full" style={{ width: `${rate}%`, background: effC }} />
                          </div>
                          <span className="text-xs font-semibold tabular-nums" style={{ color: effC }}>{rate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
