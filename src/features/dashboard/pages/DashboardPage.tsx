import { useState, useMemo, useEffect } from "react";
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
  ChevronLeft, ChevronRight,
} from "lucide-react";

const PAGE_SIZE = 5;

export function DashboardPage() {
  const {
    data, loading, period, setPeriod, filteredHistory, reload,
    devOptions, currentUserDevId, isAdminUser,
  } = useDashboardData();

  // Analista selecionado: admin/admin_contrato começa com "all", member com seu próprio id
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>("all");
  const [currentPage,     setCurrentPage]     = useState(0);

  // Inicializa selectedAnalyst assim que soubermos o papel e o dev do usuário
  useEffect(() => {
    if (isAdminUser) {
      setSelectedAnalyst("all");
    } else if (currentUserDevId) {
      setSelectedAnalyst(currentUserDevId);
    }
  }, [isAdminUser, currentUserDevId]);

  // Reset de página ao mudar filtros
  useEffect(() => { setCurrentPage(0); }, [selectedAnalyst, period]);

  // Filtra métricas pelo analista selecionado
  const filteredDevMetrics = useMemo(() => {
    if (!data) return [];
    if (selectedAnalyst === "all") return data.devMetrics;
    return data.devMetrics.filter(d => d.devId === selectedAnalyst);
  }, [data, selectedAnalyst]);

  // Paginação
  const totalPages   = Math.max(1, Math.ceil(filteredDevMetrics.length / PAGE_SIZE));
  const paginatedDevs = filteredDevMetrics.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

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
    <div
      className="space-y-5 p-5 max-w-6xl mx-auto"
      style={{ color: "hsl(var(--foreground))" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5" style={{ color: "#0bbcaf" }} />
          <h1 className="text-lg font-bold">Dashboard</h1>
          {cs && (
            <Badge variant="outline" className="text-[10px]">{cs.sprintName}</Badge>
          )}
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

      {/* ── KPIs ── */}
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

      {/* ── Burndown + Distribuição de Status ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            background: "hsl(var(--card))",
            border:     "1px solid hsl(var(--border))",
            boxShadow:  "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" style={{ color: "#0bbcaf" }} /> Burndown
            </h2>
            {cs && <Badge variant="outline" className="text-[10px]">{cs.donePoints}/{cs.totalPoints} pts</Badge>}
          </div>
          <BurndownChart points={burndown} />
        </div>

        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            background: "hsl(var(--card))",
            border:     "1px solid hsl(var(--border))",
            boxShadow:  "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <ListTodo className="h-4 w-4" style={{ color: "#0bbcaf" }} /> Status das HUs
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
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Velocity histórico ── */}
      <div
        className="rounded-xl p-4 space-y-3"
        style={{
          background: "hsl(var(--card))",
          border:     "1px solid hsl(var(--border))",
          boxShadow:  "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Zap className="h-4 w-4" style={{ color: "#0bbcaf" }} /> Velocity por Sprint
          </h2>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded" style={{ background: "rgba(99,102,241,0.4)" }} /> Total
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded" style={{ background: "rgba(34,197,94,0.8)" }} /> Concluído
            </span>
          </div>
        </div>
        <VelocityChart sprints={filteredHistory} />
      </div>

      {/* ── Performance por Analista ── */}
      {devMetrics.length > 0 && (
        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            background: "hsl(var(--card))",
            border:     "1px solid hsl(var(--border))",
            boxShadow:  "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          {/* Cabeçalho da seção + combo de analista */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <Users className="h-4 w-4" style={{ color: "#0bbcaf" }} /> Performance por Dev
            </h2>

            {/* Combo de analista — RBAC */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Analista:</span>
              <Select
                value={selectedAnalyst}
                onValueChange={setSelectedAnalyst}
                disabled={!isAdminUser}
              >
                <SelectTrigger
                  className="h-7 text-xs w-44"
                  style={{
                    opacity: !isAdminUser ? 0.65 : 1,
                    cursor:  !isAdminUser ? "not-allowed" : "pointer",
                  }}
                >
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {/* Opção "Todos" apenas para admin / admin_contrato */}
                  {isAdminUser && (
                    <SelectItem value="all" className="text-xs">Todos</SelectItem>
                  )}
                  {devOptions.map(dev => (
                    <SelectItem key={dev.id} value={dev.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        {dev.avatar ? (
                          <img src={dev.avatar} alt={dev.name} className="h-4 w-4 rounded-full object-cover" />
                        ) : (
                          <div
                            className="h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                            style={{ background: "rgba(11,188,175,0.15)", color: "#0bbcaf" }}
                          >
                            {dev.name.charAt(0)}
                          </div>
                        )}
                        {dev.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabela paginada */}
          {filteredDevMetrics.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhum dado de atividade encontrado.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid hsl(var(--border))" }}>
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
                    {paginatedDevs.map(d => (
                      <tr
                        key={d.devId}
                        className="transition-colors"
                        style={{ borderBottom: "1px solid hsl(var(--border) / 0.4)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "hsl(var(--muted) / 0.4)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            {d.devAvatar ? (
                              <img src={d.devAvatar} alt={d.devName} className="h-6 w-6 rounded-full object-cover" />
                            ) : (
                              <div className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                                style={{ background: "rgba(11,188,175,0.15)", color: "#0bbcaf" }}>
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
                            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${d.totalHUs > 0 ? Math.round((d.doneHUs / d.totalHUs) * 100) : 0}%`,
                                  background: "#16a34a",
                                }}
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

              {/* Controles de paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid hsl(var(--border) / 0.5)" }}>
                  <span className="text-[11px] text-muted-foreground">
                    Página {currentPage + 1} de {totalPages}
                    <span className="ml-1 text-muted-foreground/60">({filteredDevMetrics.length} analistas)</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-6 w-6"
                      disabled={currentPage === 0}
                      onClick={() => setCurrentPage(p => p - 1)}
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-6 w-6"
                      disabled={currentPage >= totalPages - 1}
                      onClick={() => setCurrentPage(p => p + 1)}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
