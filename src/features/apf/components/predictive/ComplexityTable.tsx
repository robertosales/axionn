/**
 * ComplexityTable
 * ----------------
 * Tabela de índice de complexidade por HU da sprint selecionada.
 * Ordena por z-score descrescente (mais complexas primeiro).
 */
import { Cpu, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { ComplexityScore } from "../../services/predictive.service";

const COMPLEXITY_CONFIG = {
  anomaly: { label: "Anômala",  badge: "border-red-400 text-red-600 bg-red-50"      },
  high:    { label: "Alta",     badge: "border-amber-400 text-amber-600 bg-amber-50" },
  medium:  { label: "Média",    badge: "border-border text-muted-foreground"          },
  low:     { label: "Baixa",    badge: "border-emerald-400 text-emerald-600 bg-emerald-50" },
};

interface Props {
  complexities: ComplexityScore[];
}

export function ComplexityTable({ complexities }: Props) {
  if (complexities.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 flex flex-col items-center gap-2 text-center">
          <Cpu className="h-7 w-7 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">
            Selecione uma sprint com PF calculados para ver os índices de complexidade.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...complexities].sort((a, b) => (b.zScore ?? 0) - (a.zScore ?? 0));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Cpu className="h-4 w-4 text-primary" />
          Índice de Complexidade por HU
          <span className="text-xs font-normal text-muted-foreground ml-1">(sprint selecionada)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Código</TableHead>
                <TableHead>Título</TableHead>
                <TableHead className="w-14 text-center">SP</TableHead>
                <TableHead className="w-14 text-center">PF</TableHead>
                <TableHead className="w-16 text-center">PF/SP</TableHead>
                <TableHead className="w-16 text-center">
                  <span className="flex items-center justify-center gap-1">
                    <ArrowUpDown className="h-3 w-3" /> Z-score
                  </span>
                </TableHead>
                <TableHead className="w-24 text-center">Complexidade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((c) => {
                const cfg = COMPLEXITY_CONFIG[c.complexity];
                return (
                  <TableRow key={c.huId}>
                    <TableCell><span className="font-mono text-xs text-muted-foreground">{c.huCode}</span></TableCell>
                    <TableCell><span className="text-sm line-clamp-1">{c.huTitle}</span></TableCell>
                    <TableCell className="text-center tabular-nums text-sm">{c.sp ?? "—"}</TableCell>
                    <TableCell className="text-center tabular-nums font-semibold text-primary text-sm">{c.fp ?? "—"}</TableCell>
                    <TableCell className="text-center tabular-nums text-sm">{c.pfPerSp ?? "—"}</TableCell>
                    <TableCell className="text-center tabular-nums text-sm">
                      {c.zScore !== null ? (
                        <span className={Math.abs(c.zScore) > 2 ? "text-red-500 font-semibold" : ""}>
                          {c.zScore > 0 ? "+" : ""}{c.zScore}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`text-[10px] ${cfg.badge}`}>
                        {cfg.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
