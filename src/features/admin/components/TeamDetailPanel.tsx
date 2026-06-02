/**
 * TeamDetailPanel — Detalhe por Time
 *
 * Redesign (feature/redesign-ui-admin):
 *   Substitui o grid de mini-cards por uma Table responsiva.
 *   Celulas com valores criticos (> 0) recebem destaque visual suave em vermelho.
 *   Zero alteracao em props, hooks ou logica de dados.
 *
 * STYLE GUIDE — Tabela responsiva:
 *   - overflow-x-auto no wrapper para mobile horizontal scroll
 *   - min-w-[640px] na table para nao colapsar colunas em telas pequenas
 *   - Celula critica: bg-red-50 text-red-600 font-semibold
 *   - Celula positiva: text-emerald-600 font-semibold
 *   - Header: bg-muted/50 text-xs font-semibold uppercase tracking-wide
 */
import { Badge }  from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Zap, Shield } from "lucide-react";
import type { AdminKpis, TeamKpis } from "../hooks/useAdminKpis";

interface Props { byTeam: AdminKpis["byTeam"]; selectedTeam: string; onSelect: (v: string) => void; }

/** Celula numerica com destaque condicional */
function NumCell({ value, critical = false, positive = false }: { value: number | string; critical?: boolean; positive?: boolean }) {
  const base = "text-sm text-center";
  if (critical) return <TableCell className={`${base} bg-red-50 text-red-600 font-semibold`}>{value}</TableCell>;
  if (positive) return <TableCell className={`${base} text-emerald-600 font-semibold`}>{value}</TableCell>;
  return <TableCell className={`${base} text-foreground`}>{value}</TableCell>;
}

/** Linha da tabela — modulo Sustentacao */
function SustentacaoRow({ t }: { t: TeamKpis }) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Shield className="h-3.5 w-3.5 text-blue-600 shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium">{t.teamName}</span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="secondary" className="text-[10px]">Sustentação</Badge>
      </TableCell>
      <NumCell value={t.demandasAbertas} />
      <NumCell value={t.demandasConcluidas} positive />
      <NumCell value={t.slaEmRisco}         critical={t.slaEmRisco > 0} />
      <NumCell value={t.demandasBloqueadas} critical={t.demandasBloqueadas > 0} />
    </TableRow>
  );
}

/** Linha da tabela — modulo Sala Agil */
function SalaAgilRow({ t }: { t: TeamKpis }) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium">{t.teamName}</span>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="secondary" className="text-[10px]">Sala Ágil</Badge>
      </TableCell>
      {/* Sala Agil nao tem colunas SLA/Bloqueadas — exibe HUs e Concluidas */}
      <NumCell value={t.totalHUs} />
      <NumCell value={t.husConcluidasNoSprint} positive />
      <NumCell value={t.impedimentosAbertos} critical={t.impedimentosAbertos > 0} />
      <NumCell value={t.backlogTotal} />
    </TableRow>
  );
}

export function TeamDetailPanel({ byTeam, selectedTeam, onSelect }: Props) {
  const shown = selectedTeam === "all" ? byTeam : byTeam.filter(t => t.teamId === selectedTeam);

  return (
    <div className="space-y-3">
      {/* Cabecalho com filtro */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Detalhe por Time</h3>
        <Select value={selectedTeam} onValueChange={onSelect}>
          <SelectTrigger className="h-8 text-xs w-48">
            <SelectValue placeholder="Todos os times" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos os times</SelectItem>
            {byTeam.map(t => (
              <SelectItem key={t.teamId} value={t.teamId} className="text-xs">{t.teamName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum time encontrado.</p>
      ) : (
        /* Wrapper com overflow horizontal para responsividade mobile */
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Time</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-center">Módulo</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-center">Abertas</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-center">Concluídas</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-center">SLA em Risco</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-center">Bloqueadas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map(t =>
                  t.module === "sala_agil"
                    ? <SalaAgilRow key={t.teamId} t={t} />
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
