import { useEffect, useState, useCallback } from "react";
import {
  Plus, Trash2, GripVertical, Loader2, ListChecks, Pencil, Check, X,
} from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge }    from "@/components/ui/badge";
import { Label }    from "@/components/ui/label";
import { cn }       from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast }    from "sonner";

// ── Fases canônicas ────────────────────────────────────────────────
const FASES = [
  {
    key:   "pre_implantacao" as const,
    label: "Pré-Implantação",
    step:  "1",
    badge: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    ring:  "border-blue-500/20",
    header:"bg-blue-500/8",
  },
  {
    key:   "execucao" as const,
    label: "Execução",
    step:  "2",
    badge: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    ring:  "border-orange-500/20",
    header:"bg-orange-500/8",
  },
  {
    key:   "pos_implantacao" as const,
    label: "Pós-Implantação",
    step:  "3",
    badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    ring:  "border-emerald-500/20",
    header:"bg-emerald-500/8",
  },
] as const;

type FaseKey = typeof FASES[number]["key"];

const FASE_LABEL: Record<FaseKey, string> = {
  pre_implantacao: "Pré-Implantação",
  execucao:        "Execução",
  pos_implantacao: "Pós-Implantação",
};

// ── Types / Hook ────────────────────────────────────────────────
interface TemplateRow {
  id:        string;
  categoria: FaseKey;
  descricao: string;
  ordem:     number;
  ativo:     boolean;
}

function useTemplates() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("rdm_checklist_templates")
        .select("id, categoria, descricao, ordem, ativo")
        .order("ordem");
      if (error) throw error;
      setTemplates((data ?? []) as TemplateRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    const { error } = await supabase
      .from("rdm_checklist_templates")
      .delete().eq("id", id);
    if (error) throw error;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const create = async (payload: { categoria: FaseKey; descricao: string }) => {
    const ordem = templates.length + 1;
    const { data, error } = await supabase
      .from("rdm_checklist_templates")
      .insert({ ...payload, ordem, ativo: true })
      .select("id, categoria, descricao, ordem, ativo")
      .single();
    if (error) throw error;
    setTemplates((prev) => [...prev, data as TemplateRow]);
  };

  const updateFase = async (id: string, categoria: FaseKey) => {
    const { error } = await supabase
      .from("rdm_checklist_templates")
      .update({ categoria })
      .eq("id", id);
    if (error) throw error;
    setTemplates((prev) =>
      prev.map((t) => t.id === id ? { ...t, categoria } : t)
    );
  };

  return { templates, loading, load, remove, create, updateFase };
}

// ── Componente principal ─────────────────────────────────────────
export function RdmChecklistTemplatesPage() {
  const { templates, loading, remove, create, updateFase } = useTemplates();

  const [showForm, setShowForm]   = useState(false);
  const [fase, setFase]           = useState<FaseKey>("execucao");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving]       = useState(false);

  // Inline edit de fase
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editFase, setEditFase]     = useState<FaseKey>("execucao");
  const [editSaving, setEditSaving] = useState(false);

  const handleCreate = async () => {
    if (!descricao.trim()) return;
    setSaving(true);
    try {
      await create({ categoria: fase, descricao: descricao.trim() });
      toast.success("Item criado na fase " + FASE_LABEL[fase]);
      setShowForm(false);
      setFase("execucao");
      setDescricao("");
    } catch (e: any) {
      toast.error("Erro ao criar: " + (e?.message ?? ""));
    } finally {
      setSaving(false);
    }
  };

  const handleEditFaseSave = async (id: string) => {
    setEditSaving(true);
    try {
      await updateFase(id, editFase);
      toast.success("Fase atualizada.");
      setEditingId(null);
    } catch (e: any) {
      toast.error("Erro: " + (e?.message ?? ""));
    } finally {
      setEditSaving(false);
    }
  };

  // Agrupa sempre na ordem canônica das 3 fases
  const grouped = FASES.reduce<Record<FaseKey, TemplateRow[]>>((acc, f) => {
    acc[f.key] = templates.filter((t) => t.categoria === f.key);
    return acc;
  }, {} as any);

  const totalItems = templates.length;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Templates de Checklist</h2>
          <p className="text-sm text-muted-foreground">
            Itens gerados automaticamente em cada nova RDM &nbsp;·&nbsp;
            <span className="font-medium">{totalItems} {totalItems === 1 ? "item" : "itens"}</span>
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo item
        </Button>
      </div>

      {/* Resumo de distribuição */}
      {totalItems > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {FASES.map((f) => (
            <div
              key={f.key}
              className={cn(
                "rounded-lg border px-3 py-2 text-center",
                f.ring, f.header
              )}
            >
              <p className="text-[11px] text-muted-foreground">{f.label}</p>
              <p className="text-xl font-bold text-foreground">{grouped[f.key].length}</p>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && totalItems === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-3">
          <ListChecks className="h-12 w-12 opacity-25" />
          <p className="text-sm">Nenhum template cadastrado ainda</p>
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Criar primeiro template
          </Button>
        </div>
      )}

      {/* Itens agrupados por fase */}
      {!loading && FASES.map((f) => {
        const items = grouped[f.key];
        if (items.length === 0) return null;
        return (
          <div key={f.key} className="space-y-1.5">
            {/* Header da fase */}
            <div className="flex items-center gap-2">
              <span className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold border",
                f.badge
              )}>
                {f.step}
              </span>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {f.label}
              </p>
              <Badge variant="outline" className={cn("text-[10px] h-4", f.badge)}>
                {items.length}
              </Badge>
            </div>

            {/* Itens */}
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5 group"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />

                <p className="flex-1 text-sm text-foreground leading-snug">{item.descricao}</p>

                {/* Inline edit de fase */}
                {editingId === item.id ? (
                  <div className="flex items-center gap-1 shrink-0">
                    <Select
                      value={editFase}
                      onValueChange={(v) => setEditFase(v as FaseKey)}
                    >
                      <SelectTrigger className="h-6 text-[11px] w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FASES.map((ff) => (
                          <SelectItem key={ff.key} value={ff.key}>
                            <span className="text-[11px]">{ff.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon" variant="ghost"
                      className="h-6 w-6 text-emerald-400 hover:bg-emerald-500/10"
                      disabled={editSaving}
                      onClick={() => handleEditFaseSave(item.id)}
                    >
                      {editSaving
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Check className="h-3 w-3" />}
                    </Button>
                    <Button
                      size="icon" variant="ghost"
                      className="h-6 w-6 text-muted-foreground hover:bg-muted"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    className={cn(
                      "opacity-0 group-hover:opacity-100 transition-opacity",
                      "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border",
                      f.badge
                    )}
                    title="Alterar fase"
                    onClick={() => {
                      setEditingId(item.id);
                      setEditFase(item.categoria);
                    }}
                  >
                    <Pencil className="h-2.5 w-2.5" />
                    {FASE_LABEL[item.categoria]}
                  </button>
                )}

                <Button
                  variant="ghost" size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => {
                    if (confirm("Remover este item do template?")) remove(item.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        );
      })}

      {/* Dialog de criação */}
      <Dialog open={showForm} onOpenChange={(o) => !o && setShowForm(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo item de checklist</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">

            {/* Select de fase */}
            <div className="space-y-1.5">
              <Label>Fase *</Label>
              <Select value={fase} onValueChange={(v) => setFase(v as FaseKey)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FASES.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      <span className="flex items-center gap-2">
                        <span className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold border",
                          f.badge
                        )}>
                          {f.step}
                        </span>
                        {f.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Descrição */}
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Textarea
                placeholder="Descreva o item de checklist…"
                rows={3}
                className="resize-none"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleCreate();
                }}
              />
              <p className="text-[10px] text-muted-foreground">Ctrl+Enter para salvar</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !descricao.trim()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
