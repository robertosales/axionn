import { CapacityBar } from "./CapacityBar";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Zap, Shield, CalendarClock } from "lucide-react";
import type { TeamCapacity } from "../hooks/useCapacityPlanner";

interface Props { teamCapacities: TeamCapacity[]; }

function daysLeft(dateStr: string | null) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

export function CapacityGrid({ teamCapacities }: Props) {
  if (teamCapacities.length === 0) {
    return <p className="text-sm text-muted-foreground py-10 text-center">Nenhum sprint ativo encontrado.</p>;
  }

  return (
    <div className="space-y-6">
      {teamCapacities.map(team => {
        const dias = daysLeft(team.sprintEndDate);
        return (
          <div key={team.teamId} className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Header do time */}
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                {team.module === "sala_agil"
                  ? <Zap    className="h-4 w-4 text-primary" />
                  : <Shield className="h-4 w-4 text-violet-500" />}
                <span className="font-semibold text-sm">{team.teamName}</span>
                <Badge variant="outline" className="text-[10px]">
                  {team.module === "sala_agil" ? "Sala Ágil" : "Sustentação"}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {team.sprintAtivo && (
                  <span className="flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {team.sprintAtivo}
                    {dias !== null && (
                      <Badge variant={dias <= 1 ? "destructive" : dias <= 3 ? "secondary" : "outline"} className="text-[9px] ml-1">
                        {dias <= 0 ? "expirado" : `${dias}d restantes`}
                      </Badge>
                    )}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {team.totalAllocated}h / {team.totalCapacity}h
                  <span className={`font-semibold ${
                    team.utilizationPct >= 100 ? "text-destructive" :
                    team.utilizationPct >= 80  ? "text-orange-500"  : "text-emerald-600"
                  }`}>({team.utilizationPct}%)</span>
                </span>
              </div>
            </div>

            {/* Grade de devs */}
            {team.devs.length === 0 ? (
              <p className="text-xs text-muted-foreground px-4 py-4">Nenhum desenvolvedor cadastrado neste time.</p>
            ) : (
              <div className="divide-y divide-border">
                {team.devs.map(dev => (
                  <div key={dev.devId} className={`px-4 py-3 grid grid-cols-12 gap-3 items-center ${
                    dev.status === "overloaded" ? "bg-destructive/5" : ""
                  }`}>
                    {/* Nome */}
                    <div className="col-span-3 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {dev.status === "overloaded" && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                        <span className="text-sm font-medium truncate">{dev.devName}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{dev.wipCount} HU{dev.wipCount !== 1 ? "s" : ""} em andamento</span>
                    </div>

                    {/* Barra de utilização */}
                    <div className="col-span-5">
                      <CapacityBar pct={dev.utilizationPct} status={dev.status} />
                    </div>

                    {/* Horas */}
                    <div className="col-span-4 grid grid-cols-3 gap-1 text-right">
                      <div>
                        <p className="text-[9px] uppercase text-muted-foreground">Cap.</p>
                        <p className="text-xs font-semibold">{dev.capacityHours}h</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase text-muted-foreground">Aloc.</p>
                        <p className="text-xs font-semibold">{dev.allocatedHours}h</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase text-muted-foreground">Real.</p>
                        <p className={`text-xs font-semibold ${
                          dev.realizedHours > dev.allocatedHours ? "text-destructive" : ""
                        }`}>{dev.realizedHours}h</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
