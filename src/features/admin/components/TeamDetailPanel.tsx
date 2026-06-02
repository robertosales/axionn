/**
 * TeamDetailPanel — Detalhe por Time
 *
 * fix: dedup de teamId no Select e na tabela (evita duplicacao de times)
 * fix: refinamento visual — tabela mais compacta e titulo com peso correto
 */
import { useMemo } from "react";
import { Badge }  from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Zap, Shield } from "lucide-react";
import type { AdminKpis, TeamKpis } from "../hooks/useAdminKpis";

interface Props { byTeam: AdminKpis["byTeam"]; selectedTeam: string; onSelect: (v: string) => void; }

/** Celula numerica com destaque condicional — compacta */
function NumCell({
  value,
  critical = false,
  positive = false,
}: { value: number | string; critical?: boolean; positive?: boolean }) {
  const base = "text-xs text-center py-2";
  if (critical) return <TableCell className={`${base} bg-red-50 text-red-600 font-semibold`}>{value}</TableCell>;
  if (positive) return <TableCell className={`${base} text-emerald-600 font-semibold`}>{value}</TableCell>;
  return <TableCell className={`${base} text-foreground`}>{value}</TableCell>;
}

/** Linha — Sustentacao */
function SustentacaoRow({ t }: { t: TeamKpis }) {
  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="py-2">
        <div className="flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-blue-500 shrink-0" aria-hidden="true" />
          <span className="text-xs font-medium leading-tight">{t.teamName}</span>
        </div>
      </TableCell>
      <TableCell className="py-2 text-center">
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Sustentação</Badge>
      </TableCell>
      <NumCell value={t.demandasAbertas} />
      <NumCell value={t.demandasConcluidas} positive />
      <NumCell value={t.slaEmRisco}          critical={t.slaEmRisco > 0} />
      <NumCell value={t.demandasBloqueadas}  critical={t.demandasBloqueadas > 0} />
    </TableRow>
  );
}

/** Linha — Sala Agil */
function SalaAgilRow({ t }: { t: TeamKpis }) {
  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell className="py-2">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-primary shrink-0" aria-hidden="true" />
          <span className="text-xs font-medium leading-tight">{t.teamName}</span>
        </div>
      </TableCell>
      <TableCell className="py-2 text-center">
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">Sala Ágil</Badge>
      </TableCell>
      <NumCell value={t.totalHUs} />
      <NumCell value={t.husConcluidasNoSprint} positive />
      <NumCell value={t.impedimentosAbertos}   critical={t.impedimentosAbertos > 0} />
      <NumCell value={t.backlogTotal} />
    </TableRow>
  );
}

export function TeamDetailPanel({ byTeam, selectedTeam, onSelect }: Props) {
  /**
   * dedup: a RPC pode devolver o mesmo teamId mais de uma vez (ex: times que
   * aparecem em mais de um modulo ou quando o AuthContext re-hidrata).
   * Usamos o primeiro registro encontrado por teamId como fonte verdadeira.
   */
  const uniqueTeams = useMemo(() => {
    const seen = new Set<string>();
    return byTeam.filter(t => {
      if (seen.has(t.teamId)) return false;
      seen.add(t.teamId);
      return true;
    });
  }, [byTeam]);

  const shown = selectedTeam === "all"
    ? uniqueTeams
    : uniqueTeams.filter(t => t.teamId === selectedTeam);

  return (
    <div className="space-y-2">
      {/* Cabecalho */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Detalhe por Time
        </h3>
        <Select value={selectedTeam} onValueChange={onSelect}>
          <SelectTrigger className="h-7 text-xs w-44">
            <SelectValue placeholder="Todos os times" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos os times</SelectItem>
            {/* Select tambem usa uniqueTeams para nao duplicar opcoes */}
            {uniqueTeams.map(t => (
              <SelectItem key={t.teamId} value={t.teamId} className="text-xs">
                {t.teamName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {shown.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhum time encontrado.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table className="min-w-[580px]">
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2">Time</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2 text-center">Módulo</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2 text-center">Abertas</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2 text-center">Concluídas</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2 text-center">SLA Risco</TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider py-2 text-center">Bloqueadas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map(t =>
                  t.module === "sala_agil"
                    ? <SalaAgilRow  key={t.teamId} t={t} />
                    : <SustentacaoRow key={t.teamId} t={t} />
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
