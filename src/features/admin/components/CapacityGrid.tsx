import { CapacityBar } from "./CapacityBar";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CalendarClock, Clock, Shield, Zap } from "lucide-react";
import type { TeamCapacity } from "../hooks/useCapacityPlanner";
import { useState } from "react";
import { CapacityMemberDetailDialog } from "./CapacityMemberDetailDialog";

interface Props {
  teamCapacities: TeamCapacity[];
}

function daysLeft(dateStr: string | null) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

export function CapacityGrid({ teamCapacities }: Props) {
  const [selected, setSelected] = useState<{
    teamId: string;
    teamName: string;
    module: string;
    devId: string;
    devName: string;
  } | null>(null);

  if (teamCapacities.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Nenhum time com dados de capacidade no período.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {teamCapacities.map((team) => {
        const dias = daysLeft(team.sprintEndDate);
        return (
          <div key={team.teamId} className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/60 px-4 py-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {team.module === "sala_agil"
                  ? <Zap className="h-4 w-4 shrink-0 text-primary" />
                  : <Shield className="h-4 w-4 shrink-0 text-blue-500" />}
                <span className="truncate text-sm font-semibold">{team.teamName}</span>
                <Badge variant="outline" className="text-[10px]">
                  {team.module === "sala_agil" ? "Sala Ágil" : "Sustentação"}
                </Badge>
                {!team.sprintAtivo && (
                  <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800">
                    Sem sprint ativa
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {team.sprintAtivo && (
                  <span className="flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {team.sprintAtivo}
                    {dias !== null && team.module === "sala_agil" && (
                      <Badge
                        variant={dias <= 1 ? "destructive" : dias <= 3 ? "secondary" : "outline"}
                        className="ml-1 text-[9px]"
                      >
                        {dias <= 0 ? "expirado" : `${dias}d restantes`}
                      </Badge>
                    )}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {team.totalAllocated}h / {team.totalCapacity}h
                  <span className={`font-semibold ${
                    team.utilizationPct > 100
                      ? "text-destructive"
                      : team.utilizationPct >= 80
                        ? "text-orange-500"
                        : "text-emerald-600"
                  }`}>
                    ({team.utilizationPct}%)
                  </span>
                </span>
                <span title="Horas realizadas no sprint">Real.: {team.totalRealized}h</span>
              </div>
            </div>

            {team.devs.length === 0 ? (
              <div className="px-4 py-4 text-xs text-muted-foreground">
                <p>Nenhum desenvolvedor encontrado no cadastro operacional deste time.</p>
                <p className="mt-1">
                  Para Sala Ágil, cadastre o profissional em <strong>Equipe</strong>; conceder acesso em
                  <strong> Membros</strong> não cria automaticamente um desenvolvedor para planejamento.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {team.devs.map((dev) => (
                  <div
                    key={dev.devId}
                    className={`grid grid-cols-12 items-center gap-3 px-4 py-2 ${
                      dev.status === "overloaded" ? "bg-destructive/5" : ""
                    }`}
                  >
                    <div className="col-span-3 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {dev.status === "overloaded" && (
                          <AlertTriangle
                            className="h-3.5 w-3.5 shrink-0 text-destructive"
                            aria-label="Sobrecarregado"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setSelected({
                            teamId: team.teamId,
                            teamName: team.teamName,
                            module: team.module,
                            devId: dev.devId,
                            devName: dev.devName,
                          })}
                          className="truncate text-left text-xs font-semibold hover:text-primary hover:underline"
                        >
                          {dev.devName}
                        </button>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {dev.noActiveSprint
                          ? "Sem sprint ativa"
                          : `${dev.wipCount} ${team.module === "sustentacao" ? "demanda" : "HU"}${dev.wipCount !== 1 ? "s" : ""} em andamento`}
                      </span>
                    </div>

                    <div className="col-span-5">
                      <CapacityBar pct={dev.utilizationPct} status={dev.status} />
                    </div>

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
                          dev.realizedHours > dev.capacityHours ? "text-destructive" : ""
                        }`}>
                          {dev.realizedHours}h
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {selected && (
        <CapacityMemberDetailDialog
          open={Boolean(selected)}
          onClose={() => setSelected(null)}
          teamId={selected.teamId}
          teamName={selected.teamName}
          module={selected.module}
          devId={selected.devId}
          devName={selected.devName}
        />
      )}
    </div>
  );
}
