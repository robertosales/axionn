import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/shared/components/common/EmptyState";
import { UserAvatar } from "@/shared/components/common/UserAvatar";
import { useMemberCapacityDetail } from "../hooks/useMemberCapacityDetail";
import { SITUACAO_LABELS } from "@/features/sustentacao/types/demanda";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClipboardList, ListChecks, Inbox, Clock, Users, Layers, Target, Timer, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  teamId: string;
  teamName: string;
  module: string; // "sala_agil" | "sustentacao"
  devId: string;
  devName: string;
}

const fmtDate = (d?: string | null) =>
  d ? format(new Date(d), "dd/MM/yyyy", { locale: ptBR }) : "—";

interface KpiProps { icon: any; label: string; value: string | number; tone?: "agil" | "sust"; }
function Kpi({ icon: Icon, label, value, tone = "agil" }: KpiProps) {
  const accent = tone === "agil" ? "text-emerald-600" : "text-blue-600";
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5">
      <div className={cn("rounded-md bg-muted/60 p-2", accent)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">{label}</p>
        <p className="text-base font-semibold leading-tight">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ label, variant = "outline" }: { label: string; variant?: "outline"|"secondary"|"default"|"destructive" }) {
  return <Badge variant={variant} className="text-[10px] font-medium">{label}</Badge>;
}

export function CapacityMemberDetailDialog({
  open, onClose, teamId, teamName, module, devId, devName,
}: Props) {
  const isAgil = module === "sala_agil";
  const { loading, error, hus, activities, demandas, hours } = useMemberCapacityDetail({
    teamId, devId, module, enabled: open,
  });

  const kpis = useMemo(() => {
    if (isAgil) {
      const openHus = hus.filter(h => !["concluida","pronto","done"].includes((h.status||"").toLowerCase())).length;
      const sp = hus.reduce((a, h) => a + (Number(h.story_points) || 0), 0);
      const est = hus.reduce((a, h) => a + (Number(h.estimated_hours) || 0), 0);
      const openActs = activities.filter(a => !a.is_closed).length;
      return [
        { icon: Layers, label: "HUs ativas", value: openHus },
        { icon: Target, label: "Story Points", value: sp || "—" },
        { icon: Clock, label: "Horas estimadas", value: `${est}h` },
        { icon: ListChecks, label: "Atividades abertas", value: openActs },
      ];
    }
    const now = new Date(); const m = now.getMonth(); const y = now.getFullYear();
    const horasMes = hours
      .filter(h => { const d = new Date(h.created_at); return d.getMonth() === m && d.getFullYear() === y; })
      .reduce((a, h) => a + (Number(h.horas) || 0), 0);
    const slaCrit = demandas.filter(d => (d.sla ?? "").toLowerCase().includes("estour") || (d.sla ?? "").toLowerCase().includes("crit")).length;
    return [
      { icon: Inbox, label: "Demandas ativas", value: demandas.length },
      { icon: Timer, label: "Horas no mês", value: `${horasMes}h` },
      { icon: AlertTriangle, label: "SLA crítico", value: slaCrit },
      { icon: Users, label: "Lançamentos", value: hours.length },
    ];
  }, [isAgil, hus, activities, demandas, hours]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl h-[82vh] p-0 overflow-hidden flex flex-col gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start gap-4">
            <UserAvatar name={devName} size="lg" />
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-semibold tracking-tight">{devName}</DialogTitle>
              <DialogDescription className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> {teamName}
                </span>
                <span className="text-muted-foreground/40">•</span>
                <Badge variant="outline" className={cn("font-medium", isAgil ? "border-emerald-500/40 text-emerald-600 bg-emerald-500/5" : "border-blue-500/40 text-blue-600 bg-blue-500/5")}>
                  {isAgil ? "Sala Ágil" : "Sustentação"}
                </Badge>
              </DialogDescription>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
            {kpis.map((k, i) => <Kpi key={i} {...k} tone={isAgil ? "agil" : "sust"} />)}
          </div>
        </DialogHeader>

        {error && (
          <div className="mx-6 mt-4 text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded p-3">{error}</div>
        )}

        <Tabs defaultValue={isAgil ? "hus" : "demandas"} className="flex-1 overflow-hidden flex flex-col px-6 pt-4 pb-6">
          <TabsList className="self-start bg-muted/60">
            {isAgil ? (
              <>
                <TabsTrigger value="hus" className="gap-2">
                  <Layers className="h-3.5 w-3.5" /> HUs
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{hus.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="acts" className="gap-2">
                  <ListChecks className="h-3.5 w-3.5" /> Atividades
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{activities.length}</Badge>
                </TabsTrigger>
              </>
            ) : (
              <>
                <TabsTrigger value="demandas" className="gap-2">
                  <Inbox className="h-3.5 w-3.5" /> Demandas
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{demandas.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="hours" className="gap-2">
                  <Clock className="h-3.5 w-3.5" /> Horas lançadas
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{hours.length}</Badge>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <div className="flex-1 overflow-hidden mt-3 border rounded-lg bg-card">
            {loading && (
              <div className="p-4 space-y-2">
                {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            )}

            {!loading && isAgil && (
              <>
                <TabsContent value="hus" className="m-0 h-full">
                  {hus.length === 0
                    ? <div className="p-6"><EmptyState icon={Layers} title="Nenhuma HU atribuída" description="Este membro não possui histórias de usuário em andamento neste time." /></div>
                    : <ScrollArea className="h-full">
                        <Table>
                          <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                            <TableRow>
                              <TableHead>Título</TableHead>
                              <TableHead>Sprint</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">SP</TableHead>
                              <TableHead className="text-right">Horas est.</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {hus.map(h => (
                              <TableRow key={h.id} className="even:bg-muted/20">
                                <TableCell className="font-medium">{h.title}</TableCell>
                                <TableCell className="text-muted-foreground text-xs">{h.sprint_name ?? "Backlog"}</TableCell>
                                <TableCell><StatusBadge label={h.status} /></TableCell>
                                <TableCell className="text-right tabular-nums">{h.story_points ?? "—"}</TableCell>
                                <TableCell className="text-right tabular-nums">{h.estimated_hours != null ? `${h.estimated_hours}h` : "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                  }
                </TabsContent>
                <TabsContent value="acts" className="m-0 h-full">
                  {activities.length === 0
                    ? <div className="p-6"><EmptyState icon={ListChecks} title="Nenhuma atividade" description="Sem atividades vinculadas a este membro." /></div>
                    : <ScrollArea className="h-full">
                        <Table>
                          <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                            <TableRow>
                              <TableHead>Atividade</TableHead>
                              <TableHead>HU</TableHead>
                              <TableHead>Período</TableHead>
                              <TableHead className="text-right">Horas</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activities.map(a => (
                              <TableRow key={a.id} className="even:bg-muted/20">
                                <TableCell className="font-medium">{a.title}</TableCell>
                                <TableCell className="text-muted-foreground text-xs truncate max-w-[220px]">{a.hu_title ?? "—"}</TableCell>
                                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{fmtDate(a.start_date)} → {fmtDate(a.end_date)}</TableCell>
                                <TableCell className="text-right tabular-nums">{a.hours}h</TableCell>
                                <TableCell>
                                  <StatusBadge label={a.is_closed ? "Concluída" : "Em andamento"} variant={a.is_closed ? "secondary" : "outline"} />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                  }
                </TabsContent>
              </>
            )}

            {!loading && !isAgil && (
              <>
                <TabsContent value="demandas" className="m-0 h-full">
                  {demandas.length === 0
                    ? <div className="p-6"><EmptyState icon={Inbox} title="Nenhuma demanda em andamento" description="Este membro não está vinculado a demandas ativas." /></div>
                    : <ScrollArea className="h-full">
                        <Table>
                          <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur z-10">
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
                            {demandas.map(d => (
                              <TableRow key={d.id} className="even:bg-muted/20">
                                <TableCell className="font-mono text-xs">{d.rhm}</TableCell>
                                <TableCell className="text-muted-foreground text-xs">{d.projeto}</TableCell>
                                <TableCell className="font-medium truncate max-w-[260px]">{d.titulo ?? "—"}</TableCell>
                                <TableCell><StatusBadge label={SITUACAO_LABELS[d.situacao] ?? d.situacao} /></TableCell>
                                <TableCell className="text-xs">{d.sla ?? "—"}</TableCell>
                                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{fmtDate(d.created_at)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                  }
                </TabsContent>
                <TabsContent value="hours" className="m-0 h-full">
                  {hours.length === 0
                    ? <div className="p-6"><EmptyState icon={Clock} title="Nenhuma hora lançada" description="Sem apontamentos de horas para este membro." /></div>
                    : <ScrollArea className="h-full">
                        <Table>
                          <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                            <TableRow>
                              <TableHead>Data</TableHead>
                              <TableHead>Demanda</TableHead>
                              <TableHead>Fase</TableHead>
                              <TableHead className="text-right">Horas</TableHead>
                              <TableHead>Descrição</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {hours.map(h => (
                              <TableRow key={h.id} className="even:bg-muted/20">
                                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{fmtDate(h.created_at)}</TableCell>
                                <TableCell className="font-mono text-xs">#{h.demanda_rhm}</TableCell>
                                <TableCell><StatusBadge label={h.fase} /></TableCell>
                                <TableCell className="text-right tabular-nums">{h.horas}h</TableCell>
                                <TableCell className="truncate max-w-[280px] text-xs text-muted-foreground">{h.descricao ?? "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                  }
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}