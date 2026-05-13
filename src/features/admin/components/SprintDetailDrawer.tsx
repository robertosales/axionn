import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, Minus, Target, Clock, Users, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import type { SprintMetrics } from "../hooks/useSprintHistory";

interface Props { sprint: SprintMetrics | null; onClose: () => void; }

function Stat({ label, value, sub, highlight }: { label: string; value: string | number; sub?: string; highlight?: "good" | "bad" | "warn" }) {
  const cls = highlight === "good" ? "text-emerald-600" : highlight === "bad" ? "text-destructive" : highlight === "warn" ? "text-orange-500" : "";
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={`text-lg font-bold ${cls}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function SprintDetailDrawer({ sprint, onClose }: Props) {
  if (!sprint) return null;

  const devChartData = sprint.devStats.map(d => ({
    nome:      d.developerName.split(" ")[0],
    "HUs":     d.husCount,
    "Hrs Est.": d.estimatedHours,
    "Hrs Real.": d.realizedHours,
  }));

  return (
    <Sheet open={!!sprint} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-base">{sprint.sprintName}</SheetTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px]">{sprint.teamName}</Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(sprint.startDate).toLocaleDateString("pt-BR")} → {new Date(sprint.endDate).toLocaleDateString("pt-BR")} · {sprint.durationDays} dias
            </span>
          </div>
          {sprint.goal && <p className="text-xs text-muted-foreground italic mt-1">🎯 {sprint.goal}</p>}
        </SheetHeader>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <Stat label="HUs"        value={`${sprint.husConcluidadas}/${sprint.totalHUs}`} sub="concluídas" />
          <Stat label="Velocity"   value={`${sprint.velocityPontos} pts`} highlight={sprint.velocityPontos > 0 ? "good" : undefined} />
          <Stat label="Conclusão" value={`${sprint.taxaConclusao}%`} highlight={sprint.taxaConclusao >= 80 ? "good" : sprint.taxaConclusao < 50 ? "bad" : "warn"} />
          <Stat label="Impediment." value={sprint.impedimentos} highlight={sprint.impedimentos > 3 ? "bad" : sprint.impedimentos > 0 ? "warn" : "good"} />
        </div>

        {/* Progress conclusão */}
        <div className="space-y-1 mb-4">
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>Progresso do sprint</span><span>{sprint.taxaConclusao}%</span>
          </div>
          <Progress value={sprint.taxaConclusao} className="h-2" />
        </div>

        <Separator className="my-4" />

        {/* Horas */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Stat label="Hrs Planejadas" value={`${sprint.horasPlanejadas}h`} />
          <Stat label="Hrs Realizadas" value={`${sprint.horasRealizadas}h`} />
          <Stat
            label="Desvio"
            value={`${sprint.desvioHoras > 0 ? "+" : ""}${sprint.desvioHoras}h`}
            highlight={sprint.desvioHoras > 8 ? "bad" : sprint.desvioHoras < -4 ? "good" : undefined}
          />
        </div>

        <Separator className="my-4" />

        {/* Gráfico por dev */}
        {devChartData.length > 0 && (
          <div className="space-y-2 mb-4">
            <h4 className="text-sm font-semibold flex items-center gap-1.5"><Users className="h-4 w-4" /> Carga por Desenvolvedor</h4>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={devChartData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="HUs"      fill="#6366f1" radius={[3,3,0,0]} maxBarSize={24} />
                <Bar dataKey="Hrs Est." fill="#94a3b8" radius={[3,3,0,0]} maxBarSize={24} />
                <Bar dataKey="Hrs Real."fill="#10b981" radius={[3,3,0,0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Lista de devs */}
        {sprint.devStats.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Detalhes por Desenvolvedor</h4>
            <div className="space-y-1">
              {sprint.devStats.map(d => (
                <div key={d.developerId} className="flex items-center justify-between text-xs py-1.5 border-b border-border/50 last:border-0">
                  <span className="font-medium">{d.developerName}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{d.husCount} HU{d.husCount !== 1 ? "s" : ""}</span>
                    <span>{d.estimatedHours}h est.</span>
                    <span className={d.realizedHours > d.estimatedHours * 1.2 ? "text-destructive font-semibold" : ""}>{d.realizedHours}h real.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
