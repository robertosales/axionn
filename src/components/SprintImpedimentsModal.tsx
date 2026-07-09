/**
 * SprintImpedimentsModal
 * Modal para gerenciar impedimentos no nível da Sprint.
 *
 * Uso:
 *   <SprintImpedimentsModal
 *     sprint={activeSprint}
 *     open={open}
 *     onClose={() => setOpen(false)}
 *   />
 *
 * Exibe:
 *   - Lista de impedimentos ativos e resolvidos da sprint
 *   - Distinção visual: 🏃 SPRINT (âmbar) vs HU-XXX (azul)
 *   - Formulário para adicionar novo impedimento na sprint
 *   - Botão resolver com nota de resolução
 */
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  ExternalLink,
  Timer,
  Layers,
} from "lucide-react";
import { useSprint } from "@/contexts/SprintContext";
import {
  Sprint,
  Impediment,
  IMPEDIMENT_TYPE_LABELS,
  IMPEDIMENT_CRITICALITY_LABELS,
  ImpedimentCriticality,
  ImpedimentType,
} from "@/types/sprint";
import { cn } from "@/lib/utils";

interface Props {
  sprint: Sprint;
  open: boolean;
  onClose: () => void;
}

const CRITICALITY_COLORS: Record<ImpedimentCriticality, string> = {
  baixa:   "bg-slate-100 text-slate-700 border-slate-300",
  media:   "bg-amber-100  text-amber-700  border-amber-300",
  alta:    "bg-orange-100 text-orange-700 border-orange-300",
  critica: "bg-red-100    text-red-700    border-red-300",
};

function daysSince(dateStr?: string | null): string {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  return diff === 0 ? "hoje" : diff === 1 ? "há 1 dia" : `há ${diff} dias`;
}

// ── sub-componente: card de um impedimento ────────────────────────────────────
function ImpedimentCard({
  imp,
  huCode,
  onResolve,
}: {
  imp: Impediment;
  huCode?: string;
  onResolve: (id: string) => void;
}) {
  const isSprintLevel = !imp.huId;
  const isResolved    = !!imp.resolvedAt;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2 transition-opacity",
        isResolved      ? "opacity-60 bg-muted/30"      : "bg-card",
        isSprintLevel   ? "border-amber-500/40"         : "border-blue-500/40",
      )}
    >
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 flex-wrap">
        {isSprintLevel ? (
          <Badge className="bg-amber-500/15 text-amber-600 border-amber-400/30 gap-1 text-xs">
            <Layers className="h-3 w-3" /> SPRINT
          </Badge>
        ) : (
          <Badge className="bg-blue-500/15 text-blue-600 border-blue-400/30 text-xs">
            {huCode ?? "HU"}
          </Badge>
        )}

        <Badge variant="outline" className={cn("text-xs", CRITICALITY_COLORS[imp.criticality])}>
          {IMPEDIMENT_CRITICALITY_LABELS[imp.criticality]}
        </Badge>

        {imp.type && (
          <Badge variant="outline" className="text-xs">
            {IMPEDIMENT_TYPE_LABELS[imp.type]?.label ?? imp.type}
          </Badge>
        )}

        {isResolved && (
          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-400/30 text-xs gap-1 ml-auto">
            <CheckCircle2 className="h-3 w-3" /> Resolvido
          </Badge>
        )}

        {!isResolved && (
          <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
            <Timer className="h-3 w-3" />
            {daysSince(imp.reportedAt ?? imp.createdAt)}
          </span>
        )}
      </div>

      {/* Descrição */}
      <p className="text-sm text-foreground">{imp.reason}</p>

      {/* Rodapé */}
      <div className="flex items-center gap-3">
        {imp.hasTicket && imp.ticketUrl && (
          <a
            href={imp.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            {imp.ticketId ?? "Ver ticket"}
          </a>
        )}

        {!isResolved && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs ml-auto text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
            onClick={() => onResolve(imp.id)}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Resolver
          </Button>
        )}

        {isResolved && imp.resolution && (
          <p className="text-xs text-muted-foreground italic">↳ {imp.resolution}</p>
        )}
      </div>
    </div>
  );
}

// ── componente principal ──────────────────────────────────────────────────────
export function SprintImpedimentsModal({ sprint, open, onClose }: Props) {
  const { impediments, userStories, addSprintImpediment, resolveImpediment } = useSprint();

  // Impedimentos deste sprint (por sprint_id) + impedimentos de HUs desta sprint
  const sprintHuIds = useMemo(
    () => new Set(userStories.filter((h) => h.sprintId === sprint.id).map((h) => h.id)),
    [userStories, sprint.id],
  );

  const allImpediments = useMemo(
    () =>
      impediments.filter(
        (imp) =>
          imp.sprintId === sprint.id ||
          (imp.huId && sprintHuIds.has(imp.huId)),
      ),
    [impediments, sprint.id, sprintHuIds],
  );

  const active   = allImpediments.filter((i) => !i.resolvedAt);
  const resolved = allImpediments.filter((i) => !!i.resolvedAt);

  // Formulário de novo impedimento
  const [showForm,    setShowForm]    = useState(false);
  const [reason,      setReason]      = useState("");
  const [type,        setType]        = useState<ImpedimentType>("tecnico");
  const [criticality, setCriticality] = useState<ImpedimentCriticality>("media");
  const [hasTicket,   setHasTicket]   = useState(false);
  const [ticketId,    setTicketId]    = useState("");
  const [ticketUrl,   setTicketUrl]   = useState("");
  const [saving,      setSaving]      = useState(false);

  const resetForm = () => {
    setReason(""); setType("tecnico"); setCriticality("media");
    setHasTicket(false); setTicketId(""); setTicketUrl("");
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    const saved = await addSprintImpediment(sprint.id, {
      reason: reason.trim(),
      type,
      criticality,
      hasTicket,
      ticketId:  hasTicket ? ticketId  : undefined,
      ticketUrl: hasTicket ? ticketUrl : undefined,
    });
    setSaving(false);
    if (saved) resetForm();
  };

  const handleResolve = async (impedimentId: string) => {
    await resolveImpediment(null, impedimentId);
  };

  // Lookup de código da HU por id
  const huCodeMap = useMemo(
    () => Object.fromEntries(userStories.map((h) => [h.id, h.code])),
    [userStories],
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Impedimentos — {sprint.name}
            {active.length > 0 && (
              <Badge className="bg-red-500/15 text-red-600 border-red-400/30 ml-1">
                {active.length} ativo{active.length > 1 ? "s" : ""}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Impedimentos ativos */}
          {active.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Ativos ({active.length})
              </h3>
              {active.map((imp) => (
                <ImpedimentCard
                  key={imp.id}
                  imp={imp}
                  huCode={imp.huId ? huCodeMap[imp.huId] : undefined}
                  onResolve={handleResolve}
                />
              ))}
            </section>
          )}

          {active.length === 0 && !showForm && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nenhum impedimento ativo nesta sprint. 🎉
            </div>
          )}

          {/* Formulário de novo impedimento */}
          {showForm && (
            <section className="rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-amber-600">Novo impedimento na Sprint</h3>

              <div className="space-y-1">
                <Label className="text-xs">Descrição *</Label>
                <Textarea
                  placeholder="Descreva o impedimento que afeta a sprint..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={type} onValueChange={(v) => setType(v as ImpedimentType)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(IMPEDIMENT_TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Criticidade</Label>
                  <Select value={criticality} onValueChange={(v) => setCriticality(v as ImpedimentCriticality)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(IMPEDIMENT_CRITICALITY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="has-ticket"
                  checked={hasTicket}
                  onCheckedChange={(v) => setHasTicket(!!v)}
                />
                <Label htmlFor="has-ticket" className="text-xs cursor-pointer">
                  Possui ticket vinculado
                </Label>
              </div>

              {hasTicket && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">ID do ticket</Label>
                    <Input
                      value={ticketId}
                      onChange={(e) => setTicketId(e.target.value)}
                      placeholder="INC-1234"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">URL do ticket</Label>
                    <Input
                      value={ticketUrl}
                      onChange={(e) => setTicketUrl(e.target.value)}
                      placeholder="https://..."
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!reason.trim() || saving}
                  className="flex-1"
                >
                  {saving ? "Salvando..." : "Salvar impedimento"}
                </Button>
                <Button size="sm" variant="outline" onClick={resetForm}>
                  Cancelar
                </Button>
              </div>
            </section>
          )}

          {/* Impedimentos resolvidos (colapsados) */}
          {resolved.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Resolvidos ({resolved.length})
              </h3>
              {resolved.map((imp) => (
                <ImpedimentCard
                  key={imp.id}
                  imp={imp}
                  huCode={imp.huId ? huCodeMap[imp.huId] : undefined}
                  onResolve={handleResolve}
                />
              ))}
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t shrink-0 flex justify-between items-center">
          <Button
            size="sm"
            variant="outline"
            className="gap-1 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
            onClick={() => setShowForm(true)}
            disabled={showForm}
          >
            <Plus className="h-4 w-4" />
            Adicionar impedimento na Sprint
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
