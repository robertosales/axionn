import { useState } from "react";
import { useAutomationRules } from "../hooks/useAutomationRules";
import { Button }   from "@/components/ui/button";
import { Switch }   from "@/components/ui/switch";
import { Badge }    from "@/components/ui/badge";
import { Input }    from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, Plus, Trash2, ChevronRight } from "lucide-react";
import type { AutomationRule } from "../hooks/useAutomationRules";

const ACTION_LABELS: Record<string, string> = {
  notify:        "🔔 Notificar time",
  change_status: "↔️ Mudar status",
};

const TRIGGER_LABELS: Record<string, string> = {
  status_change: "Mudança de status",
};

const EMPTY: Omit<AutomationRule, "id" | "team_id" | "created_at"> = {
  name: "", enabled: true,
  trigger_type: "status_change", trigger_to_status: "", trigger_from_status: null,
  action_type: "notify", action_target_status: null, action_message: "",
};

export function AutomationRulesPage() {
  const { rules, loading, createRule, toggleRule, deleteRule } = useAutomationRules();
  const [open,  setOpen]  = useState(false);
  const [draft, setDraft] = useState({ ...EMPTY });

  const set = <K extends keyof typeof EMPTY>(k: K, v: typeof EMPTY[K]) =>
    setDraft(d => ({ ...d, [k]: v }));

  const handleCreate = async () => {
    if (!draft.name || !draft.trigger_to_status) return;
    await createRule(draft);
    setOpen(false);
    setDraft({ ...EMPTY });
  };

  if (loading) return <div className="space-y-3 p-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;

  return (
    <div className="space-y-5 p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Automações</h1>
          <Badge variant="outline" className="text-[10px]">{rules.length} regra{rules.length !== 1 ? "s" : ""}</Badge>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Nova regra
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Zap className="h-10 w-10 opacity-20" />
          <p className="text-sm">Nenhuma regra de automação criada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(rule => (
            <div key={rule.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4">
              <Switch
                checked={rule.enabled}
                onCheckedChange={v => toggleRule(rule.id, v)}
                className="shrink-0"
              />
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${!rule.enabled ? "text-muted-foreground" : ""}`}>{rule.name}</span>
                  {!rule.enabled && <Badge variant="secondary" className="text-[9px]">Desativada</Badge>}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
                  <span>{TRIGGER_LABELS[rule.trigger_type]}</span>
                  {rule.trigger_from_status && <><span>→</span><Badge variant="outline" className="text-[9px]">{rule.trigger_from_status}</Badge></>}
                  <ChevronRight className="h-3 w-3" />
                  <Badge variant="outline" className="text-[9px]">{rule.trigger_to_status}</Badge>
                  <span>•</span>
                  <span>{ACTION_LABELS[rule.action_type] ?? rule.action_type}</span>
                  {rule.action_message && <span className="text-muted-foreground/60 truncate max-w-[200px]">— "{rule.action_message}"</span>}
                </div>
              </div>
              <button onClick={() => deleteRule(rule.id)} className="text-muted-foreground hover:text-destructive p-1 rounded shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nova Regra de Automação</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Nome da regra</label>
              <Input value={draft.name} onChange={e => set("name", e.target.value)}
                className="h-8 text-xs" placeholder="Ex: Notificar ao mover para Review" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Status origem (opcional)</label>
                <Input value={draft.trigger_from_status ?? ""}
                  onChange={e => set("trigger_from_status", e.target.value || null)}
                  className="h-8 text-xs" placeholder="qualquer" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Status destino *</label>
                <Input value={draft.trigger_to_status}
                  onChange={e => set("trigger_to_status", e.target.value)}
                  className="h-8 text-xs" placeholder="ex: review" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Ação</label>
              <Select value={draft.action_type} onValueChange={v => set("action_type", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="notify"        className="text-xs">🔔 Notificar time</SelectItem>
                  <SelectItem value="change_status" className="text-xs">↔️ Mudar status automaticamente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draft.action_type === "notify" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Mensagem da notificação</label>
                <Input value={draft.action_message ?? ""}
                  onChange={e => set("action_message", e.target.value)}
                  className="h-8 text-xs" placeholder="Ex: HU movida para revisão" />
              </div>
            )}
            {draft.action_type === "change_status" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Novo status</label>
                <Input value={draft.action_target_status ?? ""}
                  onChange={e => set("action_target_status", e.target.value)}
                  className="h-8 text-xs" placeholder="ex: in_review" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="text-xs h-8">Cancelar</Button>
            <Button onClick={handleCreate} disabled={!draft.name || !draft.trigger_to_status} className="text-xs h-8 gap-1">
              <Plus className="h-3.5 w-3.5" /> Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
