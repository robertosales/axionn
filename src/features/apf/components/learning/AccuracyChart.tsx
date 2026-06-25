/**
 * AccuracyChart
 * --------------
 * Gráfico de linha simples (SVG inline) mostrando a evolução
 * semanal da acurácia e o impacto do RAG ao longo do tempo.
 * Sem dependências externas de charting — leve e sem overhead.
 */
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LearningMetric } from "../../services/knowledge.service";

interface Props {
  metrics: LearningMetric[];
  loading: boolean;
}

function polyline(points: { x: number; y: number }[], W: number, H: number, pad: number): string {
  return points
    .map((p) => `${pad + (p.x / (points.length - 1)) * (W - pad * 2)},${pad + (1 - p.y) * (H - pad * 2)}`)
    .join(" ");
}

export function AccuracyChart({ metrics, loading }: Props) {
  if (loading) {
    return (
      <Card className="border border-border">
        <CardContent className="p-4"><Skeleton className="h-40" /></CardContent>
      </Card>
    );
  }

  if (metrics.length < 2) {
    return (
      <Card className="border border-dashed border-border">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Dados insuficientes para o gráfico — são necessárias pelo menos 2 semanas de validações.
        </CardContent>
      </Card>
    );
  }

  const W = 600; const H = 140; const pad = 20;
  const acc    = metrics.map((m) => ({ x: metrics.indexOf(m), y: (m.accuracy_rate ?? 0) / 100 }));
  const ragWith = metrics
    .map((m, i) => m.rag_accuracy_with != null ? { x: i, y: m.rag_accuracy_with / 100 } : null)
    .filter(Boolean) as { x: number; y: number }[];

  const labels = metrics.map((m) => {
    const d = new Date(m.week_start);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  return (
    <Card className="border border-border">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Evolução da Acurácia APF
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true">
          {/* Grid horizontal */}
          {[0, 0.25, 0.5, 0.75, 1].map((v) => {
            const y = pad + (1 - v) * (H - pad * 2);
            return (
              <g key={v}>
                <line x1={pad} y1={y} x2={W - pad} y2={y} stroke="currentColor" strokeOpacity={0.08} strokeWidth={1} />
                <text x={pad - 4} y={y + 4} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.4}>
                  {Math.round(v * 100)}%
                </text>
              </g>
            );
          })}

          {/* Linha RAG (tracejada) */}
          {ragWith.length >= 2 && (
            <polyline
              points={polyline(ragWith, W, H, pad)}
              fill="none"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="5 3"
              opacity={0.7}
            />
          )}

          {/* Linha acurácia geral */}
          <polyline
            points={polyline(acc, W, H, pad)}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
          />

          {/* Pontos */}
          {acc.map((p, i) => (
            <circle
              key={i}
              cx={pad + (p.x / (acc.length - 1)) * (W - pad * 2)}
              cy={pad + (1 - p.y) * (H - pad * 2)}
              r={4}
              fill="hsl(var(--primary))"
            >
              <title>{labels[i]}: {Math.round(p.y * 100)}%</title>
            </circle>
          ))}

          {/* Labels eixo X */}
          {labels.map((label, i) => (
            <text
              key={i}
              x={pad + (i / (labels.length - 1)) * (W - pad * 2)}
              y={H - 2}
              textAnchor="middle"
              fontSize={9}
              fill="currentColor"
              opacity={0.4}
            >
              {label}
            </text>
          ))}
        </svg>

        {/* Legenda */}
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 bg-primary rounded" />
            Acurácia geral
          </span>
          {ragWith.length >= 2 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-5 bg-emerald-500 rounded" style={{ borderBottom: "2px dashed #10b981", background: "transparent" }} />
              Com RAG
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
