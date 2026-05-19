import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, GripVertical, Loader2, ListChecks } from "lucide-react";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label }    from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast }    from "sonner";

interface TemplateRow {
  id:         string;
  categoria:  string;
  descricao:  string;
  ordem:      number;
  ativo:      boolean;
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
      setTemplates(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    const { error } = await supabase
      .from("rdm_checklist_templates")
      .delete()
      .eq("id", id);
    if (error) throw error;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const create = async (payload: { categoria: string; descricao: string }) => {
    const ordem = templates.length + 1;
    const { data, error } = await supabase
      .from("rdm_checklist_templates")
      .insert({ ...payload, ordem, ativo: true })
      .select("id, categoria, descricao, ordem, ativo")
      .single();
    if (error) throw error;
    setTemplates((prev) => [...prev, data]);
  };

  return { templates, loading, load, remove, create };
}

export function RdmChecklistTemplatesPage() {
  const { templates, loading, remove, create } = useTemplates();
  const [showForm, setShowForm]   = useState(false);
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [saving, setSaving]       = useState(false);

  const categorias = [...new Set(templates.map((t) => t.categoria))].sort();

  const handleCreate = async () => {
    if (!categoria.trim() || !descricao.trim()) return;
    setSaving(true);
    try {
      await create({ categoria: categoria.trim(), descricao: descricao.trim() });
      toast.success("Template criado!");
      setShowForm(false);
      setCategoria("");
      setDescricao("");
    } catch (e: any) {
      toast.error("Erro ao criar: " + (e?.message ?? ""));
    } finally {
      setSaving(false);
    }
  };

  const grouped = templates.reduce<Record<string, TemplateRow[]>>((acc, t) => {
    (acc[t.categoria] = acc[t.categoria] ?? []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Templates de Checklist</h2>
          <p className="text-sm text-muted-foreground">
            Itens gerados automaticamente em cada nova RDM
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo item
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && templates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-3">
          <ListChecks className="h-12 w-12 opacity-25" />
          <p className="text-sm">Nenhum template cadastrado ainda</p>
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Criar primeiro template
          </Button>
        </div>
      )}

      {!loading && Object.entries(grouped).map(([cat, items]) => (
        <div key={cat} className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{cat}</p>
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
              <p className="flex-1 text-sm text-foreground leading-snug">{item.descricao}</p>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => {
                  if (confirm("Remover este template?")) remove(item.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ))}

      <Dialog open={showForm} onOpenChange={(o) => !o && setShowForm(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo item de checklist template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Categoria *</Label>
              <Input
                placeholder="Ex.: Pré-Deploy, Rollback, Pós-Deploy…"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              />
              {categorias.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {categorias.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCategoria(c)}
                      className="text-[11px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:text-foreground"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Textarea
                placeholder="Descreva o item de checklist…"
                rows={3}
                className="resize-none"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !categoria.trim() || !descricao.trim()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
