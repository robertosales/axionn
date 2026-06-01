import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemandas } from "../hooks/useDemandas";
import { useProjetos } from "../hooks/useProjetos";
import { useKpisSustentacao } from "../hooks/useKpisSustentacao";
import { SITUACAO_LABELS } from "../types/demanda";
import { formatHours } from "../utils/kpiCalculations";
import { SkeletonList } from "@/shared/components/common/SkeletonList";
import { ImrDashboard } from "./ImrDashboard";
import { MetricasFilterBar, FILTROS_DEFAULT } from "./MetricasFilterBar";
import type { MetricasFiltros } from "./MetricasFilterBar";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  BarChart3,
  TrendingUp,
  Shield,
  Timer,
  Zap,
  Target,
  Activity,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

const SEVERITY_ORDER = ["bloqueada", "aguardando_retorno"] as const;

// ─── LazySection ─────────────────────────────────────────────────────────────
function LazySection({ children, placeholder }: {
  children: React.ReactNode;
  placeholder?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{visible ? children : (placeholder ?? <SkeletonList count={2} />)}</div>;
}

// ─── SustentacaoDashboard ──────────────────────────────────────────────────────
export function SustentacaoDashboard() {
  const [filtros, setFiltros] = useState<MetricasFiltros>(FILTROS_DEFAULT);

  // P2-fix: os dois fetches rodam em paralelo — nenhum bloqueia o outro
  const {
    atendimento,
    tempos,
    sla,
    loading: kpisLoading,
  } = useKpisSustentacao(filtros.periodo === "all" ? 30 : parseInt(filtros.periodo));

  const { demandas, loading: demandasLoading } = useDemandas();
  const { projetos } = useProjetos();

  const filtered = useMemo(() => {
    let items = demandas;
    if (filtros.projeto !== "all")
      items = items.filter((d) => d.projeto === filtros.projeto);
    if (filtros.periodo !== "all") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(filtros.periodo));
      items = items.filter((d) => new Date(d.created_at) >= cutoff);
    }
    if (filtros.situacao !== "all")
      items = items.filter((d) => d.situacao === filtros.situacao);
    if (filtros.membro !== "all") {
      items = items.filter((d) => {
        const lista = (d as any).responsaveis_list as { nome: string }[] | undefined;
        if (lista && lista.length > 0) return lista.some((r) => r.nome === filtros.membro);
        return [
          (d as any).responsavel_dev,
          (d as any).responsavel_requisitos,
          (d as any).responsavel_arquiteto,
          (d as any).responsavel_teste,
        ].includes(filtros.membro);
      });
    }
    return items;
  }, [demandas, filtros]);

  const porSituacao = useMemo(() => {
    const acc: Record<string, number> = {};
    filtered.forEach((d) => { acc[d.situacao] = (acc[d.situacao] || 0) + 1; });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const alertasOperacionais = useMemo(
    () =>
      filtered
        .filter((d) => d.situacao === "bloqueada" || d.situacao === "aguardando_retorno")
        .sort((a, b) => {
          const oa = SEVERITY_ORDER.indexOf(a.situacao as any);
          const ob = SEVERITY_ORDER.indexOf(b.situacao as any);
          if (oa !== ob) return oa - ob;
          return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        })
        .map((d) => ({ id: d.id, rhm: d.rhm, projeto: d.projeto, situacao: d.situacao, updatedAt: d.updated_at })),
    [filtered],
  );

  const alertasSLA = useMemo(
    () =>
      filtered
        .filter((d) => (d as any).sla_violado || (d as any).sla_em_risco)
        .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
        .map((d) => ({
          id: d.id, rhm: d.rhm, projeto: d.projeto, situacao: d.situacao, updatedAt: d.updated_at,
          diasAtraso: Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86400000),
        })),
    [filtered],
  );

  const maxCount = Math.max(...porSituacao.map(([, c]) => c), 1);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div>
        <h2 className="text-lg font-semibold">Dashboard Sustentação</h2>
        <p className="text-sm text-muted-foreground">Visão consolidada de KPIs e alertas</p>
      </div>

      {/* ── Filter Bar: aguarda demandas para popular filtros de projeto/membro ── */}
      <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
        <MetricasFilterBar
          filtros={filtros}
          onChange={setFiltros}
          demandas={demandas}
          projetos={projetos}
          totalFiltrado={filtered.length}
        />
      </div>

      {/* ── Atendimento e Volume ──
          P2-fix: renderiza assim que kpisLoading=false.
          Não espera demandasLoading. */}
      <Section title="Atendimento e Volume">
        {kpisLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard icon={FileText}    label="Chamados Ativos"  value={atendimento.total}          color="info" />
            <KPICard icon={Zap}         label="Abertos Hoje"     value={atendimento.abertosHoje}    color="info" />
            <KPICard icon={CheckCircle2} label="Resolvidos Hoje" value={atendimento.resolvidosHoje} color="info" />
            <KPICard
              icon={Activity}
              label={`Backlog (>${atendimento.backlogDias}d)`}
              value={atendimento.backlog}
              color={atendimento.backlog > 0 ? "destructive" : "muted"}
            />
          </div>
        )}
      </Section>

      {/* ── Tempos Médios ── */}
      <Section title="Tempos Médios">
        {kpisLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard icon={Timer}      label="TMR (Resposta)"    value={formatHours(tempos.tmr)}  sub={`${tempos.tmrCount} chamados`}   color="info" />
            <KPICard icon={Clock}      label="MTTR (Resolução)"  value={formatHours(tempos.mttr)} sub={`${tempos.mttrCount} resolvidos`} color={tempos.mttr > 4 ? "destructive" : "info"} />
            <KPICard icon={TrendingUp} label="TMA (Atendimento)" value={formatHours(tempos.tma)}  color="info" />
            <KPICard icon={Target}     label="MTTA (Reconhec.)"  value={formatHours(tempos.mtta)} sub={`${tempos.mttaCount} chamados`}   color="info" />
          </div>
        )}
      </Section>

      {/* ── SLA ── */}
      <Section title="SLA">
        {kpisLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KPICard
              icon={Shield}
              label="SLA Compliance"
              value={sla.total === 0 ? "N/A" : `${sla.compliance.toFixed(1)}%`}
              color={sla.total === 0 ? "muted" : sla.compliance >= 95 ? "info" : "destructive"}
              sub={sla.total === 0 ? "Sem demandas" : "Meta: ≥ 95%"}
            />
            <KPICard icon={AlertTriangle} label="Em Risco"    value={sla.emRisco}  color={sla.emRisco > 0 ? "destructive" : "muted"} sub="< 2h restantes" />
            <KPICard icon={AlertTriangle} label="SLA Violado" value={sla.violados} color={sla.violados > 0 ? "destructive" : "muted"} />
          </div>
        )}
      </Section>

      {/* ── Situação + Alertas ──
          P2-fix: esta seção depende da lista de demandas — mostra skeleton
          apenas enquanto demandasLoading=true, independentemente dos KPIs. */}
      {demandasLoading ? (
        <SkeletonList count={3} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-info" />
                Demandas por Situação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {porSituacao.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma demanda</p>}
              {porSituacao.map(([sit, count]) => (
                <div key={sit} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{SITUACAO_LABELS[sit] || sit}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-info transition-all" style={{ width: `${(count / maxCount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3 flex flex-col" style={{ height: "420px" }}>
            <CardHeader className="pb-2 shrink-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Alertas
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 flex-1 flex flex-col min-h-0">
              <Tabs defaultValue="operacional" className="flex flex-col flex-1 min-h-0">
                <TabsList className="w-full h-8 shrink-0 mb-2">
                  <TabsTrigger value="operacional" className="flex-1 text-xs gap-1.5">
                    Operacional
                    {alertasOperacionais.length > 0 && (
                      <Badge variant="destructive" className="h-4 px-1.5 text-[10px] leading-none">{alertasOperacionais.length}</Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="sla" className="flex-1 text-xs gap-1.5">
                    SLA (E8)
                    {alertasSLA.length > 0 && (
                      <Badge variant="destructive" className="h-4 px-1.5 text-[10px] leading-none">{alertasSLA.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="operacional" className="mt-0 flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-muted">
                  {alertasOperacionais.length === 0 ? <EmptyAlerts /> : (
                    alertasOperacionais.map((a) => {
                      const isBlocked = a.situacao === "bloqueada";
                      const hoursAgo = Math.round((Date.now() - new Date(a.updatedAt).getTime()) / 3_600_000);
                      return (
                        <AlertRow
                          key={a.id}
                          icon={isBlocked ? AlertTriangle : Clock}
                          iconClass={isBlocked ? "text-destructive" : "text-orange-500"}
                          borderClass={isBlocked ? "border-destructive/30 bg-destructive/5" : "border-orange-400/30 bg-orange-50 dark:bg-orange-950/20"}
                          title={a.rhm}
                          sub={`${isBlocked ? "Bloqueada" : "Aguardando retorno"} há ${hoursAgo}h · ${a.projeto}`}
                        />
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="sla" className="mt-0 flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-muted">
                  {alertasSLA.length === 0 ? <EmptyAlerts /> : (
                    <>
                      <div className="flex items-center justify-between px-1 pb-1 border-b border-border/40">
                        <span className="text-[11px] text-muted-foreground">
                          <span className="text-destructive font-semibold">{alertasSLA.length}</span> demanda{alertasSLA.length > 1 ? "s" : ""} com SLA violado
                        </span>
                        <span className="text-[11px] text-destructive font-medium">
                          Glosa acumulada: {(alertasSLA.length * 0.2).toFixed(1)}%
                        </span>
                      </div>
                      {alertasSLA.map((a) => (
                        <AlertRow key={a.id} icon={AlertTriangle} iconClass="text-destructive"
                          borderClass="border-destructive/20 bg-destructive/5"
                          title={`${a.rhm} — ${a.projeto}`}
                          sub={`${a.diasAtraso} dias de atraso · Glosa 0,2%`}
                          badge={`${a.diasAtraso}d`}
                        />
                      ))}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

      <Separator />

      {/* ── IMR: lazy mount via IntersectionObserver ── */}
      <LazySection>
        <ImrDashboard />
      </LazySection>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function AlertRow({ icon: Icon, iconClass, borderClass, title, sub, badge }: {
  icon: any; iconClass: string; borderClass: string; title: string; sub: string; badge?: string;
}) {
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border ${borderClass}`}>
      <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{title}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
      {badge && (
        <span className="text-[10px] font-bold text-destructive bg-destructive/10 rounded px-1.5 py-0.5 shrink-0">{badge}</span>
      )}
    </div>
  );
}

function EmptyAlerts() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-8">
      <CheckCircle2 className="h-8 w-8 text-info mb-2" />
      <p className="text-sm text-muted-foreground">Nenhum alerta no momento</p>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub?: string; color: string;
}) {
  const colorMap: Record<string, string> = {
    info:        "bg-info/10 text-info",
    destructive: "bg-destructive/10 text-destructive",
    muted:       "bg-muted text-muted-foreground",
  };
  const borderMap: Record<string, string> = { destructive: "border-destructive/30" };
  return (
    <Card className={borderMap[color] || ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.muted}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
