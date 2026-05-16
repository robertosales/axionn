import { useState } from "react";
import { useSprint } from "@/contexts/SprintContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Zap, Plus, Calendar, Target, Trash2, Pencil, AlertTriangle, Info } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { SprintStatusBadge } from "@/features/admin/components/SprintStatusBadge";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SprintManager() {
  const { sprints, addSprint, updateSprint, setActiveSprint, removeSprint, closeSprint, userStories, workflowColumns, addImpediment } = useSprint() as any;
  const { hasPermission } = useAuth();
  const [open, setOpen] = useState(false);
  const canCreate = hasPermission('create_sprint');
  const canEdit   = hasPermission('edit_sprint');
  const canDelete = hasPermission('delete_sprint');

  const [editId, setEditId]       = useState<string | null>(null);
  const [name, setName]           = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");
  const [goal, setGoal]           = useState("");
  const [errors, setErrors]       = useState<Record<string, string>>({});

  const [confirmCloseId, setConfirmCloseId]             = useState<string | null>(null);
  const [impedimentSprintId, setImpedimentSprintId]     = useState<string | null>(null);
  const [impedimentReason, setImpedimentReason]         = useState("");
  const [impedimentStartedAt, setImpedimentStartedAt]   = useState(todayISO);
  const [detailSprint, setDetailSprint]                 = useState<any | null>(null);

  const resetForm = () => { setName(""); setStartDate(""); setEndDate(""); setGoal(""); setErrors({}); setEditId(null); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Nome da sprint é obrigatório";
    if (!startDate)   e.startDate = "Data de início é obrigatória";
    if (!endDate)     e.endDate   = "Data de término é obrigatória";
    if (startDate && endDate && startDate >= endDate) e.endDate = "Data fim deve ser posterior à data início";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (editId) {
      updateSprint(editId, { name: name.trim(), startDate, endDate, goal: goal.trim() });
      toast.success("Sprint atualizada!");
    } else {
      addSprint({ name: name.trim(), startDate, endDate, goal: goal.trim() });
      toast.success("Sprint criada!");
    }
    resetForm(); setOpen(false);
  };

  const openEdit = (sprintId: string) => {
    const s = sprints.find((sp: any) => sp.id === sprintId);
    if (!s) return;
    setEditId(s.id); setName(s.name); setStartDate(s.startDate); setEndDate(s.endDate); setGoal(s.goal ?? ""); setErrors({});
    setOpen(true);
  };

  const handleRemoveSprint = (sprintId: string) => {
    const sprintHUs = userStories.filter((hu: any) => hu.sprintId === sprintId);
    if (sprintHUs.length > 0) {
      toast.error(`Não é possível excluir: esta Sprint possui ${sprintHUs.length} HU(s) vinculada(s). Remova-as primeiro.`);
      return;
    }
    removeSprint(sprintId);
    toast.info("Sprint removida");
  };

  const handleConfirmClose = async () => {
    if (!confirmCloseId) return;
    await closeSprint(confirmCloseId);
    setConfirmCloseId(null);
  };

  const getSprintProgress = (sprintId: string) => {
    const sprintHUs = userStories.filter((hu: any) => hu.sprintId === sprintId);
    if (sprintHUs.length === 0) return { totalPoints: 0, completedPoints: 0, percent: 0 };
    const lastCol = workflowColumns[workflowColumns.length - 1]?.key;
    const totalPoints     = sprintHUs.reduce((s: number, hu: any) => s + (hu.storyPoints ?? 0), 0);
    const completedPoints = sprintHUs.filter((hu: any) => hu.status === lastCol).reduce((s: number, hu: any) => s + (hu.storyPoints ?? 0), 0);
    return { totalPoints, completedPoints, percent: totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0 };
  };

  async function handleConfirmImpediment() {
    const reason = impedimentReason.trim();
    if (!reason) { toast.error("Informe o motivo do impedimento."); return; }
    try {
      if (typeof addImpediment === "function") {
        await addImpediment({ sprintId: impedimentSprintId }, {
          reason,
          startedAt: impedimentStartedAt || undefined,
        });
      }
      toast.success("Impedimento registrado na sprint.");
      setImpedimentSprintId(null); setImpedimentReason(""); setImpedimentStartedAt(todayISO());
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao registrar impedimento.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold tracking-tight">Sprints</h2>
          <Badge variant="secondary">{sprints.length}</Badge>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> Nova Sprint</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  {editId ? "Editar Sprint" : "Criar Sprint"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Nome <span className="text-destructive">*</span></Label>
                  <Input value={name} onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }} placeholder="Sprint 1" className="mt-1" />
                  {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Início <span className="text-destructive">*</span></Label>
                    <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setErrors((p) => ({ ...p, startDate: "" })); }} className="mt-1" />
                    {errors.startDate && <p className="text-xs text-destructive mt-1">{errors.startDate}</p>}
                  </div>
                  <div>
                    <Label>Fim <span className="text-destructive">*</span></Label>
                    <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setErrors((p) => ({ ...p, endDate: "" })); }} className="mt-1" />
                    {errors.endDate && <p className="text-xs text-destructive mt-1">{errors.endDate}</p>}
                  </div>
                </div>
                <div>
                  <Label>Objetivo da Sprint</Label>
                  <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="O que esperamos entregar nessa sprint?" className="mt-1" />
                </div>
                <Button type="submit" className="w-full gap-2">
                  <Zap className="h-4 w-4" /> {editId ? "Salvar Alterações" : "Criar Sprint"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        {sprints.map((sprint: any) => {
          const progress  = getSprintProgress(sprint.id);
          const sprintHUs = userStories.filter((hu: any) => hu.sprintId === sprint.id);
          return (
            <ContextMenu key={sprint.id}>
              <ContextMenuTrigger asChild>
                <Card
                  className={`cursor-pointer transition-all hover:shadow-md min-w-[280px] group ${
                    sprint.isActive ? "ring-2 ring-primary shadow-md" : "opacity-70 hover:opacity-100"
                  }`}
                  onClick={() => !sprint.closedAt && setActiveSprint(sprint.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{sprint.name}</span>
                      <div className="flex items-center gap-1">
                        {/* Badge de status semântico — usa getSprintStatus() internamente */}
                        <SprintStatusBadge sprint={sprint} />
                        {canEdit && !sprint.closedAt && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); openEdit(sprint.id); }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        {canDelete && !sprint.isActive && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100"
                            onClick={(e) => { e.stopPropagation(); handleRemoveSprint(sprint.id); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(sprint.startDate).toLocaleDateString("pt-BR")} — {new Date(sprint.endDate).toLocaleDateString("pt-BR")}
                    </div>
                    {sprint.goal && (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground mt-1.5">
                        <Target className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{sprint.goal}</span>
                      </div>
                    )}
                    {sprintHUs.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{progress.completedPoints}/{progress.totalPoints} pts</span>
                          <span className="font-semibold">{progress.percent}%</span>
                        </div>
                        <Progress value={progress.percent} className="h-1.5" />
                        <div className="text-[10px] text-muted-foreground">{sprintHUs.length} HU{sprintHUs.length !== 1 ? "s" : ""}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </ContextMenuTrigger>

              <ContextMenuContent className="w-52">
                <ContextMenuItem onClick={(e) => { e.stopPropagation(); setDetailSprint(sprint); }}>
                  <Info className="h-3.5 w-3.5 mr-2 text-blue-500" />Detalhar Sprint
                </ContextMenuItem>
                {sprint.isActive && canEdit && (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={(e) => { e.stopPropagation(); setConfirmCloseId(sprint.id); }}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Zap className="h-3.5 w-3.5 mr-2" />Encerrar Sprint
                    </ContextMenuItem>
                  </>
                )}
                {sprint.isActive && (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={(e) => { e.stopPropagation(); setImpedimentReason(""); setImpedimentStartedAt(todayISO()); setImpedimentSprintId(sprint.id); }}>
                      <AlertTriangle className="h-3.5 w-3.5 mr-2 text-amber-500" />Inserir Impedimento
                    </ContextMenuItem>
                  </>
                )}
              </ContextMenuContent>
            </ContextMenu>
          );
        })}

        {sprints.length === 0 && (
          <Card className="border-dashed w-full">
            <CardContent className="py-10 text-center text-muted-foreground">
              <Zap className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="font-medium">Nenhuma Sprint criada</p>
              <p className="text-sm mt-1">Crie sua primeira Sprint para começar a gerenciar o backlog</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirm: Encerrar Sprint */}
      <AlertDialog open={!!confirmCloseId} onOpenChange={(o) => { if (!o) setConfirmCloseId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Encerrar Sprint</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja encerrar a sprint{" "}
              <strong>{sprints.find((s: any) => s.id === confirmCloseId)?.name}</strong>?
              Esta ação registrará a data de encerramento e calculará os dias de atraso.
              <br /><br />
              <span className="text-destructive font-medium">Esta ação não pode ser desfeita.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose} className="bg-destructive hover:bg-destructive/90">
              Encerrar Sprint
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Inserir Impedimento na Sprint */}
      <AlertDialog open={!!impedimentSprintId} onOpenChange={(o) => { if (!o) { setImpedimentSprintId(null); setImpedimentReason(""); setImpedimentStartedAt(todayISO()); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inserir Impedimento</AlertDialogTitle>
            <AlertDialogDescription>
              Registrar um impedimento direto na sprint <strong>{sprints.find((s: any) => s.id === impedimentSprintId)?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-3">
            <div>
              <Label htmlFor="sprint-impediment-reason" className="text-sm mb-1.5 block">
                Motivo <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="sprint-impediment-reason"
                placeholder="Descreva o impedimento..."
                value={impedimentReason}
                onChange={(e) => setImpedimentReason(e.target.value)}
                rows={3}
                className="resize-none text-sm"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="sprint-impediment-started" className="text-sm mb-1.5 block">
                Data de início do impedimento
              </Label>
              <Input
                id="sprint-impediment-started"
                type="date"
                value={impedimentStartedAt}
                onChange={(e) => setImpedimentStartedAt(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmImpediment}
              disabled={!impedimentReason.trim()}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              Registrar impedimento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Detalhar Sprint */}
      <Dialog open={!!detailSprint} onOpenChange={(o) => { if (!o) setDetailSprint(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {detailSprint?.name}
              <SprintStatusBadge sprint={detailSprint ?? {}} className="ml-1" />
            </DialogTitle>
          </DialogHeader>
          {detailSprint && (() => {
            const progress  = getSprintProgress(detailSprint.id);
            const sprintHUs = userStories.filter((hu: any) => hu.sprintId === detailSprint.id);
            const lastCol   = workflowColumns[workflowColumns.length - 1]?.key;
            const done      = sprintHUs.filter((hu: any) => hu.status === lastCol).length;
            return (
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {new Date(detailSprint.startDate).toLocaleDateString("pt-BR")} — {new Date(detailSprint.endDate).toLocaleDateString("pt-BR")}
                  {detailSprint.closedAt && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      · Encerrada em {new Date(detailSprint.closedAt).toLocaleDateString("pt-BR")}
                      {detailSprint.delayDays > 0 && (
                        <span className="text-red-500 font-semibold ml-1">(+{detailSprint.delayDays}d atraso)</span>
                      )}
                    </span>
                  )}
                </div>
                {detailSprint.goal && (
                  <div className="rounded-md border bg-muted/40 p-3 text-sm">
                    <p className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Objetivo</p>
                    <p>{detailSprint.goal}</p>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3 text-center">
                  {[
                    { label: "HUs",        value: sprintHUs.length },
                    { label: "Concluídas", value: done },
                    { label: "Progresso",  value: `${progress.percent}%` },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-md border bg-muted/30 p-3">
                      <p className="text-xl font-bold">{value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Progresso por pontos</p>
                  <Progress value={progress.percent} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{progress.completedPoints} / {progress.totalPoints} pts</p>
                </div>
                {sprintHUs.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">HUs por status</p>
                    <div className="space-y-1">
                      {workflowColumns.map((col: any) => {
                        const count = sprintHUs.filter((hu: any) => hu.status === col.key).length;
                        if (count === 0) return null;
                        return (
                          <div key={col.key} className="flex items-center gap-2 text-xs">
                            <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ background: col.hex ?? "#6b7280" }} />
                            <span className="flex-1 text-muted-foreground">{col.label}</span>
                            <span className="font-semibold">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
