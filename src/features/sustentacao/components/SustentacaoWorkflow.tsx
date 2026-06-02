import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitBranch, Plus, Trash2, GripVertical, RotateCcw, Save, Pencil, X, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { ALL_SITUACOES, SITUACAO_LABELS } from "../types/demanda";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import {
  fetchActiveWorkflowSteps,
  replaceWorkflowSteps,
} from "../services/workflowSteps.service";

interface SustentacaoStep {
  id?: string;
  key: string;
  label: string;
  hex: string;
}

const COLOR_OPTIONS = [
  { hex: "#3b82f6", label: "Azul" },
  { hex: "#eab308", label: "Amarelo" },
  { hex: "#ef4444", label: "Vermelho" },
  { hex: "#22c55e", label: "Verde" },
  { hex: "#a855f7", label: "Roxo" },
  { hex: "#f97316", label: "Laranja" },
  { hex: "#06b6d4", label: "Ciano" },
  { hex: "#10b981", label: "Esmeralda" },
  { hex: "#14b8a6", label: "Teal" },
  { hex: "#6366f1", label: "Índigo" },
  { hex: "#8b5cf6", label: "Violeta" },
  { hex: "#f59e0b", label: "Âmbar" },
  { hex: "#84cc16", label: "Lima" },
];

const SITUACAO_HEX: Record<string, string> = {
  nova: "#3b82f6", planejamento: "#6366f1", envio_aprovacao: "#a855f7",
  planejamento_aprovado: "#8b5cf6", execucao_dev: "#eab308", bloqueada: "#ef4444",
  aguardando_retorno: "#f97316", teste: "#06b6d4", aguardando_homologacao: "#f59e0b",
  homologada: "#10b981", fila_producao: "#14b8a6", producao: "#22c55e", aceite_final: "#84cc16",
};

function buildDefaultSteps(): SustentacaoStep[] {
  return ALL_SITUACOES.map((sit) => ({
    key: sit, label: SITUACAO_LABELS[sit] || sit, hex: SITUACAO_HEX[sit] || COLOR_OPTIONS[0].hex,
  }));
}

export function SustentacaoWorkflow() {
  const { currentTeamId } = useAuth();
  // fix(P2): QueryClient para invalidar ['workflow-steps'] após save/restore,
  // garantindo que SustentacaoBoard reflita o novo fluxo imediatamente.
  const qc = useQueryClient();

  const [draft, setDraft] = useState<SustentacaoStep[]>(buildDefaultSteps);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColorIdx, setEditColorIdx] = useState("0");
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingDb, setLoadingDb] = useState(true);

  // Load workflow globally (no team filter)
  const loadFromDb = useCallback(async () => {
    setLoadingDb(true);
    try {
      const data = await fetchActiveWorkflowSteps();
      if (data && data.length > 0) {
        // Deduplicate by nome
        const seen = new Set<string>();
        const unique = data.filter((d: any) => {
          const key = d.nome;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setDraft(unique.map((d: any) => ({
          id: d.id, key: d.nome.toLowerCase().replace(/\s+/g, '_'), label: d.nome, hex: d.cor,
        })));
      } else {
        setDraft(buildDefaultSteps());
      }
      setHasChanges(false);
    } catch {
      setDraft(buildDefaultSteps());
    }
    setLoadingDb(false);
  }, []);

  useEffect(() => { loadFromDb(); }, [loadFromDb]);

  const markChanged = (newDraft: SustentacaoStep[]) => {
    setDraft(newDraft);
    setHasChanges(true);
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const items = Array.from(draft);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    markChanged(items);
  };

  const addStep = () => {
    const key = `etapa_${Date.now()}`;
    markChanged([...draft, { key, label: "Nova Etapa", hex: COLOR_OPTIONS[0].hex }]);
    setEditingKey(key);
    setEditLabel("Nova Etapa");
    setEditColorIdx("0");
  };

  const removeStep = (key: string) => {
    if (draft.length <= 2) { toast.error("Mínimo de 2 etapas no fluxo"); return; }
    markChanged(draft.filter(c => c.key !== key));
    if (editingKey === key) setEditingKey(null);
  };

  const startEdit = (step: SustentacaoStep) => {
    setEditingKey(step.key);
    setEditLabel(step.label);
    setEditColorIdx(String(Math.max(0, COLOR_OPTIONS.findIndex(o => o.hex === step.hex))));
  };

  const confirmEdit = () => {
    if (!editingKey || !editLabel.trim()) return;
    const colorOpt = COLOR_OPTIONS[Number(editColorIdx)];
    markChanged(draft.map(c => c.key === editingKey ? { ...c, label: editLabel.trim(), hex: colorOpt.hex } : c));
    setEditingKey(null);
  };

  const save = async () => {
    if (!currentTeamId) return;
    setSaving(true);
    try {
      await replaceWorkflowSteps(
        currentTeamId,
        draft.map((s) => ({ label: s.label, hex: s.hex })),
      );
      setHasChanges(false);
      toast.success("Fluxo de sustentação salvo com sucesso!");
      await loadFromDb();
      // fix(P2): força revalidação imediata da query consumida por
      // useWorkflowSteps / SustentacaoBoard, sem depender da latência do
      // canal Realtime Postgres. O canal RT continua ativo para sincronizar
      // os demais usuários sem nenhuma alteração.
      qc.invalidateQueries({ queryKey: ['workflow-steps'] });
    } catch {
      toast.error("Erro ao salvar fluxo de trabalho");
    }
    setSaving(false);
  };

  const restore = async () => {
    if (!currentTeamId) return;
    setSaving(true);
    try {
      const defaults = buildDefaultSteps();
      await replaceWorkflowSteps(
        currentTeamId,
        defaults.map((s) => ({ label: s.label, hex: s.hex })),
      );
      setDraft(defaults);
      setHasChanges(false);
      toast.success("Padrão restaurado e salvo.");
      // fix(P2): mesma invalidation de save() — garante que o Board
      // reflita o padrão restaurado imediatamente.
      qc.invalidateQueries({ queryKey: ['workflow-steps'] });
    } catch {
      toast.error("Erro ao restaurar padrão");
    }
    setSaving(false);
  };

  const getActiveHex = (step: SustentacaoStep) => {
    if (editingKey === step.key) return COLOR_OPTIONS[Number(editColorIdx)]?.hex || step.hex;
    return step.hex;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold tracking-tight">Fluxo de Trabalho — Sustentação</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Fluxo único e global, compartilhado por todos os times.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={restore} disabled={saving}>
            <RotateCcw className="h-3.5 w-3.5" /> Restaurar Padrão
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={addStep}>
            <Plus className="h-4 w-4" /> Nova Etapa
          </Button>
          <Button size="sm" className="gap-1.5" onClick={save} disabled={!hasChanges || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar Alterações
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          {loadingDb ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="sustentacao-workflow-steps">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                    {draft.map((step, idx) => (
                      <Draggable key={step.key} draggableId={step.key} index={idx}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${snapshot.isDragging ? "bg-accent shadow-md" : "bg-background hover:bg-muted/50"}`}
                            style={{ ...provided.draggableProps.style, borderLeftWidth: "4px", borderLeftColor: getActiveHex(step) }}
                          >
                            <div {...provided.dragHandleProps} className="cursor-grab text-muted-foreground"><GripVertical className="h-4 w-4" /></div>
                            <span className="text-xs font-mono text-muted-foreground w-5 text-center shrink-0">{idx + 1}</span>
                            <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: getActiveHex(step) }} />
                            {editingKey === step.key ? (
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} className="h-8 text-sm flex-1" autoFocus
                                  onKeyDown={e => { if (e.key === "Enter") confirmEdit(); if (e.key === "Escape") setEditingKey(null); }} />
                                <Select value={editColorIdx} onValueChange={setEditColorIdx}>
                                  <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {COLOR_OPTIONS.map((opt, i) => (
                                      <SelectItem key={i} value={String(i)}>
                                        <div className="flex items-center gap-2"><div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: opt.hex }} />{opt.label}</div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={confirmEdit}><Check className="h-3.5 w-3.5 text-primary" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingKey(null)}><X className="h-3.5 w-3.5" /></Button>
                              </div>
                            ) : (
                              <span className="text-sm font-medium flex-1 min-w-0 truncate">{step.label}</span>
                            )}
                            {editingKey !== step.key && (
                              <div className="flex items-center gap-1 shrink-0">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(step)}><Pencil className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeStep(step.key)}><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
