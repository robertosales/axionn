import type { BurndownPoint } from "../hooks/useDashboardData";

interface Props { points: BurndownPoint[]; height?: number; }

export function BurndownChart({ points, height = 180 }: Props) {
  if (points.length < 2) return (
    <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
      Dados insuficientes para o burndown.
    </div>
  );

  const maxVal = Math.max(...points.map(p => Math.max(p.remaining, p.ideal)), 1);
  const W = 100; // viewBox width (percentual)
  const H = height;
  const pad = { top: 10, right: 8, bottom: 24, left: 32 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const xScale = (i: number) => pad.left + (i / (points.length - 1)) * chartW;
  const yScale = (v: number) => pad.top + chartH - (v / maxVal) * chartH;

  const toPath = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(v).toFixed(1)}`).join(" ");

  const idealPath    = toPath(points.map(p => p.ideal));
  const remainPath   = toPath(points.map(p => p.remaining));
  // Área do real
  const areaPath = remainPath + ` L ${xScale(points.length-1).toFixed(1)} ${(pad.top + chartH).toFixed(1)} L ${pad.left.toFixed(1)} ${(pad.top + chartH).toFixed(1)} Z`;

  // Ticks do eixo Y
  const yTicks = [0, Math.round(maxVal/2), maxVal];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {/* Grid */}
      {yTicks.map(t => (
        <g key={t}>
          <line x1={pad.left} x2={W - pad.right} y1={yScale(t)} y2={yScale(t)}
            stroke="currentColor" strokeOpacity={0.08} strokeWidth={0.5} />
          <text x={pad.left - 2} y={yScale(t) + 3} textAnchor="end"
            fontSize={4} fill="currentColor" fillOpacity={0.4}>{t}</text>
        </g>
      ))}

      {/* Área real */}
      <path d={areaPath} fill="#6366f1" fillOpacity={0.12} />

      {/* Linha ideal (tracejada) */}
      <path d={idealPath} fill="none" stroke="#94a3b8" strokeWidth={0.8}
        strokeDasharray="2 1.5" strokeLinecap="round" />

      {/* Linha real */}
      <path d={remainPath} fill="none" stroke="#6366f1" strokeWidth={1.2}
        strokeLinecap="round" strokeLinejoin="round" />

      {/* Eixo X: primeiro, meio e último */}
      {[0, Math.floor((points.length-1)/2), points.length-1].map(i => (
        <text key={i} x={xScale(i)} y={H - 4} textAnchor="middle"
          fontSize={3.5} fill="currentColor" fillOpacity={0.4}>
          {points[i]?.date?.slice(5)}
        </text>
      ))}

      {/* Legenda */}
      <g transform={`translate(${W - pad.right - 32}, ${pad.top})`}>
        <line x1={0} x2={6} y1={2} y2={2} stroke="#94a3b8" strokeWidth={0.8} strokeDasharray="2 1.5" />
        <text x={8} y={4} fontSize={3} fill="currentColor" fillOpacity={0.5}>Ideal</text>
        <line x1={0} x2={6} y1={8} y2={8} stroke="#6366f1" strokeWidth={1} />
        <text x={8} y={10} fontSize={3} fill="currentColor" fillOpacity={0.5}>Real</text>
      </g>
    </svg>
  );
}
