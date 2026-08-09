import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronRight, Clock, ListTodo, Plus, RotateCcw, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { useSprint } from "@/contexts/SprintContext";
import { ACTIVITY_TYPE_LABELS, type ActivityType } from "@/types/sprint";
import { canonicalizeDevelopers } from "@/lib/developerIdentity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type PanelView = "list" | "detail" | "create";

interface TaskDetailSheetProps {
  taskId?: string | null;
  huId?: string | null;
  initialView?: "list" | "create";
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
}

export function TaskDetailSheet({ taskId = null, huId = null, initialView = "list", open, onClose, canEdit }: TaskDetailSheetProps) {
  const { activities, developers, userStories, addActivity, updateActivity, closeActivity, reopenActivity } = useSprint();
  const [view, setView] = useState<PanelView>(taskId ? "detail" : initialView);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(taskId);
  const activeTask = activities.find((activity) => activity.id === activeTaskId) ?? null;
  const resolvedHuId = huId ?? activeTask?.huId ?? null;
  const hu = userStories.find((story) => story.id === resolvedHuId) ?? null;
  const huTasks = useMemo(() => activities.filter((activity) => activity.huId === resolvedHuId), [activities, resolvedHuId]);
  const completedCount = huTasks.filter((task) => task.isClosed).length;
  const progress = huTasks.length > 0 ? Math.round((completedCount / huTasks.length) * 100) : 0;
  const developerOptions = useMemo(() => canonicalizeDevelopers(developers), [developers]);
  const [search, setSearch] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("task");
  const [assigneeId, setAssigneeId] = useState("");
  const [hours, setHours] = useState("4");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActiveTaskId(taskId);
    setView(taskId ? "detail" : initialView);
    setSearch("");
  }, [initialView, open, taskId]);

  useEffect(() => {
    if (!activeTask) return;
    setTitle(activeTask.title);
    setDescription(activeTask.description ?? "");
    setActivityType(activeTask.activityType);
    setAssigneeId(activeTask.assigneeId ?? "");
    setHours(String(activeTask.hours ?? 0));
    setStartDate(activeTask.startDate ?? "");
  }, [activeTask]);

  const resetCreateForm = () => {
    setTitle("");
    setDescription("");
    setActivityType("task");
    setAssigneeId("");
    setHours("4");
    setStartDate(new Date().toISOString().slice(0, 10));
  };

  const openTask = (id: string) => {
    setActiveTaskId(id);
    setView("detail");
  };

  const returnToList = () => {
    setActiveTaskId(null);
    setView("list");
  };

  const handleSave = async () => {
    if (!activeTask || !title.trim()) return;
    setSubmitting(true);
    try {
      await updateActivity(activeTask.id, { title: title.trim(), description: description.trim(), activityType, assigneeId, hours: Number(hours), startDate });
      toast.success("Tarefa atualizada com sucesso");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async () => {
    if (!resolvedHuId || !title.trim() || !assigneeId) {
      toast.error("Informe o título e o responsável da tarefa");
      return;
    }
    setSubmitting(true);
    try {
      await addActivity({ title: title.trim(), description: description.trim(), activityType, huId: resolvedHuId, assigneeId, hours: Number(hours), startDate });
      toast.success("Tarefa criada com sucesso");
      resetCreateForm();
      setView("list");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async () => {
    if (!activeTask) return;
    if (activeTask.isClosed) {
      await reopenActivity(activeTask.id);
      toast.info("Tarefa reaberta");
    } else {
      await closeActivity(activeTask.id);
      toast.success("Tarefa concluída");
    }
  };

  const visibleTasks = search.trim()
    ? huTasks.filter((task) => task.title.toLowerCase().includes(search.trim().toLowerCase()))
    : huTasks;

  const formFields = (
    <div className="space-y-5">
      <div>
        <Label htmlFor="task-panel-title">Título</Label>
        <Input id="task-panel-title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={!canEdit} className="mt-1.5" autoFocus={view === "create"} />
      </div>
      <div>
        <Label htmlFor="task-panel-description">Descrição</Label>
        <Textarea id="task-panel-description" value={description} onChange={(event) => setDescription(event.target.value)} disabled={!canEdit} className="mt-1.5 min-h-28 resize-y" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Tipo</Label>
          <Select value={activityType} onValueChange={(value) => setActivityType(value as ActivityType)} disabled={!canEdit}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(ACTIVITY_TYPE_LABELS).map(([key, value]) => <SelectItem key={key} value={key}>{value.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Responsável</Label>
          <Select value={assigneeId || "none"} onValueChange={(value) => setAssigneeId(value === "none" ? "" : value)} disabled={!canEdit}>
            <SelectTrigger className="mt-1.5"><SelectValue placeholder="Sem responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sem responsável</SelectItem>
              {developerOptions.map((developer) => <SelectItem key={developer.id} value={developer.id}>{developer.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="task-panel-hours">Estimativa em horas</Label>
          <div className="relative mt-1.5">
            <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="task-panel-hours" type="number" min="0" step="0.25" value={hours} onChange={(event) => setHours(event.target.value)} disabled={!canEdit} className="pl-9" />
          </div>
        </div>
        <div>
          <Label htmlFor="task-panel-start">Data de início</Label>
          <Input id="task-panel-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} disabled={!canEdit} className="mt-1.5" />
        </div>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent overlayClassName="bg-black/25" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[480px]">
        <SheetHeader className="border-b bg-muted/30 px-5 py-5 pr-12 text-left">
          {view !== "list" ? (
            <button type="button" onClick={returnToList} className="mb-3 flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ArrowLeft className="h-3.5 w-3.5" /> Tarefas da HU
            </button>
          ) : null}
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ListTodo className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2"><Badge variant="outline" className="font-mono">{hu?.code ?? "HU"}</Badge><span className="text-xs text-muted-foreground">{completedCount} de {huTasks.length} concluída{completedCount === 1 ? "" : "s"}</span></div>
              <SheetTitle>{view === "list" ? "Tarefas da HU" : view === "create" ? "Nova tarefa" : activeTask?.title ?? "Detalhes da tarefa"}</SheetTitle>
              <SheetDescription className="line-clamp-2">{hu?.title ?? "Tarefa vinculada à User Story"}</SheetDescription>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3"><Progress value={progress} className="h-1.5" /><span className="text-xs font-semibold tabular-nums text-muted-foreground">{progress}%</span></div>
        </SheetHeader>

        {view === "list" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">{huTasks.length} {huTasks.length === 1 ? "tarefa vinculada" : "tarefas vinculadas"}</p>
              {canEdit ? <Button size="sm" className="gap-1.5" onClick={() => { resetCreateForm(); setView("create"); }}><Plus className="h-4 w-4" /> Adicionar tarefa</Button> : null}
            </div>
            {huTasks.length > 10 ? <div className="relative mb-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tarefa..." className="pl-9" /></div> : null}
            {visibleTasks.length > 0 ? (
              <div className="space-y-2">
                {visibleTasks.map((task) => {
                  const assignee = developerOptions.find((developer) => developer.id === task.assigneeId);
                  return (
                    <button key={task.id} type="button" onClick={() => openTask(task.id)} className="group w-full rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/30 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <div className="flex items-start justify-between gap-3"><p className={`min-w-0 flex-1 text-sm font-medium ${task.isClosed ? "text-muted-foreground line-through" : ""}`}>{task.title}</p><ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><Badge className={task.isClosed ? "bg-success/15 text-success" : "bg-info/15 text-info"}>{task.isClosed ? "Concluída" : "Aberta"}</Badge><span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"><span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">{assignee?.name?.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "—"}</span><span className="truncate">{assignee?.name ?? "Sem responsável"}</span></span></div>
                    </button>
                  );
                })}
              </div>
            ) : huTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-5 text-center"><p className="text-sm font-medium">Nenhuma tarefa vinculada a esta HU.</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Organize o trabalho desta história criando sua primeira tarefa.</p>{canEdit ? <Button size="sm" className="mt-4 gap-1.5" onClick={() => { resetCreateForm(); setView("create"); }}><Plus className="h-4 w-4" /> Adicionar tarefa</Button> : null}</div>
            ) : <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma tarefa encontrada.</p>}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{formFields}</div>
        )}

        {view === "detail" && activeTask && canEdit ? <SheetFooter className="mt-auto gap-2 border-t bg-background px-5 py-4"><Button type="button" variant="outline" onClick={toggleStatus} className="gap-2">{activeTask.isClosed ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}{activeTask.isClosed ? "Reabrir tarefa" : "Concluir tarefa"}</Button><Button type="button" onClick={handleSave} disabled={submitting || !title.trim()} className="gap-2"><Save className="h-4 w-4" /> {submitting ? "Salvando..." : "Salvar alterações"}</Button></SheetFooter> : null}
        {view === "create" && canEdit ? <SheetFooter className="mt-auto gap-2 border-t bg-background px-5 py-4"><Button type="button" variant="outline" onClick={returnToList}>Cancelar</Button><Button type="button" onClick={handleCreate} disabled={submitting || !title.trim() || !assigneeId} className="gap-2"><Plus className="h-4 w-4" /> {submitting ? "Criando..." : "Criar tarefa"}</Button></SheetFooter> : null}
      </SheetContent>
    </Sheet>
  );
}
