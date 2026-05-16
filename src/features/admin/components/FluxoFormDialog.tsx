import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { COLOR_PRESETS, type FluxoColuna } from "../hooks/useFluxoAdmin";

interface Props {
  open: boolean;
  coluna: FluxoColuna | null;
  onClose: () => void;
  onSave: (data: Omit<FluxoColuna, "id" | "team_id">) => Promise<boolean>;
}

const EMPTY = {
  key: "",
  label: "",
  color_class: COLOR_PRESETS[0].color_class,
  dot_color: COLOR_PRESETS[0].dot_color,
  hex: COLOR_PRESETS[0].hex,
  sort_order: 0,
  wip_limit: null as number | null,
};

export function FluxoFormDialog({ open, coluna, onClose, onSave }: Props) {
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (coluna) {
      setForm({
        key:         coluna.key,
        label:       coluna.label,
        color_class: coluna.color_class,
        dot_color:   coluna.dot_color,
        hex:         coluna.hex,
        sort_order:  coluna.sort_order,
        wip_limit:   coluna.wip_limit,
      });
    } else {
      setForm({ ...EMPTY });
    }
  }, [coluna, open]);

  const set = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }));

  const selectPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setForm(p => ({ ...p, color_class: preset.color_class, dot_color: preset.dot_color, hex: preset.hex }));
  };

  // Gera key automaticamente a partir do label se estiver criando
  const handleLabelChange = (val: string) => {
    set("label", val);
    if (!coluna) {
      set("key", val.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""));
    }
  };

  const handleSave = async () => {
    if (!form.label.trim()) return;
    if (!form.key.trim()) return;
    setSaving(true);
    const ok = await onSave({
      key:         form.key.trim(),
      label:       form.label.trim(),
      color_class: form.color_class,
      dot_color:   form.dot_color,
      hex:         form.hex,
      sort_order:  form.sort_order,
      wip_limit:   form.wip_limit,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v && !saving) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{coluna ? "Editar Coluna" : "Nova Coluna"}</DialogTitle>
          <DialogDescription>
            {coluna ? "Altere as configurações da coluna do fluxo." : "Crie uma nova coluna para o fluxo do Kanban."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Label */}
          <div>
            <Label className="text-xs font-semibold">Nome da Coluna *</Label>
            <Input
              value={form.label}
              onChange={e => handleLabelChange(e.target.value)}
              placeholder="Ex: Em Desenvolvimento"
              className="h-8 mt-1 text-sm"
              maxLength={40}
              autoFocus
            />
          </div>

          {/* Key */}
          <div>
            <Label className="text-xs font-semibold">Chave (key) *</Label>
            <Input
              value={form.key}
              onChange={e => set("key", e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""))}
              placeholder="em_desenvolvimento"
              className="h-8 mt-1 text-sm font-mono"
              maxLength={40}
              disabled={!!coluna}
            />
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {coluna ? "A chave não pode ser alterada pois está vinculada às HUs." : "Gerada automaticamente. Usada internamente como status das HUs."}
            </p>
          </div>

          {/* Cor */}
          <div>
            <Label className="text-xs font-semibold">Cor</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {COLOR_PRESETS.map(p => (
                <button
                  key={p.hex}
                  type="button"
                  title={p.label}
                  onClick={() => selectPreset(p)}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${
                    form.hex === p.hex ? "border-foreground scale-110" : "border-transparent hover:border-muted-foreground"
                  }`}
                  style={{ backgroundColor: p.hex ?? "#94a3b8" }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className={`h-5 w-5 rounded-full ${form.dot_color}`} />
              <span className={`text-xs px-2 py-0.5 rounded-full ${form.color_class}`}>
                {form.label || "Prévia"}
              </span>
            </div>
          </div>

          {/* WIP Limit */}
          <div>
            <Label className="text-xs font-semibold">Limite WIP</Label>
            <Input
              type="number"
              min={1}
              max={999}
              value={form.wip_limit ?? ""}
              onChange={e => set("wip_limit", e.target.value === "" ? null : Number(e.target.value))}
              placeholder="Sem limite"
              className="h-8 mt-1 text-sm max-w-[140px]"
            />
            <p className="text-[11px] text-muted-foreground mt-0.5">Máximo de HUs simultâneas nessa coluna. Deixe vazio para sem limite.</p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !form.label.trim() || !form.key.trim()}>
            {saving ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            {coluna ? "Salvar alterações" : "Criar coluna"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
