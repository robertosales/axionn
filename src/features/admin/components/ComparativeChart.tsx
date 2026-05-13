import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { AdminKpis } from "../hooks/useAdminKpis";

interface Props { byTeam: AdminKpis["byTeam"]; selectedTeam: string; }

export function ComparativeChart({ byTeam, selectedTeam }: Props) {
  const data = useMemo(() => {
    const shown = selectedTeam === "all" ? byTeam : byTeam.filter(t => t.teamId === selectedTeam);
    return shown.map(t => ({
      nome:              t.teamName,
      "HUs Concluídas":  t.husConcluidasNoSprint,
      "Dem. Concluídas": t.demandasConcluidas,
      "SLA em Risco":    t.slaEmRisco,
      "Impedimentos":    t.impedimentosAbertos,
    }));
  }, [byTeam, selectedTeam]);

  if (data.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Desempenho por Time</h3>
      <div className="rounded-xl border border-border bg-card p-4">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="HUs Concluídas"  fill="#6366f1" radius={[4,4,0,0]} maxBarSize={32} />
            <Bar dataKey="Dem. Concluídas" fill="#2563eb" radius={[4,4,0,0]} maxBarSize={32} />
            <Bar dataKey="SLA em Risco"    fill="#ef4444" radius={[4,4,0,0]} maxBarSize={32} />
            <Bar dataKey="Impedimentos"    fill="#f97316" radius={[4,4,0,0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
