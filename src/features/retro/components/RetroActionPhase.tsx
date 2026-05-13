// src/features/retro/components/RetroActionPhase.tsx
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, CheckCircle2, Clock, AlertCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RetroActionItem, RetroCard, ActionItemStatus } from "../types/retro";

const STATUS_CONFIG: Record<ActionItemStatus, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: "Pendente", icon: <Clock className="h-3 w-3" />, color: "text-muted-foreground" },
  in_progress: { label: "Em andamento", icon: <AlertCircle className="h-3 w-3" />, color: "text-warning" },
  done: { label: "Concluído", icon: <CheckCircle2 className="h-3 w-3" />, color: "text-success" },
  cancelled: { label: "Cancelado", icon: <XCircle className="h-3 w-3" />, color: "text-destructive" },
};

interface ActionFormData {
  title: string;
  description: string;
  ownerId: string;
  dueDate: string;
  cardId: string;
}

const EMPTY_FORM: ActionFormData = { title: "", description: "", ownerId: "", dueDate: "", cardId: "" };

interface Props {
  actionItems: RetroActionItem[];
  cards: RetroCard[];
  profiles: Record<string, string>;
  isFacilitator: boolean;
  onCreate: (payload: { title: string; description?: string; ownerId?: string; dueDate?: string; cardId?: string }) => Promise<void>;
  onUpdate: (id: string, updates: Partial<{ title: string; description: string; ownerId: string; dueDate: string; status: ActionItemStatus }>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function RetroActionPhase({ actionItems, cards, profiles, isFacilitator, onCreate, onUpdate, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<RetroActionItem | null>(null);
  const [form, setForm] = useState<ActionFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const visibleCards = cards.filter((c) => !c.hidden);
  const topVoted = [...visibleCards].sort((a, b) => b.votes - a.votes).slice(0, 5);

  const openCreate = (card?: RetroCard) => {
    setEditItem(null);
    setForm({ ...EMPTY_FORM, cardId: card?.id ?? "", title: card ? `Ação: ${card.text.slice(0, 60)}` : "" });
    setOpen(true);
  };

  const openEdit = (item: RetroActionItem) => {
    setEditItem(item);
    setForm({
      title: item.title,
      description: item.description ?? "",
      ownerId: item.ownerId ?? "",
      dueDate: item.dueDate ?? "",
      cardId: item.cardId ?? "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editItem) {
        await onUpdate(editItem.id, {
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          ownerId: form.ownerId || undefined,
          dueDate: form.dueDate || undefined,
        });
      } else {
        await onCreate({
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          ownerId: form.ownerId || undefined,
          dueDate: form.dueDate || undefined,
          cardId: form.cardId || undefined,
        });
      }
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const participantOptions = Object.entries(profiles).map(([id, name]) => ({ id, name }));

  return (
    <div className="space-y-4">
      {/* Sugestões dos top cards votados */}
      {topVoted.length > 0 && (
        <Card className="border-info/30 bg-info/5">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">💡 Sugestões dos cards mais votados</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 flex flex-wrap gap-2">
            {topVoted.map((card) => (
              <button
                key={card.id}
                onClick={() => openCreate(card)}
                className="text-xs px-3 py-1.5 rounded-full border border-info/40 bg-background hover:bg-info/10 transition-colors text-left max-w-xs truncate"
              >
                + {card.text.slice(0, 50)}{card.text.length > 50 ? "..." : ""}
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Header + botão novo */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Action Items</h3>
          <p className="text-xs text-muted-foreground">
            {actionItems.length} item{actionItems.length !== 1 ? "s" : ""} criado{actionItems.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" onClick={() => openCreate()}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Novo Action Item
        </Button>
      </div>

      {/* Lista */}
      {actionItems.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum action item ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Clique em "Novo Action Item" ou use as sugestões acima.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {actionItems.map((item) => {
            const status = STATUS_CONFIG[item.status];
            const expanded = expandedIds.has(item.id);
            const ownerName = item.ownerId ? (profiles[item.ownerId] ?? "—") : "Sem responsável";
            const linkedCard = item.cardId ? cards.find((c) => c.id === item.cardId) : null;

            return (
              <Card key={item.id} className="border">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <button
                      onClick={() =>
                        isFacilitator &&
                        onUpdate(item.id, { status: item.status === "done" ? "pending" : "done" })
                      }
                      className={cn("mt-0.5 shrink-0", status.color, isFacilitator && "cursor-pointer hover:opacity-70")}
                    >
                      {status.icon}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={cn(
                            "text-sm font-medium",
                            item.status === "done" && "line-through text-muted-foreground",
                          )}
                        >
                          {item.title}
                        </p>
                        <Badge variant="outline" className={cn("text-[10px] gap-1", status.color)}>
                          {status.icon} {status.label}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                        <span>👤 {ownerName}</span>
                        {item.dueDate && (
                          <span>📅 {new Date(item.dueDate + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                        )}
                        {linkedCard && (
                          <span className="italic truncate max-w-[160px]">🔗 {linkedCard.text.slice(0, 40)}</span>
                        )}
                      </div>

                      {expanded && item.description && (
                        <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap border-t pt-2">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {item.description && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleExpand(item.id)}>
                          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </Button>
                      )}
                      {isFacilitator ? (
                        <>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(item)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            onClick={() => onDelete(item.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <Select
                          value={item.status}
                          onValueChange={(val) => onUpdate(item.id, { status: val as ActionItemStatus })}
                        >
                          <SelectTrigger className="h-6 text-[10px] w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                              <SelectItem key={k} value={k} className="text-xs">
                                {v.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog criar/editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar Action Item" : "Novo Action Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Título *</label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="O que precisa ser feito?"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Descrição</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Detalhes opcionais..."
                rows={3}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Responsável</label>
                <Select value={form.ownerId} onValueChange={(v) => setForm((f) => ({ ...f, ownerId: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Ninguém" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Ninguém</SelectItem>
                    {participantOptions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Prazo</label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            {visibleCards.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Vincular a card (opcional)</label>
                <Select value={form.cardId} onValueChange={(v) => setForm((f) => ({ ...f, cardId: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Nenhum card" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum card</SelectItem>
                    {visibleCards.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.text.slice(0, 60)}{c.text.length > 60 ? "..." : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !form.title.trim()}>
              {saving ? "Salvando..." : editItem ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
