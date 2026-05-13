import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Shield } from "lucide-react";
import type { AdminKpis, TeamKpis } from "../hooks/useAdminKpis";

interface Props { byTeam: AdminKpis["byTeam"]; selectedTeam: string; onSelect: (v: string) => void; }

function StatRow({ label, value, status }: { label: string; value: string | number; status?: "good" | "warning" | "danger" | "neutral" }) {
  const cls = status === "good" ? "text-emerald-600 font-bold" : status === "danger" ? "text-destructive font-bold" : status === "warning" ? "text-orange-500 font-bold" : "font-semibold";
  return (
    <div className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs ${cls}`}>{value}</span>
    </div>
  );
}

function TeamCard({ t }: { t: TeamKpis }) {
  const isSala = t.module === "sala_agil";
  return (
    <Card className="rounded-xl border border-border bg-card">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {isSala ? <Zap className="h-3.5 w-3.5 text-primary" /> : <Shield className="h-3.5 w-3.5 text-blue-600" />}
            <span className="text-sm font-semibold truncate">{t.teamName}</span>
          </div>
          <Badge variant="secondary" className="text-[10px] shrink-0">{isSala ? "Sala Ágil" : "Sustentação"}</Badge>
        </div>
        {isSala ? (
          <>
            <StatRow label="Sprint ativo"  value={t.sprintAtivo ?? "—"} />
            <StatRow label="HUs no sprint" value={t.totalHUs} />
            <StatRow label="Concluídas"    value={t.husConcluidasNoSprint} status="good" />
            <StatRow label="Velocity"      value={`${t.velocityPontos} pts`} />
            <StatRow label="Impedimentos" value={t.impedimentosAbertos} status={t.impedimentosAbertos > 0 ? "warning" : "good"} />
            <StatRow label="Backlog"       value={t.backlogTotal} />
          </>
        ) : (
          <>
            <StatRow label="Demandas abertas"  value={t.demandasAbertas} />
            <StatRow label="Concluídas"         value={t.demandasConcluidas} status="good" />
            <StatRow label="SLA em risco"       value={t.slaEmRisco}         status={t.slaEmRisco > 0 ? "danger" : "good"} />
            <StatRow label="Bloqueadas"         value={t.demandasBloqueadas} status={t.demandasBloqueadas > 0 ? "danger" : "good"} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function TeamDetailPanel({ byTeam, selectedTeam, onSelect }: Props) {
  const shown = selectedTeam === "all" ? byTeam : byTeam.filter(t => t.teamId === selectedTeam);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Detalhe por Time</h3>
        <Select value={selectedTeam} onValueChange={onSelect}>
          <SelectTrigger className="h-8 text-xs w-48"><SelectValue placeholder="Todos os times" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos os times</SelectItem>
            {byTeam.map(t => <SelectItem key={t.teamId} value={t.teamId} className="text-xs">{t.teamName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {shown.length === 0
        ? <p className="text-sm text-muted-foreground text-center py-6">Nenhum time encontrado.</p>
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{shown.map(t => <TeamCard key={t.teamId} t={t} />)}</div>}
    </div>
  );
}
