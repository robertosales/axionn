import { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Clock,
  Inbox,
  Layers,
  ListChecks,
  Target,
  Timer,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { UserAvatar } from "@/shared/components/common/UserAvatar";
import { useMemberCapacityDetail } from "../hooks/useMemberCapacityDetail";
import { SITUACAO_LABELS } from "@/features/sustentacao/types/demanda";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  module: string;
  devId: string;
  userId?: string | null;
  devName: string;
}

const fmtDate = (date?: string | null) =>
  date ? format(new Date(date), "dd/MM/yyyy", { locale: ptBR }) : "—";

interface KpiProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: "agil" | "sust";
}

function Kpi({ icon: Icon, label, value, tone = "agil" }: KpiProps) {
  const accent = tone === "agil" ? "text-emerald-600" : "text-blue-600";
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
      <div className={cn("rounded-md bg-muted/60 p-2", accent)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-base font-semibold leading-tight">{value}</p>
      </div>
    </div>
  );
}

type BadgeVariant = "outline" | "secondary" | "default" | "destructive";

function StatusBadge({
  label,
  variant = "outline",
  color,
}: {
  label: string;
  variant?: BadgeVariant;
  color?: string | null;
}) {
  return (
    <Badge
      variant={variant}
      className="max-w-[190px] gap-1.5 whitespace-normal py-1 text-[10px] font-medium leading-tight"
    >
      {color && (
        <span
          aria-hidden="true"
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      <span>{label}</span>
    </Badge>
  );
}

export function CapacityMemberDetailDialog({
  open,
  onClose,
  teamId,
  teamName,
  module,
  devId,
  userId,
  devName,
}: Props) {
  const isAgil = module === "sala_agil";
  const {
    loading,
    error,
    hus,
    activities,
    demandas,
    hours,
    activeSprintName,
    noActiveSprint,
  } = useMemberCapacityDetail({
    teamId,
    devId,
    userId,
    module,
    enabled: open,
  });

  const kpis = useMemo(() => {
    if (isAgil) {
      const openHus = hus.filter((hu) => !hu.is_terminal).length;
      const storyPoints = hus.reduce(
        (total, hu) => total + (Number(hu.story_points) || 0),
        0,
      );
      const estimatedHours = hus.reduce(
        (total, hu) => total + (Number(hu.estimated_hours) || 0),
        0,
      );
      const openActivities = activities.filter((activity) => !activity.is_closed).length;
      return [
        { icon: Layers, label: "HUs ativas", value: openHus },
        { icon: Target, label: "Story Points", value: storyPoints || "—" },
        { icon: Clock, label: "Horas estimadas", value: `${estimatedHours}h` },
        { icon: ListChecks, label: "Atividades abertas", value: openActivities },
      ];
    }

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const monthHours = hours
      .filter((hour) => {
        const date = new Date(hour.created_at);
        return date.getMonth() === month && date.getFullYear() === year;
      })
      .reduce((total, hour) => total + (Number(hour.horas) || 0), 0);
    const criticalSla = demandas.filter((demand) => {
      const sla = (demand.sla ?? "").toLowerCase();
      return sla.includes("estour") || sla.includes("crit");
    }).length;

    return [
      { icon: Inbox, label: "Demandas ativas", value: demandas.length },
      { icon: Timer, label: "Horas no mês", value: `${monthHours}h` },
      { icon: AlertTriangle, label: "SLA crítico", value: criticalSla },
      { icon: Users, label: "Lançamentos", value: hours.length },
    ];
  }, [isAgil, hus, activities, demandas, hours]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="flex h-[82vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <div className="flex items-start gap-4">
            <UserAvatar name={devName} size="lg" />
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {devName}
              </DialogTitle>
              <DialogDescription className="mt-1 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> {teamName}
                </span>
                <span className="text-muted-foreground/40">•</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-medium",
                    isAgil
                      ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-600"
                      : "border-blue-500/40 bg-blue-500/5 text-blue-600",
                  )}
                >
                  {isAgil ? "Sala Ágil" : "Sustentação"}
                </Badge>
                {isAgil && activeSprintName && (
                  <Badge variant="secondary" className="font-normal">
                    {activeSprintName}
                  </Badge>
                )}
              </DialogDescription>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            {kpis.map((kpi) => (
              <Kpi key={kpi.label} {...kpi} tone={isAgil ? "agil" : "sust"} />
            ))}
          </div>
        </DialogHeader>

        {error && (
          <div className="mx-6 mt-4 rounded border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!error && isAgil && noActiveSprint && (
          <div className="mx-6 mt-4 flex items-start gap-2 rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3 text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Este time não possui sprint ativa</p>
              <p className="mt-0.5 text-xs">
                As HUs e atividades do colaborador serão exibidas quando uma sprint for ativada.
              </p>
            </div>
          </div>
        )}

        <Tabs
          defaultValue={isAgil ? "hus" : "demandas"}
          className="flex flex-1 flex-col overflow-hidden px-6 pb-6 pt-4"
        >
          <TabsList className="self-start bg-muted/60">
            {isAgil ? (
              <>
                <TabsTrigger value="hus" className="gap-2">
                  <Layers className="h-3.5 w-3.5" /> HUs
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {hus.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="acts" className="gap-2">
                  <ListChecks className="h-3.5 w-3.5" /> Atividades
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {activities.length}
                  </Badge>
                </TabsTrigger>
              </>
            ) : (
              <>
                <TabsTrigger value="demandas" className="gap-2">
                  <Inbox className="h-3.5 w-3.5" /> Demandas
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {demandas.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="hours" className="gap-2">
                  <Clock className="h-3.5 w-3.5" /> Horas lançadas
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {hours.length}
                  </Badge>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <div className="mt-3 flex-1 overflow-hidden rounded-lg border bg-card">
            {loading && (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4, 5].map((item) => (
                  <Skeleton key={item} className="h-10 w-full" />
                ))}
              </div>
            )}

            {!loading && isAgil && (
              <>
                <TabsContent value="hus" className="m-0 h-full">
                  {hus.length === 0 ? (
                    <div className="p-6">
                      <EmptyState
                        icon={Layers}
                        title={noActiveSprint ? "Nenhuma sprint ativa" : "Nenhuma HU atribuída"}
                        description={
                          noActiveSprint
                            ? "Ative uma sprint para visualizar a carga atual deste colaborador."
                            : "Este colaborador não possui histórias atribuídas na sprint ativa."
                        }
                      />
                    </div>
                  ) : (
                    <ScrollArea className="h-full">
                      <Table className="min-w-[780px]">
                        <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                          <TableRow>
                            <TableHead className="w-[42%]">Título</TableHead>
                            <TableHead className="w-[23%]">Sprint</TableHead>
                            <TableHead className="w-[18%]">Status</TableHead>
                            <TableHead className="text-right">SP</TableHead>
                            <TableHead className="text-right">Horas est.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {hus.map((hu) => (
                            <TableRow key={hu.id} className="even:bg-muted/20">
                              <TableCell className="font-medium">{hu.title}</TableCell>
                              <TableCell className="max-w-[210px] text-xs leading-snug text-muted-foreground">
                                {hu.sprint_name ?? "Backlog"}
                              </TableCell>
                              <TableCell>
                                <StatusBadge label={hu.status_label} color={hu.status_hex} />
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {hu.story_points ?? "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {hu.estimated_hours != null ? `${hu.estimated_hours}h` : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="acts" className="m-0 h-full">
                  {activities.length === 0 ? (
                    <div className="p-6">
                      <EmptyState
                        icon={ListChecks}
                        title="Nenhuma atividade"
                        description="Sem atividades vinculadas às HUs deste colaborador na sprint ativa."
                      />
                    </div>
                  ) : (
                    <ScrollArea className="h-full">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                          <TableRow>
                            <TableHead>Atividade</TableHead>
                            <TableHead>HU</TableHead>
                            <TableHead>Período</TableHead>
                            <TableHead className="text-right">Horas</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activities.map((activity) => (
                            <TableRow key={activity.id} className="even:bg-muted/20">
                              <TableCell className="font-medium">{activity.title}</TableCell>
                              <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                                {activity.hu_title ?? "—"}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {fmtDate(activity.start_date)} → {fmtDate(activity.end_date)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {activity.hours}h
                              </TableCell>
                              <TableCell>
                                <StatusBadge
                                  label={activity.is_closed ? "Concluída" : "Em andamento"}
                                  variant={activity.is_closed ? "secondary" : "outline"}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </TabsContent>
              </>
            )}

            {!loading && !isAgil && (
              <>
                <TabsContent value="demandas" className="m-0 h-full">
                  {demandas.length === 0 ? (
                    <div className="p-6">
                      <EmptyState
                        icon={Inbox}
                        title="Nenhuma demanda em andamento"
                        description="Este colaborador não está vinculado a demandas ativas."
                      />
                    </div>
                  ) : (
                    <ScrollArea className="h-full">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Projeto</TableHead>
                            <TableHead>Título</TableHead>
                            <TableHead>Situação</TableHead>
                            <TableHead>SLA</TableHead>
                            <TableHead>Criada em</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {demandas.map((demand) => (
                            <TableRow key={demand.id} className="even:bg-muted/20">
                              <TableCell className="font-mono text-xs">{demand.rhm}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {demand.projeto}
                              </TableCell>
                              <TableCell className="max-w-[260px] truncate font-medium">
                                {demand.titulo ?? "—"}
                              </TableCell>
                              <TableCell>
                                <StatusBadge
                                  label={SITUACAO_LABELS[demand.situacao] ?? demand.situacao}
                                />
                              </TableCell>
                              <TableCell className="text-xs">{demand.sla ?? "—"}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {fmtDate(demand.created_at)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="hours" className="m-0 h-full">
                  {hours.length === 0 ? (
                    <div className="p-6">
                      <EmptyState
                        icon={Clock}
                        title="Nenhuma hora lançada"
                        description="Sem apontamentos de horas para este colaborador."
                      />
                    </div>
                  ) : (
                    <ScrollArea className="h-full">
                      <Table>
                        <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Demanda</TableHead>
                            <TableHead>Fase</TableHead>
                            <TableHead className="text-right">Horas</TableHead>
                            <TableHead>Descrição</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {hours.map((hour) => (
                            <TableRow key={hour.id} className="even:bg-muted/20">
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {fmtDate(hour.created_at)}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                #{hour.demanda_rhm}
                              </TableCell>
                              <TableCell>
                                <StatusBadge label={hour.fase} />
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {hour.horas}h
                              </TableCell>
                              <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">
                                {hour.descricao ?? "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
