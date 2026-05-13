import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, AlertTriangle, CheckCircle2, List } from "lucide-react";
import type { AdminKpis } from "../hooks/useAdminKpis";

interface Props { kpis: AdminKpis["global"]; sprintAtivo?: string | null; }

function KpiCard({ label, value, sub, icon, status }: { label: string; value: string | number; sub?: string; icon: React.ReactNode; status?: "good" | "warning" | "danger" | "neutral"; }) {
  const cls = status === "good" ? "text-emerald-600" : status === "warning" ? "text-orange-500" : status === "danger" ? "text-destructive" : "text-primary";
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

export function SalaAgilKpis({ kpis, sprintAtivo }: Props) {
  const progresso = kpis.totalHUs > 0 ? Math.round((kpis.husConcluidasAtivas / kpis.totalHUs) * 100) : 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Sala Ágil</h3>
        {sprintAtivo ? <Badge variant="default" className="text-[10px]">{sprintAtivo}</Badge> : <Badge variant="secondary" className="text-[10px]">Nenhum sprint ativo</Badge>}
        <Badge variant="outline" className="text-[10px]">{kpis.timesSalaAgil} time{kpis.timesSalaAgil !== 1 ? "s" : ""}</Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="HUs Ativas"   value={kpis.totalHUs}           sub={`${progresso}% concluídas`}          icon={<List          className="h-5 w-5" />} status="neutral" />
        <KpiCard label="Concluídas"   value={kpis.husConcluidasAtivas} sub={`${kpis.velocityPontos} pts velocity`} icon={<CheckCircle2  className="h-5 w-5" />} status="good" />
        <KpiCard label="Impedimentos" value={kpis.impedimentosAbertos} sub="abertos agora"                        icon={<AlertTriangle className="h-5 w-5" />} status={kpis.impedimentosAbertos > 3 ? "danger" : kpis.impedimentosAbertos > 0 ? "warning" : "good"} />
        <KpiCard label="Backlog"      value={kpis.backlogTotal}        sub="HUs sem sprint"                      icon={<List          className="h-5 w-5" />} status={kpis.backlogTotal > 20 ? "warning" : "neutral"} />
      </div>
    </div>
  );
}
