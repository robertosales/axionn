import { useEffect, useState } from "react";
import { X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { OkrHealth, OkrObjective, OkrObjectiveInput } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: OkrObjectiveInput) => Promise<void>;
  teams: { id: string; name: string }[];
  defaultCycle: string;
  objective?: OkrObjective | null;
}

export function OkrObjectiveForm({ open, onClose, onSubmit, teams, defaultCycle, objective }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [teamId, setTeamId] = useState<string>("");
  const [lifecycle, setLifecycle] = useState<OkrObjective["lifecycle_status"]>("active");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [healthOverride, setHealthOverride] = useState<OkrHealth | "">("");
  const [overrideReason, setOverrideReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = !!objective;

  useEffect(() => {
    if (!open) return;
    setTitle(objective?.title ?? "");
    setDescription(objective?.description ?? "");
    // Prioriza: team do objective editado → primeiro time disponível → string vazia
    const resolvedTeamId = objective?.team_id ?? teams[0]?.id ?? "";
    setTeamId(resolvedTeamId);
    setLifecycle(objective?.lifecycle_status ?? "active");
    setStartDate(objective?.start_date ?? "");
    setEndDate(objective?.end_date ?? "");
    setHealthOverride(objective?.manual_health_override ?? "");
    setOverrideReason(objective?.health_override_reason ?? "");
  }, [open, objective, teams]);

  if (!open) return null;

  const isTeamValid = !!teamId && teamId !== "all" && teams.some((t) => t.id === teamId);

  const handleSubmit = async () => {
    if (!title.trim() || !isTeamValid) return;
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        owner_id: objective?.owner_id ?? user?.id ?? undefined,
        team_id: teamId,
        cycle: objective?.cycle ?? defaultCycle,
        lifecycle_status: lifecycle,
        start_date: startDate || null,
        end_date: endDate || null,
        manual_health_override: healthOverride || null,
        health_override_reason: healthOverride ? overrideReason.trim() : null,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h3 className="text-base font-semibold">{isEdit ? "Editar objetivo" : "Novo objetivo"}</h3>
            <p className="text-xs text-muted-foreground">Defina o objetivo principal do ciclo.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isSubmitting}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Status do ciclo</label>
              <select value={lifecycle} onChange={(e) => setLifecycle(e.target.value as OkrObjective["lifecycle_status"])} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
                <option value="draft">Rascunho</option>
                <option value="active">Ativo</option>
                <option value="completed">Concluído</option>
                <option value="cancelled">Cancelado</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Início</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Fim</label>
              <input type="date" min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" />
            </div>
          </div>

          {isEdit && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Override manual de saúde</label>
                <select value={healthOverride} onChange={(e) => setHealthOverride(e.target.value as OkrHealth | "")} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
                  <option value="">Usar saúde calculada</option>
                  <option value="on_track">No prazo</option>
                  <option value="attention">Atenção</option>
                  <option value="at_risk">Em risco</option>
                  <option value="completed">Concluído</option>
                </select>
              </div>
              {healthOverride && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Justificativa obrigatória</label>
                  <textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} className="min-h-[64px] w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Explique por que a avaliação calculada deve ser substituída" />
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">O valor calculado permanece preservado como evidência.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              placeholder="Ex: Reduzir retrabalho nas entregas"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[88px] w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              placeholder="Contexto, impacto esperado e escopo do objetivo"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Time</label>
              {teams.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">Carregando times...</p>
              ) : (
                <select
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                >
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Ciclo</label>
              <input
                value={objective?.cycle ?? defaultCycle}
                disabled
                className="h-10 w-full rounded-lg border bg-muted px-3 text-sm text-muted-foreground"
              />
            </div>
          </div>

          {!isTeamValid && teams.length > 0 && (
            <p className="text-xs text-destructive">Selecione um time válido para continuar.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !isTeamValid || !title.trim() || (!!healthOverride && !overrideReason.trim()) || (!!startDate && !!endDate && endDate < startDate)} className="gap-1.5">
            {isSubmitting ? (
              <span className="flex items-center gap-1.5">
                <span className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                {isEdit ? "Salvando..." : "Criando..."}
              </span>
            ) : (
              <><Save className="h-4 w-4" /> {isEdit ? "Salvar alterações" : "Criar objetivo"}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
