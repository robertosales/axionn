import { useMemo } from "react";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import type { TeamComparativo } from "../hooks/useSprintHistory";

interface Props { comparativo: TeamComparativo[]; }

const COLORS = ["#6366f1", "#2563eb", "#10b981", "#f97316", "#ef4444", "#8b5cf6"];

export function TeamComparativoChart({ comparativo }: Props) {
  const barData = useMemo(() => comparativo.map(t => ({
    time:            t.teamName.length > 12 ? t.teamName.slice(0, 12) + "…" : t.teamName,
    "Velocity média": t.avgVelocity,
    "Taxa conclusão": t.avgTaxaConclusao,
    "Sprints":        t.totalSprints,
    "Impedimentos":   t.totalImpedimentos,
  })), [comparativo]);

  if (comparativo.length === 0) return null;

  return (
    <div className="space-y-6">
      <h4 className="text-sm font-semibold">Comparativo entre Times</h4>

      {/* Barras agrupadas */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-[11px] text-muted-foreground mb-3">Velocity média & Taxa de conclusão média (%)</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={barData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="Velocity média"  fill="#6366f1" radius={[4,4,0,0]} maxBarSize={36} />
            <Bar dataKey="Taxa conclusão" fill="#10b981" radius={[4,4,0,0]} maxBarSize={36} />
            <Bar dataKey="Impedimentos"   fill="#f97316" radius={[4,4,0,0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cards resumo por time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {comparativo.map((t, i) => (
          <div key={t.teamId} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="text-sm font-semibold truncate">{t.teamName}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-muted-foreground">Sprints</span>        <span className="font-semibold text-right">{t.totalSprints}</span>
              <span className="text-muted-foreground">Velocity méd.</span>  <span className="font-semibold text-right">{t.avgVelocity} pts</span>
              <span className="text-muted-foreground">Conclusão méd.</span> <span className="font-semibold text-right">{t.avgTaxaConclusao}%</span>
              <span className="text-muted-foreground">Desvio hrs méd.</span><span className={`font-semibold text-right ${ t.avgDesvioHoras > 4 ? "text-destructive" : t.avgDesvioHoras < 0 ? "text-emerald-600" : ""}`}>{t.avgDesvioHoras > 0 ? "+" : ""}{t.avgDesvioHoras}h</span>
              <span className="text-muted-foreground">Impedimentos</span>  <span className={`font-semibold text-right ${t.totalImpedimentos > 5 ? "text-destructive" : ""}`}>{t.totalImpedimentos}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
