import { useState } from "react";
import {
  Plus, Pencil, Trash2, Check, X, Hash, GitBranch, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Badge }    from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRdmSprints } from "../hooks/useRdmSprints";
import type { RdmSprint } from "../types/rdm";
import { toast } from "sonner";

interface Props { rdmId: string }

type EditingRedmine = {
  sprintId:  string;
  redmineId: string | null;
  numero:    string;
  descricao: string;
};

export function RdmSprintsPanel({ rdmId }: Props) {
  const {
    sprints, loading,
    addSprint, updateSprint, removeSprint,
    addRedmine, updateRedmine, removeRedmine,
  } = useRdmSprints(rdmId);

  // Sprint form
  const [showSprintForm, setShowSprintForm]   = useState(false);
  const [editingSprintId, setEditingSprintId] = useState<string | null>(null);
  const [sprintNome, setSprintNome]           = useState("");
  const [savingSprint, setSavingSprint]       = useState(false);

  // Redmine form
  const [editingRedmine, setEditingRedmine] = useState<EditingRedmine | null>(null);
  const [savingRedmine, setSavingRedmine]   = useState(false);

  // Expanded
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  // Confirm delete
  const [confirmSprintId, setConfirmSprintId] = useState<string | null>(null);
  const [deletingSprint, setDeletingSprint]   = useState(false);
  const confirmSprint = sprints.find((s) => s.id === confirmSprintId);

  // ── helpers ──────────────────────────────────────────────────────────────
  const openNewSprintForm = () => {
    setEditingSprintId(null);
    setSprintNome("");
    setShowSprintForm(true);
  };

  const closeSprintForm = () => {
    setShowSprintForm(false);
    setEditingSprintId(null);
    setSprintNome("");
  };

  // ── Sprint handlers ──────────────────────────────────────────────────────
  const handleSaveSprint = async () => {
    if (!sprintNome.trim()) return;
    setSavingSprint(true);
    try {
      if (editingSprintId) {
        await updateSprint(editingSprintId, { nome: sprintNome.trim() });
        toast.success("Sprint atualizada.");
      } else {
        await addSprint({ nome: sprintNome.trim(), sprint_id: null });
        toast.success("Sprint vinculada com sucesso.");
      }
      closeSprintForm();
    } catch (e: any) {
      toast.error("Erro ao salvar sprint: " + (e?.message ?? "erro desconhecido"));
    } finally {
      setSavingSprint(false);
    }
  };

  const handleEditSprint = (sprint: RdmSprint) => {
    setEditingSprintId(sprint.id);
    setSprintNome(sprint.nome);
    setShowSprintForm(true);
  };

  const handleConfirmRemoveSprint = async () => {
    if (!confirmSprintId) return;
    setDeletingSprint(true);
    try {
      await removeSprint(confirmSprintId);
      toast.success("Sprint removida.");
    } catch (e: any) {
      toast.error("Erro ao remover: " + (e?.message ?? ""));
    } finally {
      setDeletingSprint(false);
      setConfirmSprintId(null);
    }
  };

  // ── Redmine handlers ──────────────────────────────────────────────────────
  const handleSaveRedmine = async () => {
    if (!editingRedmine || !editingRedmine.numero.trim()) return;
    setSavingRedmine(true);
    try {
      if (editingRedmine.redmineId) {
        await updateRedmine(editingRedmine.sprintId, editingRedmine.redmineId, {
          numero:    editingRedmine.numero.trim(),
          descricao: editingRedmine.descricao.trim() || null,
        });
        toast.success("Redmine atualizado.");
      } else {
        await addRedmine(editingRedmine.sprintId, {
          numero:    editingRedmine.numero.trim(),
          descricao: editingRedmine.descricao.trim() || null,
        });
        toast.success("Redmine adicionado.");
      }
    } catch (e: any) {
      toast.error("Erro ao salvar Redmine: " + (e?.message ?? ""));
    } finally {
      // FIX: reset de loading e fechamento do form SEMPRE no finally
      // Garante que a tela nao trava mesmo que setSprints lance erro interno
      setSavingRedmine(false);
      setEditingRedmine(null);
    }
  };

  const handleRemoveRedmine = async (sprintId: string, redmineId: string) => {
    try {
      await removeRedmine(sprintId, redmineId);
      toast.success("Redmine removido.");
    } catch (e: any) {
      toast.error("Erro ao remover Redmine: " + (e?.message ?? ""));
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">
          {sprints.length === 0
            ? "Nenhuma sprint vinculada"
            : `${sprints.length} sprint(s) vinculada(s)`}
        </p>
        {!showSprintForm && (
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={openNewSprintForm}>
            <Plus className="h-3.5 w-3.5" /> Vincular Sprint
          </Button>
        )}
      </div>

      {/* Formulário nova / editar sprint */}
      {showSprintForm && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-primary">
            {editingSprintId ? "Editar Sprint" : "Vincular Nova Sprint"}
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Nome da sprint (ex: Sprint 42)"
              value={sprintNome}
              onChange={(e) => setSprintNome(e.target.value)}
              className="h-8 text-sm flex-1"
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveSprint(); }}
              autoFocus
            />
            <Button size="sm" className="h-8 px-3" onClick={handleSaveSprint} disabled={savingSprint || !sprintNome.trim()}>
              {savingSprint ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-3" onClick={closeSprintForm} disabled={savingSprint}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Estado vazio */}
      {sprints.length === 0 && !showSprintForm && (
        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground space-y-3">
          <GitBranch className="h-8 w-8 opacity-30" />
          <p className="text-sm">Vincule sprints para controlar os Redmines relacionados.</p>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={openNewSprintForm}>
            <Plus className="h-3.5 w-3.5" /> Vincular Nova Sprint
          </Button>
        </div>
      )}

      {/* Lista de sprints */}
      <div className="space-y-3">
        {sprints.map((sprint) => {
          const isExpanded    = expanded.has(sprint.id);
          const redmines      = sprint.redmines ?? [];
          const isEditingThis = editingRedmine?.sprintId === sprint.id && !editingRedmine?.redmineId;

          return (
            <div key={sprint.id} className="rounded-lg border border-border bg-card overflow-hidden">

              {/* Sprint header */}
              <div className="flex items-center gap-2 px-4 py-3">
                <button
                  className="flex items-center gap-2 flex-1 text-left min-w-0"
                  onClick={() => toggleExpand(sprint.id)}
                >
                  {isExpanded
                    ? <ChevronUp   className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <GitBranch className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold text-foreground truncate">{sprint.nome}</span>
                  {redmines.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 ml-1">
                      {redmines.length} redmine{redmines.length !== 1 ? "s" : ""}
                    </Badge>
                  )}
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Editar sprint" onClick={() => handleEditSprint(sprint)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" title="Remover sprint" onClick={() => setConfirmSprintId(sprint.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Sprint body — redmines */}
              {isExpanded && (
                <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/20">

                  {redmines.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {redmines.map((r) => {
                        const isEditingRedmine = editingRedmine?.redmineId === r.id;
                        if (isEditingRedmine) {
                          return (
                            <div key={r.id} className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-lg px-2 py-1">
                              <Hash className="h-3 w-3 text-primary shrink-0" />
                              <input
                                className="bg-transparent border-none outline-none text-xs w-20 text-foreground"
                                value={editingRedmine.numero}
                                onChange={(e) => setEditingRedmine((prev) => prev ? { ...prev, numero: e.target.value } : prev)}
                                onKeyDown={(e) => e.key === "Enter" && handleSaveRedmine()}
                                autoFocus
                              />
                              <input
                                className="bg-transparent border-none outline-none text-xs w-28 text-muted-foreground"
                                placeholder="descrição"
                                value={editingRedmine.descricao}
                                onChange={(e) => setEditingRedmine((prev) => prev ? { ...prev, descricao: e.target.value } : prev)}
                                onKeyDown={(e) => e.key === "Enter" && handleSaveRedmine()}
                              />
                              <button onClick={handleSaveRedmine} disabled={savingRedmine} className="text-emerald-500 hover:text-emerald-400">
                                {savingRedmine ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              </button>
                              <button onClick={() => setEditingRedmine(null)} className="text-muted-foreground hover:text-foreground">
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        }
                        return (
                          <div key={r.id} className="group flex items-center gap-1 bg-muted border border-border rounded-lg px-2 py-1">
                            <Hash className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-xs font-mono font-medium text-foreground">{r.numero}</span>
                            {r.descricao && (
                              <span className="text-xs text-muted-foreground ml-1 max-w-[120px] truncate">{r.descricao}</span>
                            )}
                            <button
                              className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                              onClick={() => setEditingRedmine({ sprintId: sprint.id, redmineId: r.id, numero: r.numero, descricao: r.descricao ?? "" })}
                            >
                              <Pencil className="h-2.5 w-2.5" />
                            </button>
                            <button
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                              onClick={() => handleRemoveRedmine(sprint.id, r.id)}
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Form novo redmine inline */}
                  {isEditingThis ? (
                    <div className="flex items-center gap-2">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Input
                        placeholder="Número (ex: 12345)"
                        value={editingRedmine?.numero ?? ""}
                        onChange={(e) => setEditingRedmine((prev) => prev ? { ...prev, numero: e.target.value } : prev)}
                        className="h-7 text-xs w-32"
                        onKeyDown={(e) => e.key === "Enter" && handleSaveRedmine()}
                        autoFocus
                      />
                      <Input
                        placeholder="Descrição (opcional)"
                        value={editingRedmine?.descricao ?? ""}
                        onChange={(e) => setEditingRedmine((prev) => prev ? { ...prev, descricao: e.target.value } : prev)}
                        className="h-7 text-xs flex-1"
                        onKeyDown={(e) => e.key === "Enter" && handleSaveRedmine()}
                      />
                      <Button size="sm" className="h-7 px-2" onClick={handleSaveRedmine} disabled={savingRedmine}>
                        {savingRedmine ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingRedmine(null)} disabled={savingRedmine}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm" variant="ghost"
                      className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5 px-2"
                      onClick={() => setEditingRedmine({ sprintId: sprint.id, redmineId: null, numero: "", descricao: "" })}
                    >
                      <Plus className="h-3 w-3" /> Adicionar Redmine
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* AlertDialog — confirmar remoção de sprint */}
      <AlertDialog open={!!confirmSprintId} onOpenChange={(o) => !o && !deletingSprint && setConfirmSprintId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" /> Remover Sprint
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover{" "}
              <span className="font-semibold text-foreground">{confirmSprint?.nome}</span>?
              <br />
              <span className="text-xs text-muted-foreground mt-1 block">
                Todos os Redmines vinculados a esta sprint também serão removidos.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSprint}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemoveSprint}
              disabled={deletingSprint}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {deletingSprint ? "Removendo…" : "Confirmar remoção"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
