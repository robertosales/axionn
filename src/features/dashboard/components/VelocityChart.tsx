import type { SprintMetrics } from "../hooks/useDashboardData";

interface Props { sprints: SprintMetrics[]; }

export function VelocityChart({ sprints }: Props) {
  if (sprints.length === 0) return (
    <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">Sem dados.</div>
  );

  const maxPts = Math.max(...sprints.map(s => Math.max(s.totalPoints, s.donePoints)), 1);
  const H = 120;
  const barW = 14;
  const gap  = 6;
  const padL = 28;
  const padB = 20;
  const padT = 8;
  const chartH = H - padB - padT;
  const totalW = padL + sprints.length * (barW * 2 + gap + 8) + 8;

  return (
    <svg viewBox={`0 0 ${totalW} ${H}`} className="w-full" style={{ height: H }}>
      {/* Grid */}
      {[0, Math.round(maxPts / 2), maxPts].map(v => {
        const y = padT + chartH - (v / maxPts) * chartH;
        return (
          <g key={v}>
            <line x1={padL} x2={totalW - 4} y1={y} y2={y}
              stroke="currentColor" strokeOpacity={0.08} strokeWidth={0.5} />
            <text x={padL - 3} y={y + 3} textAnchor="end" fontSize={4} fill="currentColor" fillOpacity={0.4}>{v}</text>
          </g>
        );
      })}

      {sprints.map((s, i) => {
        const x       = padL + i * (barW * 2 + gap + 8);
        const totalH  = (s.totalPoints / maxPts) * chartH;
        const doneH   = (s.donePoints  / maxPts) * chartH;
        const shortName = s.sprintName.replace(/sprint\s*/i, "").slice(0, 6);
        return (
          <g key={s.sprintId}>
            {/* Barra total */}
            <rect x={x} y={padT + chartH - totalH} width={barW} height={totalH}
              rx={2} fill="#6366f1" fillOpacity={0.25} />
            {/* Barra concluída */}
            <rect x={x + barW + 2} y={padT + chartH - doneH} width={barW} height={doneH}
              rx={2} fill="#34d399" fillOpacity={0.8} />
            {/* Label */}
            <text x={x + barW} y={H - 4} textAnchor="middle" fontSize={3.5}
              fill="currentColor" fillOpacity={0.45}>{shortName}</text>
          </g>
        );
      })}

      {/* Legenda */}
      <g transform={`translate(${padL}, ${padT})`}>
        <rect x={0} y={0} width={5} height={5} rx={1} fill="#6366f1" fillOpacity={0.25} />
        <text x={7} y={4.5} fontSize={3} fill="currentColor" fillOpacity={0.5}>Total</text>
        <rect x={20} y={0} width={5} height={5} rx={1} fill="#34d399" fillOpacity={0.8} />
        <text x={27} y={4.5} fontSize={3} fill="currentColor" fillOpacity={0.5}>Concluído</text>
      </g>
    </svg>
  );
}
