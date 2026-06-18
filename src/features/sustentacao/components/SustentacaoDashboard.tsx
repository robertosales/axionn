import { useState, useMemo, useRef, useEffect, type ElementType } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemandasPaginadas } from "../hooks/useDemandasPaginadas";
import { useProjetos } from "../hooks/useProjetos";
import { useKpisSustentacao } from "../hooks/useKpisSustentacao";
import { SITUACAO_LABELS } from "../types/demanda";
import { formatHours } from "../utils/kpiCalculations";
import { SkeletonList } from "@/shared/components/common/SkeletonList";
import { ImrDashboard } from "./ImrDashboard";
import { MetricasFilterBar, FILTROS_DEFAULT } from "./MetricasFilterBar";
import type { MetricasFiltros } from "./MetricasFilterBar";
import { useAuth } from "@/contexts/AuthContext";
import { SLADashboardSection } from "./SLADashboardSection";
import { useTeamContract } from "@/features/contracts/hooks/useContractSla";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  BarChart3,
  TrendingUp,
  Timer,
  Zap,
  Target,
  Activity,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

const SEVERITY_ORDER = ["bloqueada", "aguardando_retorno"] as const;

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function LazySection({ children, placeholder }: { children: React.ReactNode; placeholder?: React.ReactNode }) {
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

export function SustentacaoDashboard() {
  const [filtros, setFiltros] = useState<MetricasFiltros>(FILTROS_DEFAULT);
  const { user, currentTeamId, getModuleRole } = useAuth();
  const isContractAdmin = getModuleRole("sustentacao") === "admin_contrato";

  // Busca contrato do time para auto-seleção (se não for admin de contrato)
  const { data: teamContract } = useTeamContract(currentTeamId);

  useEffect(() => {
    if (!isContractAdmin && teamContract?.contract_id && filtros.contract_id === "all") {
      setFiltros(prev => ({ ...prev, contract_id: teamContract.contract_id }));
    }
  }, [isContractAdmin, teamContract, filtros.contract_id]);

  // contract_id vindo do filtro — alimenta o SLADashboardSection
  const contractId = filtros.contract_id !== "all" ? filtros.contract_id : null;

  const firstName = useMemo(() => {
    const full: string =
      user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "";
    return capitalizeFirst(full.split(" ")[0] ?? "");
  }, [user]);

  const { atendimento, tempos, loading: kpisLoading } =
    useKpisSustentacao(filtros.periodo === "all" ? 30 : parseInt(filtros.periodo));

  const { demandas, loading: demandasLoading } = useDemandasPaginadas();
  const { projetos } = useProjetos();

  const filtered = useMemo(() => {
    let items = demandas;
    if (filtros.projeto     !== "all") items = items.filter((d) => d.projeto === filtros.projeto);
    if (filtros.contract_id !== "all") items = items.filter((d) => d.contract_id === filtros.contract_id);
    if (filtros.periodo     !== "all") {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(filtros.periodo));
      items = items.filter((d) => new Date(d.created_at) >= cutoff);
    }
    if (filtros.situacao !== "all") items = items.filter((d) => d.situacao === filtros.situacao);
    if (filtros.membro   !== "all") {
      items = items.filter((d) => {
        const lista = (d as Demanda & { responsaveis_list?: { nome: string }[] }).responsaveis_list as { nome: string }[] | undefined;
        if (lista?.length) return lista.some((r) => r.nome === filtros.membro);
        return [d.responsavel_dev, d.responsavel_requisitos,
                d.responsavel_arquiteto, d.responsavel_teste].includes(filtros.membro);
      });
    }
    return items;
  }, [demandas, filtros]);

  const porSituacao = useMemo(() => {
    const acc: Record<string, number> = {};
    filtered.forEach((d) => { acc[d.situacao] = (acc[d.situacao] || 0) + 1; });
    return Object.entries(acc).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const alertasOperacionais = useMemo(() =>
    filtered
      .filter((d) => d.situacao === "bloqueada" || d.situacao === "aguardando_retorno")
      .sort((a, b) => {
        const oa = SEVERITY_ORDER.indexOf(a.situacao as "bloqueada" | "aguardando_retorno");
        const ob = SEVERITY_ORDER.indexOf(b.situacao as "bloqueada" | "aguardando_retorno");
        if (oa !== ob) return oa - ob;
        return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      })
      .map((d) => ({ id: d.id, rhm: d.rhm, projeto: d.projeto, situacao: d.situacao, updatedAt: d.updated_at })),
    [filtered],
  );

  const maxCount = Math.max(...porSituacao.map(([, c]) => c), 1);

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {getGreeting()}{firstName ? `, ${firstName}` : ""} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">{capitalizeFirst(getFormattedDate())}</p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card px-4 py-3">
        <MetricasFilterBar
          filtros={filtros}
          onChange={setFiltros}
          demandas={demandas}
          projetos={projetos}
          totalFiltrado={filtered.length}
        />
      </div>

      <Section title="Atendimento e Volume">
        {kpisLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard icon={FileText}     label="Chamados Ativos"  value={atendimento.total}          color="info" />
            <KPICard icon={Zap}          label="Abertos Hoje"     value={atendimento.abertosHoje}    color="info" />
            <KPICard icon={CheckCircle2} label="Resolvidos Hoje"  value={atendimento.resolvidosHoje} color="info" />
            <KPICard icon={Activity}     label={`Backlog (>${atendimento.backlogDias}d)`} value={atendimento.backlog} color={atendimento.backlog > 0 ? "destructive" : "muted"} />
          </div>
        )}
      </Section>

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

      {/* Fase 6: SLA dinâmico — ativado quando usuário filtra por contrato */}
      <Section title="SLA por Contrato">
        <SLADashboardSection contractId={contractId} />
      </Section>

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
                Alertas Operacionais
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
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
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Separator />

      <LazySection><ImrDashboard /></LazySection>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{title}</h3>
      {children}
    </div>
  );
}

function AlertRow({ icon: Icon, iconClass, borderClass, title, sub, badge }: {
  icon: React.ElementType; iconClass: string; borderClass: string; title: string; sub: string; badge?: string;
}) {
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border ${borderClass}`}>
      <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{title}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
      </div>
      {badge && <span className="text-[10px] font-bold text-destructive bg-destructive/10 rounded px-1.5 py-0.5 shrink-0">{badge}</span>}
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
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
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
