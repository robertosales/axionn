import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemberCapacityDetail } from "../hooks/useMemberCapacityDetail";
import { SITUACAO_LABELS } from "@/features/sustentacao/types/demanda";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export function CapacityMemberDetailDialog({
  open, onClose, teamId, teamName, module, devId, devName,
}: Props) {
  const isAgil = module === "sala_agil";
  const { loading, error, hus, activities, demandas, hours } = useMemberCapacityDetail({
    teamId, devId, module, enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {devName}
            <Badge variant="outline" className={isAgil ? "border-emerald-500 text-emerald-600" : "border-blue-500 text-blue-600"}>
              {isAgil ? "Sala Ágil" : "Sustentação"}
            </Badge>
          </DialogTitle>
          <DialogDescription>{teamName}</DialogDescription>
        </DialogHeader>

        {error && (
          <div className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded p-3">{error}</div>
        )}

        <Tabs defaultValue={isAgil ? "hus" : "demandas"} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="self-start">
            {isAgil ? (
              <>
                <TabsTrigger value="hus">HUs ({hus.length})</TabsTrigger>
                <TabsTrigger value="acts">Atividades ({activities.length})</TabsTrigger>
              </>
            ) : (
              <>
                <TabsTrigger value="demandas">Demandas ({demandas.length})</TabsTrigger>
                <TabsTrigger value="hours">Horas lançadas ({hours.length})</TabsTrigger>
              </>
            )}
          </TabsList>

          <div className="flex-1 overflow-auto mt-3 border rounded">
            {loading && <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>}

            {!loading && isAgil && (
              <>
                <TabsContent value="hus" className="m-0">
                  {hus.length === 0
                    ? <p className="p-6 text-center text-xs text-muted-foreground">Nenhuma HU atribuída.</p>
                    : <table className="w-full text-xs">
                        <thead className="bg-muted/60 sticky top-0">
                          <tr className="text-left">
                            <th className="px-3 py-2">Título</th>
                            <th className="px-3 py-2">Sprint</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2 text-right">SP</th>
                            <th className="px-3 py-2 text-right">Horas est.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hus.map(h => (
                            <tr key={h.id} className="border-t">
                              <td className="px-3 py-2">{h.title}</td>
                              <td className="px-3 py-2 text-muted-foreground">{h.sprint_name ?? "Backlog"}</td>
                              <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{h.status}</Badge></td>
                              <td className="px-3 py-2 text-right">{h.story_points ?? "—"}</td>
                              <td className="px-3 py-2 text-right">{h.estimated_hours ?? "—"}h</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                  }
                </TabsContent>
                <TabsContent value="acts" className="m-0">
                  {activities.length === 0
                    ? <p className="p-6 text-center text-xs text-muted-foreground">Nenhuma atividade.</p>
                    : <table className="w-full text-xs">
                        <thead className="bg-muted/60 sticky top-0">
                          <tr className="text-left">
                            <th className="px-3 py-2">Atividade</th>
                            <th className="px-3 py-2">HU</th>
                            <th className="px-3 py-2">Período</th>
                            <th className="px-3 py-2 text-right">Horas</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activities.map(a => (
                            <tr key={a.id} className="border-t">
                              <td className="px-3 py-2">{a.title}</td>
                              <td className="px-3 py-2 text-muted-foreground truncate max-w-[200px]">{a.hu_title ?? "—"}</td>
                              <td className="px-3 py-2 text-muted-foreground">{fmtDate(a.start_date)} – {fmtDate(a.end_date)}</td>
                              <td className="px-3 py-2 text-right">{a.hours}h</td>
                              <td className="px-3 py-2">
                                <Badge variant={a.is_closed ? "secondary" : "outline"} className="text-[10px]">
                                  {a.is_closed ? "Concluída" : "Em andamento"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                  }
                </TabsContent>
              </>
            )}

            {!loading && !isAgil && (
              <>
                <TabsContent value="demandas" className="m-0">
                  {demandas.length === 0
                    ? <p className="p-6 text-center text-xs text-muted-foreground">Nenhuma demanda em andamento.</p>
                    : <table className="w-full text-xs">
                        <thead className="bg-muted/60 sticky top-0">
                          <tr className="text-left">
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Projeto</th>
                            <th className="px-3 py-2">Título</th>
                            <th className="px-3 py-2">Situação</th>
                            <th className="px-3 py-2">SLA</th>
                            <th className="px-3 py-2">Criada em</th>
                          </tr>
                        </thead>
                        <tbody>
                          {demandas.map(d => (
                            <tr key={d.id} className="border-t">
                              <td className="px-3 py-2 font-mono">{d.rhm}</td>
                              <td className="px-3 py-2 text-muted-foreground">{d.projeto}</td>
                              <td className="px-3 py-2 truncate max-w-[260px]">{d.titulo ?? "—"}</td>
                              <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{SITUACAO_LABELS[d.situacao] ?? d.situacao}</Badge></td>
                              <td className="px-3 py-2">{d.sla ?? "—"}</td>
                              <td className="px-3 py-2 text-muted-foreground">{fmtDate(d.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                  }
                </TabsContent>
                <TabsContent value="hours" className="m-0">
                  {hours.length === 0
                    ? <p className="p-6 text-center text-xs text-muted-foreground">Nenhuma hora lançada.</p>
                    : <table className="w-full text-xs">
                        <thead className="bg-muted/60 sticky top-0">
                          <tr className="text-left">
                            <th className="px-3 py-2">Data</th>
                            <th className="px-3 py-2">Demanda</th>
                            <th className="px-3 py-2">Fase</th>
                            <th className="px-3 py-2 text-right">Horas</th>
                            <th className="px-3 py-2">Descrição</th>
                          </tr>
                        </thead>
                        <tbody>
                          {hours.map(h => (
                            <tr key={h.id} className="border-t">
                              <td className="px-3 py-2 text-muted-foreground">{fmtDate(h.created_at)}</td>
                              <td className="px-3 py-2 font-mono">#{h.demanda_rhm}</td>
                              <td className="px-3 py-2">{h.fase}</td>
                              <td className="px-3 py-2 text-right">{h.horas}h</td>
                              <td className="px-3 py-2 truncate max-w-[280px]">{h.descricao ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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