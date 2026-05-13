import { useState } from "react";
import { useNotifications } from "../hooks/useNotifications";
import { Button }  from "@/components/ui/button";
import { Badge }   from "@/components/ui/badge";
import { Switch }  from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input }   from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, Plus, Trash2 } from "lucide-react";

const TRIGGERS = [
  { value: "hu_moved_to_done",         label: "HU movida para Concluído" },
  { value: "hu_blocked",               label: "HU marcada como Bloqueada" },
  { value: "hu_assigned",              label: "HU atribuída a alguém" },
  { value: "impediment_created",       label: "Impedimento criado" },
  { value: "sprint_ending_soon",       label: "Sprint encerrando em 2 dias" },
  { value: "sprint_started",           label: "Sprint iniciada" },
  { value: "planning_session_started", label: "Planning Poker iniciado" },
  { value: "retro_session_started",    label: "Retrospectiva iniciada" },
];
const ACTIONS = [
  { value: "notify_assignee",    label: "Notificar responsável" },
  { value: "notify_team",        label: "Notificar todo o time" },
  { value: "notify_facilitator", label: "Notificar facilitador/SM" },
  { value: "create_impediment",  label: "Criar impedimento automático" },
];

export function AutomationRulesPage() {
  const { rules, loading, toggleRule, createRule, deleteRule } = useNotifications();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("");
  const [action,  setAction]  = useState("");

  const handleCreate = async () => {
    if (!name || !trigger || !action) return;
    await createRule({ name, trigger, condition: {}, action, action_data: {}, enabled: true });
    setOpen(false); setName(""); setTrigger(""); setAction("");
  };

  if (loading) return <div className="space-y-3 p-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>;

  return (
    <div className="space-y-6 p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /> Automações</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Regras automáticas disparadas por eventos do time.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}><Plus className="h-3.5 w-3.5" /> Nova Regra</Button>
      </div>
      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Zap className="h-10 w-10 opacity-20" />
          <p className="text-sm">Nenhuma regra criada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map(r => (
            <div key={r.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Switch checked={r.enabled} onCheckedChange={v => toggleRule(r.id, v)} />
                <div>
                  <p className="text-sm font-medium">{r.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="outline" className="text-[9px]">{TRIGGERS.find(t => t.value === r.trigger)?.label ?? r.trigger}</Badge>
                    <span className="text-[10px] text-muted-foreground">→</span>
                    <Badge variant="secondary" className="text-[9px]">{ACTIONS.find(a => a.value === r.action)?.label ?? r.action}</Badge>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRule(r.id)}>
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Nova Regra de Automação</DialogTitle></DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Nome</label>
              <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-xs" placeholder="Ex: Alertar bloqueio" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Quando (gatilho)</label>
              <Select value={trigger} onValueChange={setTrigger}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{TRIGGERS.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Então (ação)</label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{ACTIONS.map(a => <SelectItem key={a.value} value={a.value} className="text-xs">{a.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="text-xs h-8">Cancelar</Button>
            <Button onClick={handleCreate} disabled={!name || !trigger || !action} className="text-xs h-8 gap-1"><Plus className="h-3.5 w-3.5" /> Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
