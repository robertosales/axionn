import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { SprintMetrics } from "../hooks/useSprintHistory";

interface Props { metrics: SprintMetrics[]; }

export function VelocityChart({ metrics }: Props) {
  const data = useMemo(() => {
    return [...metrics]
      .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
      .map(m => ({
        sprint:       m.sprintName.length > 14 ? m.sprintName.slice(0, 14) + "…" : m.sprintName,
        "Velocity":   m.velocityPontos,
        "Conclusão %": m.taxaConclusao,
        "Desvio Hrs":  m.desvioHoras,
      }));
  }, [metrics]);

  if (data.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold">Velocity & Conclusão por Sprint</h4>
      <div className="rounded-xl border border-border bg-card p-4">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="left"  tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Line yAxisId="left"  type="monotone" dataKey="Velocity"    stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            <Line yAxisId="right" type="monotone" dataKey="Conclusão %" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
