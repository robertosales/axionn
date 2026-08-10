import { useState } from "react";
import { useSprint } from "@/contexts/SprintContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSalaAgilPermission } from "@/hooks/useSalaAgilPermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Zap, Plus, Calendar, Target, Trash2, Pencil, AlertTriangle, Info, BookOpen, Building2, ArrowRight, CircleDot } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { HUEditDrawer } from "@/components/HUEditDrawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSprintStatus } from "@/utils/sprintStatus";
import { formatSprintDate, formatSprintPeriod, formatSprintPoints, getSprintDisplayName } from "@/utils/sprintPresentation";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface SprintManagerProps {
  selectedSprintId?: string | null;
  onSelectSprint?: (sprintId: string) => void;
}

export function SprintManager({ selectedSprintId, onSelectSprint }: SprintManagerProps) {
  const { sprints, addSprint, updateSprint, setActiveSprint, removeSprint, closeSprint, userStories, workflowColumns, addImpediment, developers, epics, features } = useSprint() as any;
  const { currentTeamId, teams } = useAuth();
  const [open, setOpen] = useState(false);
  const canCreate = useSalaAgilPermission("create_sprint");
  const canEdit   = useSalaAgilPermission("edit_sprint");
  const canDelete = useSalaAgilPermission("delete_sprint");
  const canReportImpediment = useSalaAgilPermission("report_impediment");

  const [editId, setEditId]       = useState<string | null>(null);
  const [name, setName]           = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate]     = useState("");
  const [goal, setGoal]           = useState("");
  const [errors, setErrors]       = useState<Record<string, string>>({});

  const [confirmCloseId, setConfirmCloseId]           = useState<string | null>(null);
  const [impedimentSprintId, setImpedimentSprintId]   = useState<string | null>(null);
  const [impedimentReason, setImpedimentReason]       = useState("");
  const [impedimentStartedAt, setImpedimentStartedAt] = useState(todayISO);
  const [detailSprint, setDetailSprint]               = useState<any | null>(null);
  const [detailHuId, setDetailHuId]                   = useState<string | null>(null);

  const resetForm = () => { setName(""); setStartDate(""); setEndDate(""); setGoal(""); setErrors({}); setEditId(null); };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Nome da sprint \u00e9 obrigat\u00f3rio";
    if (!startDate)   e.startDate = "Data de in\u00edcio \u00e9 obrigat\u00f3ria";
    if (!endDate)     e.endDate   = "Data de t\u00e9rmino \u00e9 obrigat\u00f3ria";
    if (startDate && endDate && startDate >= endDate) e.endDate = "Data fim deve ser posterior \u00e0 data in\u00edcio";
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
      toast.error(`N\u00e3o \u00e9 poss\u00edvel excluir: esta Sprint possui ${sprintHUs.length} HU(s) vinculada(s). Remova-as primeiro.`);
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
    const lastCol         = workflowColumns[workflowColumns.length - 1]?.key;
    const totalPoints     = sprintHUs.reduce((s: number, hu: any) => s + (hu.storyPoints ?? 0), 0);
    const completedPoints = sprintHUs.filter((hu: any) => hu.status === lastCol).reduce((s: number, hu: any) => s + (hu.storyPoints ?? 0), 0);
    return { totalPoints, completedPoints, percent: totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0 };
  };

  async function handleConfirmImpediment() {
    const reason = impedimentReason.trim();
    if (!reason) { toast.error("Informe o motivo do impedimento."); return; }
    try {
      let saved = false;
      if (typeof addImpediment === "function") {
        saved = await addImpediment(
          { sprintId: impedimentSprintId },
          {
            reason,
            type: "outro",
            criticality: "media",
            hasTicket: false,
            startedAt: impedimentStartedAt || undefined,
          },
        );
      }
      if (!saved) return;
      toast.success("Impedimento registrado na sprint.");
      setImpedimentSprintId(null); setImpedimentReason(""); setImpedimentStartedAt(todayISO());
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao registrar impedimento.");
    }
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold tracking-tight">Sprints</h2>
          <Badge variant="secondary">{sprints.length}</Badge>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Nova Sprint
              </Button>
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
                  <Input value={name}
                    onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }}
                    placeholder="Sprint 1" className="mt-1" />
                  {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>In\u00edcio <span className="text-destructive">*</span></Label>
                    <Input type="date" value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setErrors((p) => ({ ...p, startDate: "" })); }}
                      className="mt-1" />
                    {errors.startDate && <p className="text-xs text-destructive mt-1">{errors.startDate}</p>}
                  </div>
                  <div>
                    <Label>Fim <span className="text-destructive">*</span></Label>
                    <Input type="date" value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); setErrors((p) => ({ ...p, endDate: "" })); }}
                      className="mt-1" />
                    {errors.endDate && <p className="text-xs text-destructive mt-1">{errors.endDate}</p>}
                  </div>
                </div>
                <div>
                  <Label>Objetivo da Sprint</Label>
                  <Textarea value={goal} onChange={(e) => setGoal(e.target.value)}
                    placeholder="O que esperamos entregar nessa sprint?" className="mt-1" />
                </div>
                <Button type="submit" className="w-full gap-2">
                  <Zap className="h-4 w-4" /> {editId ? "Salvar Altera\u00e7\u00f5es" : "Criar Sprint"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Grid de sprints — 1 coluna em mobile, 2 em md, 3 em xl */}
      {/* Cada card ocupa 100% da c\u00e9lula, sem min-width fixo */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {sprints.map((sprint: any) => {
          const progress  = getSprintProgress(sprint.id);
          const sprintHUs = userStories.filter((hu: any) => hu.sprintId === sprint.id);
          const displayName = getSprintDisplayName(sprint.name);
          const status = getSprintStatus(sprint);
          return (
            <ContextMenu key={sprint.id}>
              <ContextMenuTrigger asChild>
                <div
                  className={[
                    "group relative rounded-xl border bg-card cursor-pointer",
                    "transition-all duration-150 hover:shadow-md",
                    selectedSprintId === sprint.id
                      ? "border-primary shadow-sm ring-1 ring-primary/40"
                      : "border-border opacity-80 hover:opacity-100",
                  ].join(" ")}
                  onClick={() => {
                    onSelectSprint?.(sprint.id);
                    setDetailSprint(sprint);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={selectedSprintId === sprint.id}
                  aria-label={`Abrir detalhes de ${displayName.title}`}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectSprint?.(sprint.id);
                      setDetailSprint(sprint);
                    }
                  }}
                >
                  {/* Faixa superior colorida para sprint ativa */}
                  {sprint.isActive && (
                    <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-xl bg-primary" />
                  )}

                  <div className="p-4">
                    {/* Linha 1: nome + status + a\u00e7\u00f5es */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold leading-snug" title={sprint.name}>{displayName.title}</span>
                        {displayName.reference && <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">{displayName.reference}</span>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <SprintStatusBadge sprint={sprint} />
                        {canEdit && !sprint.closedAt && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); openEdit(sprint.id); }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        {canDelete && !sprint.isActive && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); handleRemoveSprint(sprint.id); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {status.delayDays > 0 && (
                      <p className="mt-1 text-[10px] font-medium text-destructive">
                        {status.delayDays} {status.delayDays === 1 ? "dia" : "dias"} de atraso
                      </p>
                    )}

                    {/* Linha 2: datas */}
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                      <Calendar className="h-3 w-3 shrink-0" />
                      {formatSprintPeriod(sprint.startDate, sprint.endDate)}
                    </div>

                    {/* Linha 3: objetivo */}
                    {sprint.goal && (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground mt-1.5">
                        <Target className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="line-clamp-2">{sprint.goal}</span>
                      </div>
                    )}

                    {/* Linha 4: progress */}
                    <div className="mt-3 space-y-1.5 border-t border-border/50 pt-3">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{formatSprintPoints(progress.completedPoints, progress.totalPoints)}</span>
                          <span className="font-semibold">{progress.percent}%</span>
                        </div>
                        <Progress value={progress.percent} className="h-1.5" />
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{sprintHUs.length} HU{sprintHUs.length !== 1 ? "s" : ""}</span>
                          <span className="inline-flex items-center gap-1 font-medium text-primary">
                            Ver detalhes <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          </span>
                        </div>
                    </div>
                  </div>
                </div>
              </ContextMenuTrigger>

              <ContextMenuContent className="w-52">
                {!sprint.closedAt && !sprint.isActive && canEdit && (
                  <ContextMenuItem onClick={(e) => { e.stopPropagation(); setActiveSprint(sprint.id); }}>
                    <Zap className="h-3.5 w-3.5 mr-2 text-primary" />Definir como sprint ativa
                  </ContextMenuItem>
                )}
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
                {sprint.isActive && canReportImpediment && (
                  <>
                    <ContextMenuSeparator />
                    <ContextMenuItem onClick={(e) => {
                      e.stopPropagation();
                      setImpedimentReason(""); setImpedimentStartedAt(todayISO()); setImpedimentSprintId(sprint.id);
                    }}>
                      <AlertTriangle className="h-3.5 w-3.5 mr-2 text-amber-500" />Inserir Impedimento
                    </ContextMenuItem>
                  </>
                )}
              </ContextMenuContent>
            </ContextMenu>
          );
        })}

        {sprints.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border">
            <div className="py-10 text-center text-muted-foreground">
              <Zap className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="font-medium">Nenhuma Sprint criada</p>
              <p className="text-sm mt-1">Crie sua primeira Sprint para come\u00e7ar a gerenciar o backlog</p>
            </div>
          </div>
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
              Esta a\u00e7\u00e3o registrar\u00e1 a data de encerramento e calcular\u00e1 os dias de atraso.
              <br /><br />
              <span className="text-destructive font-medium">Esta a\u00e7\u00e3o n\u00e3o pode ser desfeita.</span>
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
              Registrar um impedimento direto na sprint{" "}
              <strong>{sprints.find((s: any) => s.id === impedimentSprintId)?.name}</strong>.
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
                rows={3} className="resize-none text-sm" autoFocus
              />
            </div>
            <div>
              <Label htmlFor="sprint-impediment-started" className="text-sm mb-1.5 block">
                Data de in\u00edcio do impedimento
              </Label>
              <Input
                id="sprint-impediment-started"
                type="date" value={impedimentStartedAt}
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
        <DialogContent className="flex h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:h-[min(860px,calc(100dvh-3rem))] sm:w-[calc(100%-3rem)]">
          {detailSprint && (() => {
            const progress  = getSprintProgress(detailSprint.id);
            const sprintHUs = userStories.filter((hu: any) => hu.sprintId === detailSprint.id);
            const lastCol   = workflowColumns[workflowColumns.length - 1]?.key;
            const done      = sprintHUs.filter((hu: any) => hu.status === lastCol).length;
            const displayName = getSprintDisplayName(detailSprint.name);
            const sprintStatus = getSprintStatus(detailSprint);
            const teamName = teams.find((team) => team.id === currentTeamId)?.name;
            return (
              <>
                <DialogHeader className="border-b px-5 py-4 pr-12 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <DialogTitle className="flex min-w-0 items-center gap-2 text-xl">
                      <Zap className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                      <span className="truncate">{displayName.title}</span>
                    </DialogTitle>
                    {displayName.reference && <Badge variant="secondary">{displayName.reference}</Badge>}
                    <SprintStatusBadge sprint={detailSprint} />
                  </div>
                  <DialogDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
                    {teamName && <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" aria-hidden="true" />{teamName}</span>}
                    <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" aria-hidden="true" />{formatSprintPeriod(detailSprint.startDate, detailSprint.endDate)}</span>
                  </DialogDescription>
                </DialogHeader>

                <ScrollArea className="min-h-0 flex-1">
                  <div className="space-y-6 p-5 sm:p-6">
                    <section aria-labelledby="sprint-indicators" className="space-y-3">
                      <h3 id="sprint-indicators" className="text-sm font-semibold">Indicadores</h3>
                      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        {[
                          { label: "Histórias", value: sprintHUs.length },
                          { label: "Concluídas", value: done },
                          { label: "Progresso", value: `${progress.percent}%` },
                          { label: "Pontos", value: formatSprintPoints(progress.completedPoints, progress.totalPoints) },
                        ].map(({ label, value }) => (
                          <div key={label} className="rounded-lg border bg-card p-4">
                            <p className="text-lg font-semibold leading-tight">{value}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
                          </div>
                        ))}
                      </div>
                      <Progress value={progress.percent} className="h-2" aria-label={`${progress.percent}% dos pontos concluídos`} />
                    </section>

                    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                      <section aria-labelledby="sprint-goal" className="rounded-lg border bg-muted/30 p-4">
                        <div className="mb-2 flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" aria-hidden="true" />
                          <h3 id="sprint-goal" className="text-sm font-semibold">Objetivo</h3>
                        </div>
                        <p className={detailSprint.goal ? "text-sm leading-relaxed" : "text-sm text-muted-foreground"}>
                          {detailSprint.goal || "Nenhum objetivo foi informado para esta Sprint."}
                        </p>
                      </section>

                      <section aria-labelledby="sprint-period" className="rounded-lg border p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <CircleDot className="h-4 w-4 text-primary" aria-hidden="true" />
                          <h3 id="sprint-period" className="text-sm font-semibold">Período e situação</h3>
                        </div>
                        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
                          <dt className="text-muted-foreground">Início</dt><dd>{formatSprintDate(detailSprint.startDate)}</dd>
                          <dt className="text-muted-foreground">Término</dt><dd>{formatSprintDate(detailSprint.endDate)}</dd>
                          {detailSprint.closedAt && <><dt className="text-muted-foreground">Encerrada</dt><dd>{formatSprintDate(detailSprint.closedAt)}</dd></>}
                          <dt className="text-muted-foreground">Status</dt><dd>{sprintStatus.status === "ativa_atrasada" ? "Ativa" : sprintStatus.status === "encerrada" ? "Encerrada" : sprintStatus.label}</dd>
                          {sprintStatus.delayDays > 0 && <><dt className="text-muted-foreground">Atraso</dt><dd className="font-medium text-destructive">{sprintStatus.delayDays} {sprintStatus.delayDays === 1 ? "dia" : "dias"}</dd></>}
                        </dl>
                      </section>
                    </div>

                    <section aria-labelledby="sprint-stories" className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
                          <h3 id="sprint-stories" className="text-sm font-semibold">HUs da Sprint</h3>
                        </div>
                        <Badge variant="secondary">{sprintHUs.length}</Badge>
                      </div>
                      {sprintHUs.length === 0 ? (
                        <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                          Nenhuma história de usuário está vinculada a esta Sprint.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border">
                          <Table>
                            <TableHeader><TableRow>
                              <TableHead>HU</TableHead><TableHead>Título</TableHead><TableHead>Relacionamento</TableHead><TableHead>Status</TableHead><TableHead>Pontos</TableHead><TableHead>Responsável</TableHead>
                            </TableRow></TableHeader>
                            <TableBody>
                              {sprintHUs.map((hu) => {
                                const column = workflowColumns.find((col) => col.key === hu.status);
                                const epic = epics.find((item) => item.id === hu.epicId);
                                const feature = features.find((item) => item.id === hu.featureId);
                                const developer = developers.find((item) => item.id === hu.assigneeId);
                                const relationship = [epic?.name ?? epic?.title, feature?.name ?? feature?.title].filter(Boolean).join(" · ");
                                return (
                                  <TableRow key={hu.id}>
                                    <TableCell className="font-mono text-xs">{hu.code || "—"}</TableCell>
                                    <TableCell className="min-w-56">
                                      <button type="button" className="text-left font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" onClick={() => { setDetailSprint(null); setDetailHuId(hu.id); }}>
                                        {hu.title}
                                      </button>
                                    </TableCell>
                                    <TableCell className="max-w-64 text-muted-foreground">{relationship || "Não informado"}</TableCell>
                                    <TableCell><Badge variant="outline" className="gap-1.5 whitespace-nowrap"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: column?.hex ?? "#6b7280" }} aria-hidden="true" />{column?.label ?? hu.status}</Badge></TableCell>
                                    <TableCell>{hu.storyPoints ?? "—"}</TableCell>
                                    <TableCell>{developer?.name ?? "Não atribuído"}</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </section>
                  </div>
                </ScrollArea>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
      <HUEditDrawer huId={detailHuId} open={!!detailHuId} onClose={() => setDetailHuId(null)} />
    </div>
  );
}
