import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge }    from "@/components/ui/badge";
import { Button }   from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label }    from "@/components/ui/label";
import {
  AlertTriangle, Clock, Hash, Layers, Tag,
  User, CheckCircle2, XCircle, Lock, Unlock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast }    from "sonner";
import type { KanbanCard, KanbanColumn } from "../hooks/useKanbanBoard";

const PRIORITY_COLOR: Record<string, string> = {
  high:   "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low:    "bg-green-100 text-green-700 border-green-200",
};
const PRIORITY_LABEL: Record<string, string> = {
  high: "Alta", medium: "Média", low: "Baixa",
};

/** Iniciais duplas: "Roberto de Araujo Sales" → "RS" */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

interface Props {
  card:     KanbanCard | null;
  columns:  KanbanColumn[];
  devs:     { id: string; name: string; avatar: string | null }[];
  open:     boolean;
  onClose:  () => void;
  onMoved:  (cardId: string, newStatus: string) => void;
  onReload: () => void;
}

export function UserStoryDetailModal({ card, columns, devs, open, onClose, onMoved, onReload }: Props) {
  const [description, setDescription] = useState("");
  const [loadingDesc, setLoadingDesc]  = useState(false);
  const [saving, setSaving]            = useState(false);
  const [blocking, setBlocking]        = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");

  // Carrega description completa e assignee ao abrir
  useEffect(() => {
    if (!card || !open) return;
    setSelectedStatus(card.status);
    setSelectedAssignee(card.assignee_id ?? "__none__");
    setDescription("");
    setLoadingDesc(true);
    supabase
      .from("user_stories")
      .select("description")
      .eq("id", card.id)
      .single()
      .then(({ data }) => {
        setDescription(data?.description ?? "");
        setLoadingDesc(false);
      });
  }, [card, open]);

  if (!card) return null;

  const currentCol = columns.find(c => c.key === card.status);

  // ── Ações ──────────────────────────────────────────────────────────────────

  /** Salva descrição */
  const handleSaveDescription = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("user_stories")
      .update({ description })
      .eq("id", card.id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar descrição"); return; }
    toast.success("Descrição salva");
  };

  /** Muda status (coluna) */
  const handleStatusChange = async (newStatus: string) => {
    setSelectedStatus(newStatus);
    const { error } = await supabase
      .from("user_stories")
      .update({ status: newStatus })
      .eq("id", card.id);
    if (error) { toast.error("Erro ao alterar status"); return; }
    onMoved(card.id, newStatus);
    toast.success("Status atualizado");
  };

  /** Muda assignee */
  const handleAssigneeChange = async (devId: string) => {
    setSelectedAssignee(devId);
    const value = devId === "__none__" ? null : devId;
    const { error } = await supabase
      .from("user_stories")
      .update({ assignee_id: value })
      .eq("id", card.id);
    if (error) { toast.error("Erro ao alterar responsável"); return; }
    toast.success("Responsável atualizado");
    onReload();
  };

  /** Bloquear / Desbloquear */
  const handleToggleBlock = async () => {
    setBlocking(true);
    const newStatus = card.is_blocked ? (selectedStatus === "bloqueada" ? "em_andamento" : selectedStatus) : "bloqueada";
    const { error } = await supabase
      .from("user_stories")
      .update({ status: newStatus })
      .eq("id", card.id);
    setBlocking(false);
    if (error) { toast.error("Erro ao alterar bloqueio"); return; }
    onMoved(card.id, newStatus);
    toast.success(card.is_blocked ? "HU desbloqueada" : "HU bloqueada");
    onClose();
  };

  /** Marcar como concluída */
  const handleMarkDone = async () => {
    const doneCol = columns.find(c => c.key === "concluida" || c.key === "done" || c.label?.toLowerCase().includes("conclui"));
    if (!doneCol) { toast.error("Coluna de conclusão não encontrada"); return; }
    await handleStatusChange(doneCol.key);
    toast.success("HU marcada como concluída!");
  };

  const assigneeDev = devs.find(d => d.id === (card.assignee_id ?? ""));

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  {card.code}
                </span>
                {card.is_blocked && (
                  <Badge variant="destructive" className="text-[10px]">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Bloqueada
                  </Badge>
                )}
                <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLOR[card.priority] ?? ""}`}>
                  {PRIORITY_LABEL[card.priority] ?? card.priority}
                </Badge>
                {card.story_points > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {card.story_points}pt
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-base font-semibold leading-snug">
                {card.title}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 mt-2">

          {/* Informações rápidas */}
          <div className="grid grid-cols-2 gap-3 text-xs">

            {/* Coluna atual */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Status atual</p>
                <p className="font-medium" style={{ color: currentCol?.hex ?? undefined }}>
                  {currentCol?.label ?? card.status}
                </p>
              </div>
            </div>

            {/* Assignee */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2 min-w-0">
                {assigneeDev ? (
                  <>
                    {assigneeDev.avatar ? (
                      <img src={assigneeDev.avatar} alt={assigneeDev.name} className="h-6 w-6 rounded-full object-cover border shrink-0" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-[9px] font-bold text-primary shrink-0">
                        {getInitials(assigneeDev.name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[10px] text-muted-foreground">Responsável</p>
                      <p className="font-medium truncate">{assigneeDev.name}</p>
                    </div>
                  </>
                ) : (
                  <div>
                    <p className="text-[10px] text-muted-foreground">Responsável</p>
                    <p className="text-muted-foreground italic">Não atribuído</p>
                  </div>
                )}
              </div>
            </div>

            {/* Epic */}
            {card.epic_name && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: card.epic_color ?? "#6366f1" }} />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Epic</p>
                    <p className="font-medium truncate">{card.epic_name}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Story Points + Horas */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-[10px] text-muted-foreground">Esforço</p>
                <p className="font-medium">
                  {card.story_points > 0 ? `${card.story_points} pts` : "—"}
                  {card.estimated_hours ? ` · ${card.estimated_hours}h` : ""}
                </p>
              </div>
            </div>

            {/* Horas estimadas */}
            {card.estimated_hours && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground">Horas estimadas</p>
                  <p className="font-medium">{card.estimated_hours}h</p>
                </div>
              </div>
            )}
          </div>

          {/* Mudar Status */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Mover para coluna</Label>
            <Select value={selectedStatus} onValueChange={handleStatusChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map(col => (
                  <SelectItem key={col.id} value={col.key} className="text-xs">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: col.hex ?? "#6366f1" }} />
                      {col.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mudar Responsável */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Responsável</Label>
            <Select value={selectedAssignee} onValueChange={handleAssigneeChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecionar responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__" className="text-xs text-muted-foreground">— Sem responsável</SelectItem>
                {devs.map(dev => (
                  <SelectItem key={dev.id} value={dev.id} className="text-xs">
                    <span className="flex items-center gap-2">
                      {dev.avatar ? (
                        <img src={dev.avatar} alt={dev.name} className="h-5 w-5 rounded-full object-cover" />
                      ) : (
                        <span className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-bold text-primary">
                          {getInitials(dev.name)}
                        </span>
                      )}
                      {dev.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Descrição</Label>
            {loadingDesc ? (
              <div className="h-20 bg-muted animate-pulse rounded-md" />
            ) : (
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Adicione uma descrição para esta HU..."
                className="text-xs resize-none min-h-[80px]"
              />
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7"
              onClick={handleSaveDescription}
              disabled={saving || loadingDesc}
            >
              {saving ? "Salvando..." : "Salvar descrição"}
            </Button>
          </div>

          {/* Ações rápidas */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              size="sm"
              variant="default"
              className="text-xs h-8 gap-1.5"
              onClick={handleMarkDone}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Marcar como Concluída
            </Button>

            <Button
              size="sm"
              variant={card.is_blocked ? "outline" : "destructive"}
              className="text-xs h-8 gap-1.5"
              onClick={handleToggleBlock}
              disabled={blocking}
            >
              {card.is_blocked ? (
                <><Unlock className="h-3.5 w-3.5" />Desbloquear</>
              ) : (
                <><Lock className="h-3.5 w-3.5" />Bloquear HU</>
              )}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-8 gap-1.5 ml-auto"
              onClick={onClose}
            >
              <XCircle className="h-3.5 w-3.5" />
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
