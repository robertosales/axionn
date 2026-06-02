import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { SprintMetrics } from "../hooks/useSprintHistory";

interface Props {
  metrics: SprintMetrics[];
  onSelect: (m: SprintMetrics) => void;
}

function DesvioIcon({ v }: { v: number }) {
  if (v > 4)  return <TrendingUp   className="h-3.5 w-3.5 text-destructive inline" />;
  if (v < -4) return <TrendingDown className="h-3.5 w-3.5 text-emerald-600 inline" />;
  return        <Minus className="h-3.5 w-3.5 text-muted-foreground inline" />;
}

export function SprintHistoryTable({ metrics, onSelect }: Props) {
  return (
    <div className="rounded-lg border border-border overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
            <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2">Sprint</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2">Time</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2 text-center">HUs</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2 text-center">Conclusão</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2 text-center">Velocity</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2 text-center">Hrs Plan.</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2 text-center">Hrs Real.</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2 text-center">Desvio</TableHead>
            <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2 text-center">Impedit.</TableHead>
            <TableHead className="py-2" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {metrics.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-xs text-muted-foreground py-12">
                Nenhum sprint encerrado encontrado.
              </TableCell>
            </TableRow>
          )}
          {metrics.map(m => (
            <TableRow
              key={m.sprintId}
              className="hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => onSelect(m)}
            >
              {/* Sprint */}
              <TableCell className="py-2">
                <div className="text-xs font-semibold">{m.sprintName}</div>
                <div className="text-[10px] text-muted-foreground">
                  {new Date(m.startDate).toLocaleDateString("pt-BR")} → {new Date(m.endDate).toLocaleDateString("pt-BR")} · {m.durationDays}d
                </div>
              </TableCell>

              {/* Time */}
              <TableCell className="py-2 text-xs">{m.teamName}</TableCell>

              {/* HUs */}
              <TableCell className="py-2 text-xs text-center">{m.husConcluidadas}/{m.totalHUs}</TableCell>

              {/* Conclusão */}
              <TableCell className="py-2 text-center">
                <Badge
                  variant={m.taxaConclusao >= 80 ? "default" : m.taxaConclusao >= 50 ? "secondary" : "destructive"}
                  className="text-[9px] px-1.5 py-0"
                >
                  {m.taxaConclusao}%
                </Badge>
              </TableCell>

              {/* Velocity */}
              <TableCell className="py-2 text-xs font-semibold text-center">{m.velocityPontos}</TableCell>

              {/* Hrs Plan. */}
              <TableCell className="py-2 text-xs text-muted-foreground text-center">{m.horasPlanejadas}h</TableCell>

              {/* Hrs Real. */}
              <TableCell className="py-2 text-xs text-center">{m.horasRealizadas}h</TableCell>

              {/* Desvio */}
              <TableCell className="py-2 text-center">
                <span className={`text-xs font-medium flex items-center justify-center gap-1 ${
                  m.desvioHoras > 4  ? "text-destructive"   :
                  m.desvioHoras < -4 ? "text-emerald-600"   : "text-muted-foreground"
                }`}>
                  <DesvioIcon v={m.desvioHoras} />
                  {m.desvioHoras > 0 ? "+" : ""}{m.desvioHoras}h
                </span>
              </TableCell>

              {/* Impedit. */}
              <TableCell className="py-2 text-center">
                <Badge
                  variant={m.impedimentos > 2 ? "destructive" : m.impedimentos > 0 ? "secondary" : "outline"}
                  className="text-[9px] px-1.5 py-0"
                >
                  {m.impedimentos}
                </Badge>
              </TableCell>

              {/* Chevron */}
              <TableCell className="py-2">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
