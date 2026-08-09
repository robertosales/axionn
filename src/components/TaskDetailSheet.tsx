import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, ListTodo, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { useSprint } from "@/contexts/SprintContext";
import { ACTIVITY_TYPE_LABELS, type ActivityType } from "@/types/sprint";
import { canonicalizeDevelopers } from "@/lib/developerIdentity";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

interface TaskDetailSheetProps {
  taskId: string | null;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
}

export function TaskDetailSheet({ taskId, open, onClose, canEdit }: TaskDetailSheetProps) {
  const { activities, developers, userStories, updateActivity, closeActivity, reopenActivity } = useSprint();
  const task = activities.find((activity) => activity.id === taskId) ?? null;
  const hu = task ? userStories.find((story) => story.id === task.huId) : null;
  const developerOptions = useMemo(() => canonicalizeDevelopers(developers), [developers]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>("task");
  const [assigneeId, setAssigneeId] = useState("");
  const [hours, setHours] = useState("0");
  const [startDate, setStartDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setActivityType(task.activityType);
    setAssigneeId(task.assigneeId ?? "");
    setHours(String(task.hours ?? 0));
    setStartDate(task.startDate ?? "");
  }, [task]);

  const handleSave = async () => {
    if (!task || !title.trim()) return;
    setSubmitting(true);
    try {
      await updateActivity(task.id, {
        title: title.trim(),
        description: description.trim(),
        activityType,
        assigneeId,
        hours: Number(hours),
        startDate,
      });
      toast.success("Tarefa atualizada com sucesso");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async () => {
    if (!task) return;
    if (task.isClosed) {
      await reopenActivity(task.id);
      toast.info("Tarefa reaberta");
    } else {
      await closeActivity(task.id);
      toast.success("Tarefa concluída");
    }
  };

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <SheetHeader className="border-b bg-muted/30 px-5 py-5 pr-12 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ListTodo className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono">{hu?.code ?? "HU"}</Badge>
                <Badge className={task?.isClosed ? "bg-success/15 text-success" : "bg-info/15 text-info"}>
                  {task?.isClosed ? "Concluída" : "Aberta"}
                </Badge>
              </div>
              <SheetTitle>Detalhes da tarefa</SheetTitle>
              <SheetDescription className="truncate">{hu?.title ?? "Tarefa vinculada à User Story"}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {task ? (
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <div>
              <Label htmlFor="task-detail-title">Título</Label>
              <Input id="task-detail-title" value={title} onChange={(event) => setTitle(event.target.value)} disabled={!canEdit} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="task-detail-description">Descrição</Label>
              <Textarea id="task-detail-description" value={description} onChange={(event) => setDescription(event.target.value)} disabled={!canEdit} className="mt-1.5 min-h-28 resize-y" />
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
                <Label htmlFor="task-detail-hours">Estimativa em horas</Label>
                <div className="relative mt-1.5">
                  <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="task-detail-hours" type="number" min="0" step="0.25" value={hours} onChange={(event) => setHours(event.target.value)} disabled={!canEdit} className="pl-9" />
                </div>
              </div>
              <div>
                <Label htmlFor="task-detail-start">Data de início</Label>
                <Input id="task-detail-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} disabled={!canEdit} className="mt-1.5" />
              </div>
            </div>
          </div>
        ) : null}

        {task && canEdit ? (
          <SheetFooter className="mt-auto gap-2 border-t bg-background px-5 py-4">
            <Button type="button" variant="outline" onClick={toggleStatus} className="gap-2">
              {task.isClosed ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
              {task.isClosed ? "Reabrir tarefa" : "Concluir tarefa"}
            </Button>
            <Button type="button" onClick={handleSave} disabled={submitting || !title.trim()} className="gap-2">
              <Save className="h-4 w-4" /> {submitting ? "Salvando..." : "Salvar alterações"}
            </Button>
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
