import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Zap, Shield, AlertTriangle, CheckCircle2, LayoutList, History, Target, Users } from "lucide-react";
import type { TeamKpis } from "../hooks/useAdminKpis";

interface Props {
  teamId: string | null;
  open: boolean;
  onClose: () => void;
  allKpis: TeamKpis[];
}

export function TeamDetailDrawer({ teamId, open, onClose, allKpis }: Props) {
  const team = useMemo(() =>
    allKpis.find(t => t.teamId === teamId),
  [teamId, allKpis]);

  if (!team) return null;

  const isAgil = team.module === "sala_agil";

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto border-l-0 shadow-2xl">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-2 rounded-lg ${isAgil ? "bg-primary/10 text-primary" : "bg-blue-100 text-blue-600 dark:bg-blue-950/40"}`}>
              {isAgil ? <Zap className="h-5 w-5" /> : <Shield className="h-5 w-5" />}
            </div>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              {isAgil ? "Sala Ágil" : "Sustentação"}
            </Badge>
          </div>
          <SheetTitle className="text-2xl font-bold">{team.teamName}</SheetTitle>
          <SheetDescription className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
            Detalhamento Operacional do Time
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-8">
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-4">Métricas Atuais</h3>
            <div className="grid grid-cols-2 gap-3">
              {isAgil ? (
                <>
                  <MetricCard
                    label="HUs no Sprint"
                    value={team.totalHUs}
                    icon={<LayoutList className="h-4 w-4" />}
                  />
                  <MetricCard
                    label="HUs Concluídas"
                    value={team.husConcluidasNoSprint}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    accent="green"
                  />
                  <MetricCard
                    label="Impedimentos"
                    value={team.impedimentosAbertos}
                    icon={<AlertTriangle className="h-4 w-4" />}
                    accent={team.impedimentosAbertos > 0 ? "red" : "none"}
                  />
                  <MetricCard
                    label="Backlog Total"
                    value={team.backlogTotal}
                    icon={<History className="h-4 w-4" />}
                  />
                </>
              ) : (
                <>
                  <MetricCard
                    label="Demandas Abertas"
                    value={team.demandasAbertas}
                    icon={<Target className="h-4 w-4" />}
                  />
                  <MetricCard
                    label="Demandas Concluídas"
                    value={team.demandasConcluidas}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    accent="green"
                  />
                  <MetricCard
                    label="SLA em Risco"
                    value={team.slaEmRisco}
                    icon={<AlertTriangle className="h-4 w-4" />}
                    accent={team.slaEmRisco > 0 ? "red" : "none"}
                  />
                  <MetricCard
                    label="Bloqueadas"
                    value={team.demandasBloqueadas}
                    icon={<Shield className="h-4 w-4" />}
                    accent={team.demandasBloqueadas > 0 ? "orange" : "none"}
                  />
                </>
              )}
            </div>
          </section>

          <Separator className="opacity-50" />

          <section className="bg-muted/30 p-4 rounded-xl border border-border/50">
            <h3 className="text-xs font-bold flex items-center gap-2 mb-3">
              <History className="h-4 w-4 text-primary" />
              Ciclo de Trabalho
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Sprint Atual</span>
                <span className="text-xs font-semibold">{team.sprintAtivo ?? "Não definido"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Módulo de Trabalho</span>
                <span className="text-xs font-semibold capitalize">{team.module?.replace("_", " ") ?? "—"}</span>
              </div>
            </div>
          </section>

          <section className="flex flex-col items-center justify-center p-8 text-center bg-muted/10 rounded-2xl border border-dashed border-border/50">
             <Users className="h-8 w-8 text-muted-foreground/30 mb-3" />
             <p className="text-xs text-muted-foreground">
               Use os módulos de <strong>Sala Ágil</strong> ou <strong>Sustentação</strong> para gerenciar os itens detalhados deste time.
             </p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MetricCard({
  label,
  value,
  icon,
  accent = "none"
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: "none" | "green" | "red" | "orange";
}) {
  const accentClasses = {
    none: "text-foreground",
    green: "text-emerald-600 dark:text-emerald-400",
    red: "text-destructive",
    orange: "text-orange-500",
  };

  return (
    <div className="bg-card border border-border/50 p-4 rounded-xl shadow-sm">
      <div className="text-muted-foreground mb-2">{icon}</div>
      <div className={`text-2xl font-bold tabular-nums ${accentClasses[accent]}`}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mt-1">
        {label}
      </div>
    </div>
  );
}
