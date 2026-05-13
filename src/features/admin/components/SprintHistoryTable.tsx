import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { SprintMetrics } from "../hooks/useSprintHistory";

interface Props {
  metrics: SprintMetrics[];
  onSelect: (m: SprintMetrics) => void;
}

function DesvioIcon({ v }: { v: number }) {
  if (v > 4)  return <TrendingUp   className="h-3.5 w-3.5 text-destructive inline" />;
  if (v < -4) return <TrendingDown className="h-3.5 w-3.5 text-emerald-600 inline" />;
  return       <Minus className="h-3.5 w-3.5 text-muted-foreground inline" />;
}

export function SprintHistoryTable({ metrics, onSelect }: Props) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Sprint</TableHead>
            <TableHead>Time</TableHead>
            <TableHead className="text-center">HUs</TableHead>
            <TableHead className="text-center">Conclusão</TableHead>
            <TableHead className="text-center">Velocity</TableHead>
            <TableHead className="text-center">Hrs Plan.</TableHead>
            <TableHead className="text-center">Hrs Real.</TableHead>
            <TableHead className="text-center">Desvio</TableHead>
            <TableHead className="text-center">Impedit.</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {metrics.length === 0 && (
            <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-10">Nenhum sprint encerrado encontrado.</TableCell></TableRow>
          )}
          {metrics.map(m => (
            <TableRow key={m.sprintId} className="hover:bg-muted/20 cursor-pointer" onClick={() => onSelect(m)}>
              <TableCell>
                <div className="font-medium text-sm">{m.sprintName}</div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(m.startDate).toLocaleDateString("pt-BR")} → {new Date(m.endDate).toLocaleDateString("pt-BR")} · {m.durationDays}d
                </div>
              </TableCell>
              <TableCell>
                <span className="text-xs">{m.teamName}</span>
              </TableCell>
              <TableCell className="text-center text-sm">{m.husConcluidadas}/{m.totalHUs}</TableCell>
              <TableCell className="text-center">
                <Badge variant={m.taxaConclusao >= 80 ? "default" : m.taxaConclusao >= 50 ? "secondary" : "destructive"} className="text-[10px]">
                  {m.taxaConclusao}%
                </Badge>
              </TableCell>
              <TableCell className="text-center font-semibold text-sm">{m.velocityPontos}</TableCell>
              <TableCell className="text-center text-sm text-muted-foreground">{m.horasPlanejadas}h</TableCell>
              <TableCell className="text-center text-sm">{m.horasRealizadas}h</TableCell>
              <TableCell className="text-center">
                <span className={`text-xs font-medium flex items-center justify-center gap-1 ${
                  m.desvioHoras > 4 ? "text-destructive" : m.desvioHoras < -4 ? "text-emerald-600" : "text-muted-foreground"
                }`}>
                  <DesvioIcon v={m.desvioHoras} />
                  {m.desvioHoras > 0 ? "+" : ""}{m.desvioHoras}h
                </span>
              </TableCell>
              <TableCell className="text-center">
                <Badge variant={m.impedimentos > 2 ? "destructive" : m.impedimentos > 0 ? "secondary" : "outline"} className="text-[10px]">
                  {m.impedimentos}
                </Badge>
              </TableCell>
              <TableCell>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
