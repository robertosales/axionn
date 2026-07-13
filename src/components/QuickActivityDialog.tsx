import { useMemo, useState } from "react";
import { useSprint } from "@/contexts/SprintContext";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListTodo, Plus } from "lucide-react";
import { ActivityType, ACTIVITY_TYPE_LABELS } from "@/types/sprint";
import { toast } from "sonner";
import { FileUploader } from "@/components/FileUploader";
import { supabase } from "@/integrations/supabase/client";
import { canonicalizeDevelopers } from "@/lib/developerIdentity";

interface QuickActivityDialogProps {
  open: boolean;
  onClose: () => void;
  huId: string;
  defaultType?: ActivityType;
}

/**
 * Diálogo rápido para criar uma atividade diretamente a partir de um card de HU
 * (Kanban ou Backlog). Inclui upload de prints quando o tipo é "bug" e
 * dispara a regra de auto-move (HU vai para a coluna "bug").
 */
export function QuickActivityDialog({ open, onClose, huId, defaultType = "task" }: QuickActivityDialogProps) {
  const { developers, addActivity, userStories, workflowColumns, updateUserStoryStatus, refreshAll } = useSprint();
  const { currentTeamId } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activityType, setActivityType] = useState<ActivityType>(defaultType);
  const [assigneeId, setAssigneeId] = useState("");
  const [hours, setHours] = useState("4");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [createdActivityId, setCreatedActivityId] = useState<string | null>(null);

  const hu = userStories.find((h) => h.id === huId);
  const isLimitado = ["task", "bug"].includes(activityType);
  const developerOptions = useMemo(() => canonicalizeDevelopers(developers), [developers]);

  const reset = () => {
    setTitle("");
    setDescription("");
    setActivityType(defaultType);
    setAssigneeId("");
    setHours("4");
    setStartDate(new Date().toISOString().split("T")[0]);
    setCreatedActivityId(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Informe o título da tarefa");
      return;
    }
    if (!assigneeId) {
      toast.error("Selecione um responsável");
      return;
    }
    if (isLimitado && Number(hours) > 8) {
      toast.error("Máximo de 8 horas por atividade");
      return;
    }

    setSubmitting(true);
    try {
      await addActivity({
        title: title.trim(),
        description: description.trim(),
        activityType,
        huId,
        assigneeId,
        hours: Number(hours),
        startDate,
      });

      // Auto-move já é feito centralmente em SprintContext.addActivity.
      // Recupera o id da atividade recém-criada para permitir upload de prints
      if (activityType === "bug" && currentTeamId) {
        const { data: latest } = await supabase
          .from("activities")
          .select("id")
          .eq("team_id", currentTeamId)
          .eq("hu_id", huId)
          .eq("title", title.trim())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latest?.id) {
          setCreatedActivityId(latest.id as string);
          toast.success("Tarefa criada! Anexe os prints abaixo.");
          await refreshAll();
          return; // mantém modal aberto para upload de prints
        }
      }

      toast.success("Tarefa criada com sucesso");
      handleClose();
    } catch {
      toast.error("Erro ao criar tarefa");
    } finally {
      setSubmitting(false);
    }
  };

  if (!hu) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" />
            Nova Tarefa — {hu.code}
          </DialogTitle>
        </DialogHeader>

        {!createdActivityId ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2 line-clamp-2">{hu.title}</div>

            <div>
              <Label>
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Descrição da tarefa"
                className="mt-1"
                autoFocus
              />
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes técnicos, passos para reproduzir o bug..."
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>
                  Tipo <span className="text-destructive">*</span>
                </Label>
                <Select value={activityType} onValueChange={(v) => setActivityType(v as ActivityType)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>
                  Responsável <span className="text-destructive">*</span>
                </Label>
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {developerOptions.map((dev) => (
                      <SelectItem key={dev.id} value={dev.id}>
                        {dev.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>
                  Horas <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min="1"
                  max={isLimitado ? 8 : undefined}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>
                  Data início <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {activityType === "bug" && (
              <div className="text-xs bg-destructive/10 border border-destructive/30 text-destructive rounded p-2">
                🐛 Ao criar uma tarefa do tipo Bug, a HU será movida automaticamente para a coluna <b>Bug</b>. Você
                poderá anexar prints na próxima etapa.
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={handleClose}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 gap-2" disabled={submitting}>
                {submitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Criar Tarefa
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="bg-success/10 border border-success/30 text-success rounded p-3 text-sm">
              ✓ Tarefa de bug criada. Anexe os prints abaixo (opcional).
            </div>
            {currentTeamId && (
              <FileUploader entityType="activity" entityId={createdActivityId} teamId={currentTeamId} />
            )}
            <Button className="w-full" onClick={handleClose}>
              Concluir
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
