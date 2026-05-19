import { useState } from "react";
import {
  Plus, Trash2, Check, X, Pencil, ClipboardList,
  ChevronDown, ChevronUp, AlertCircle,
} from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge }    from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useRdmDeploymentTasks } from "../hooks/useRdmDeploymentTasks";
import type { RdmDeploymentTask, RdmDeploymentTaskCategoria } from "../types/rdm";
import {
  RDM_DEPLOYMENT_TASK_CATEGORIA,
  RDM_DEPLOYMENT_TASK_CATEGORIA_LABELS,
  RDM_DEPLOYMENT_TASK_STATUS_LABELS,
} from "../types/rdm";
import { toast } from "sonner";

interface Props { rdmId: string }

type AddingForm = {
  categoria: RdmDeploymentTaskCategoria;
  titulo: string;
  descricao: string;
};

type EditingForm = {
  id: string;
  titulo: string;
  descricao: string;
};

const STATUS_COLORS: Record<string, string> = {
  pendente:     "bg-slate-500/15 text-slate-400 border-slate-500/20",
  em_andamento: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  concluido:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  bloqueado:    "bg-red-500/15 text-red-400 border-red-500/20",
};

const CATEGORIA_ICONS: Record<RdmDeploymentTaskCategoria, string> = {
  pre_implantacao: "🔧",
  execucao:        "🚀",
  pos_implantacao: "✅",
};

export function RdmDeploymentTasksPanel({ rdmId }: Props) {
  const { tasks, loading, error, addTask, updateTask, toggleConcluido, removeTask } =
    useRdmDeploymentTasks(rdmId);

  const [expanded, setExpanded]   = useState<Set<RdmDeploymentTaskCategoria>>(
    new Set(RDM_DEPLOYMENT_TASK_CATEGORIA)
  );
  const [adding, setAdding]       = useState<AddingForm | null>(null);
  const [editing, setEditing]     = useState<EditingForm | null>(null);
  const [saving, setSaving]       = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);

  const toggleExpand = (cat: RdmDeploymentTaskCategoria) =>
    setExpanded((prev) => {
      const s = new Set(prev);
      s.has(cat) ? s.delete(cat) : s.add(cat);
      return s;
    });

  const tasksByCategoria = (cat: RdmDeploymentTaskCategoria) =>
    tasks.filter((t) => t.categoria === cat).sort((a, b) => a.ordem - b.ordem);

  const progressOf = (cat: RdmDeploymentTaskCategoria) => {
    const catTasks = tasksByCategoria(cat);
    if (catTasks.length === 0) return null;
    const done = catTasks.filter((t) => t.status === "concluido").length;
    return { done, total: catTasks.length };
  };

  // ── Add task ────────────────────────────────────────────────────────────────
  const handleSaveAdd = async () => {
    if (!adding || !adding.titulo.trim()) return;
    setSaving(true);
    try {
      const nextOrdem = tasksByCategoria(adding.categoria).length;
      await addTask({
        categoria:      adding.categoria,
        titulo:         adding.titulo.trim(),
        descricao:      adding.descricao.trim() || null,
        responsavel_id: null,
        status:         "pendente",
        concluido_em:   null,
        ordem:          nextOrdem,
      });
      toast.success("Tarefa adicionada.");
      setAdding(null);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? ""));
    } finally {
      setSaving(false);
    }
  };

  // ── Edit task ────────────────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editing || !editing.titulo.trim()) return;
    setSaving(true);
    try {
      await updateTask(editing.id, {
        titulo:    editing.titulo.trim(),
        descricao: editing.descricao.trim() || null,
      });
      toast.success("Tarefa atualizada.");
      setEditing(null);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? ""));
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle status ────────────────────────────────────────────────────────────
  const handleToggle = async (task: RdmDeploymentTask) => {
    try {
      await toggleConcluido(task);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? ""));
    }
  };

  // ── Status change ────────────────────────────────────────────────────────────
  const handleStatusChange = async (task: RdmDeploymentTask, newStatus: string) => {
    try {
      await updateTask(task.id, {
        status:       newStatus as RdmDeploymentTask["status"],
        concluido_em: newStatus === "concluido" ? new Date().toISOString() : null,
      });
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? ""));
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    try {
      await removeTask(confirmDeleteId);
      toast.success("Tarefa removida.");
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? ""));
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const confirmTask = tasks.find((t) => t.id === confirmDeleteId);

  if (loading) return (
    <div className="flex justify-center py-8">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 text-destructive text-sm py-6 justify-center">
      <AlertCircle className="h-4 w-4" /> {error}
    </div>
  );

  const totalTasks = tasks.length;
  const doneTasks  = tasks.filter((t) => t.status === "concluido").length;

  return (
    <div className="space-y-4">

      {/* Header geral */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            Tarefas de Implantação
          </span>
          {totalTasks > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5">
              {doneTasks}/{totalTasks} concluídas
            </Badge>
          )}
        </div>
        {!adding && (
          <Button
            size="sm" variant="outline" className="gap-1.5 h-8 text-xs"
            onClick={() => setAdding({ categoria: "pre_implantacao", titulo: "", descricao: "" })}
          >
            <Plus className="h-3.5 w-3.5" /> Nova Tarefa
          </Button>
        )}
      </div>

      {/* Form global de nova tarefa */}
      {adding && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-primary">Nova Tarefa</p>
          <Select
            value={adding.categoria}
            onValueChange={(v) =>
              setAdding((prev) => prev ? { ...prev, categoria: v as RdmDeploymentTaskCategoria } : prev)
            }
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RDM_DEPLOYMENT_TASK_CATEGORIA.map((c) => (
                <SelectItem key={c} value={c} className="text-xs">
                  {CATEGORIA_ICONS[c]} {RDM_DEPLOYMENT_TASK_CATEGORIA_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Título da tarefa *"
            value={adding.titulo}
            onChange={(e) => setAdding((prev) => prev ? { ...prev, titulo: e.target.value } : prev)}
            className="h-8 text-sm"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleSaveAdd()}
          />
          <Textarea
            placeholder="Descrição (opcional)"
            value={adding.descricao}
            onChange={(e) => setAdding((prev) => prev ? { ...prev, descricao: e.target.value } : prev)}
            className="text-xs resize-none"
            rows={2}
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" className="h-8 text-xs"
              onClick={() => setAdding(null)}>Cancelar</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5"
              onClick={handleSaveAdd} disabled={saving || !adding.titulo.trim()}>
              <Check className="h-3.5 w-3.5" /> Adicionar
            </Button>
          </div>
        </div>
      )}

      {/* Seções por categoria */}
      {RDM_DEPLOYMENT_TASK_CATEGORIA.map((cat) => {
        const catTasks  = tasksByCategoria(cat);
        const progress  = progressOf(cat);
        const isExpanded = expanded.has(cat);

        return (
          <div key={cat} className="rounded-lg border border-border bg-card overflow-hidden">

            {/* Categoria header */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3 text-left"
              onClick={() => toggleExpand(cat)}
            >
              <span className="text-base leading-none">{CATEGORIA_ICONS[cat]}</span>
              <span className="flex-1 text-sm font-semibold text-foreground">
                {RDM_DEPLOYMENT_TASK_CATEGORIA_LABELS[cat]}
              </span>
              {progress && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] h-5",
                    progress.done === progress.total
                      ? "border-emerald-500/30 text-emerald-400"
                      : "text-muted-foreground"
                  )}
                >
                  {progress.done}/{progress.total}
                </Badge>
              )}
              {catTasks.length === 0 && (
                <span className="text-[10px] text-muted-foreground/50">vazio</span>
              )}
              {isExpanded
                ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
            </button>

            {/* Tasks list */}
            {isExpanded && (
              <div className="border-t border-border divide-y divide-border/50">
                {catTasks.length === 0 && (
                  <div className="flex items-center justify-center py-6 text-xs text-muted-foreground/50">
                    Nenhuma tarefa nesta categoria
                  </div>
                )}

                {catTasks.map((task) => {
                  const isEditing = editing?.id === task.id;

                  if (isEditing) {
                    return (
                      <div key={task.id} className="px-4 py-3 bg-primary/5 space-y-2">
                        <Input
                          value={editing.titulo}
                          onChange={(e) =>
                            setEditing((prev) => prev ? { ...prev, titulo: e.target.value } : prev)}
                          className="h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => e.key === "Enter" && handleSaveEdit()}
                        />
                        <Textarea
                          placeholder="Descrição (opcional)"
                          value={editing.descricao}
                          onChange={(e) =>
                            setEditing((prev) => prev ? { ...prev, descricao: e.target.value } : prev)}
                          className="text-xs resize-none"
                          rows={2}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 text-xs"
                            onClick={() => setEditing(null)}>Cancelar</Button>
                          <Button size="sm" className="h-7 text-xs gap-1.5"
                            onClick={handleSaveEdit} disabled={saving || !editing.titulo.trim()}>
                            <Check className="h-3 w-3" /> Salvar
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={task.id}
                      className="group flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">

                      {/* Checkbox toggle */}
                      <button
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors",
                          task.status === "concluido"
                            ? "border-emerald-500 bg-emerald-500"
                            : "border-border hover:border-primary"
                        )}
                        onClick={() => handleToggle(task)}
                        title={task.status === "concluido" ? "Desmarcar" : "Concluir"}
                      >
                        {task.status === "concluido" && (
                          <Check className="h-2.5 w-2.5 text-white" />
                        )}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium leading-snug",
                          task.status === "concluido"
                            ? "line-through text-muted-foreground"
                            : "text-foreground"
                        )}>
                          {task.titulo}
                        </p>
                        {task.descricao && (
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                            {task.descricao}
                          </p>
                        )}
                        {task.concluido_em && (
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                            Concluído em{" "}
                            {new Date(task.concluido_em).toLocaleString("pt-BR")}
                          </p>
                        )}
                      </div>

                      {/* Status select + ações */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Select
                          value={task.status}
                          onValueChange={(v) => handleStatusChange(task, v)}
                        >
                          <SelectTrigger className="h-6 text-[10px] w-28 border-0 bg-transparent p-1">
                            <Badge
                              variant="outline"
                              className={cn("text-[10px] h-5 cursor-pointer", STATUS_COLORS[task.status])}
                            >
                              {RDM_DEPLOYMENT_TASK_STATUS_LABELS[task.status]}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(RDM_DEPLOYMENT_TASK_STATUS_LABELS).map(([k, v]) => (
                              <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                          title="Editar"
                          onClick={() => setEditing({
                            id: task.id,
                            titulo: task.titulo,
                            descricao: task.descricao ?? "",
                          })}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          title="Remover"
                          onClick={() => setConfirmDeleteId(task.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {/* Botão de adicionar inline por categoria */}
                <div className="px-4 py-2">
                  <button
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setAdding({ categoria: cat, titulo: "", descricao: "" })}
                  >
                    <Plus className="h-3 w-3" /> Adicionar tarefa
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* AlertDialog — confirmar exclusão */}
      <AlertDialog
        open={!!confirmDeleteId}
        onOpenChange={(o) => !o && !deleting && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" /> Remover Tarefa
            </AlertDialogTitle>
            <AlertDialogDescription>
              Remover{" "}
              <span className="font-semibold text-foreground">"{confirmTask?.titulo}"</span>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {deleting ? "Removendo…" : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
