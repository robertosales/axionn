import { Card, CardContent } from "@/components/ui/card";
import { Shield, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AdminKpis } from "../hooks/useAdminKpis";

interface Props { kpis: AdminKpis["global"]; }

function KpiCard({ label, value, sub, icon, status }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; status?: "good" | "warning" | "danger" | "neutral"; }) {
  const cls = status === "good" ? "text-emerald-600" : status === "warning" ? "text-orange-500" : status === "danger" ? "text-destructive" : "text-blue-600";
  return (
    <Card className="rounded-xl border border-border bg-card">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`mt-0.5 ${cls}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold mt-0.5 ${cls}`}>{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function SustentacaoKpis({ kpis }: Props) {
  const taxa = (kpis.demandasAbertas + kpis.demandasConcluidas) > 0
    ? Math.round((kpis.demandasConcluidas / (kpis.demandasAbertas + kpis.demandasConcluidas)) * 100) : 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-blue-600" />
        <h3 className="text-sm font-semibold">Sustentação</h3>
        <Badge variant="outline" className="text-[10px]">{kpis.timesSustentacao} time{kpis.timesSustentacao !== 1 ? "s" : ""}</Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Abertas"      value={kpis.demandasAbertas}    sub={`${taxa}% taxa resolução`} icon={<Clock         className="h-5 w-5" />} status={kpis.demandasAbertas > 30 ? "warning" : "neutral"} />
        <KpiCard label="Concluídas"   value={kpis.demandasConcluidas} sub="total acumulado"           icon={<CheckCircle2  className="h-5 w-5" />} status="good" />
        <KpiCard label="SLA em Risco" value={kpis.slaEmRisco}         sub="+5 dias sem conclusão"     icon={<AlertTriangle className="h-5 w-5" />} status={kpis.slaEmRisco > 5 ? "danger" : kpis.slaEmRisco > 0 ? "warning" : "good"} />
        <KpiCard label="Bloqueadas"   value={kpis.demandasBloqueadas} sub="aguardando ação"          icon={<AlertTriangle className="h-5 w-5" />} status={kpis.demandasBloqueadas > 0 ? "danger" : "good"} />
      </div>
    </div>
  );
}
